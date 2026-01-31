import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import type { Env, Event, CreateEventRequest, CreateResponseRequest, ConfirmEventRequest, SlotAggregation } from '../../src/types';

const app = new Hono<{ Bindings: Env }>().basePath('/api');

// Generate cryptographically secure random tokens
function generateToken(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('').substring(0, length);
}

// Create event
app.post('/events', async (c) => {
  const body: CreateEventRequest = await c.req.json();
  const eventId = generateToken(16);
  const editToken = generateToken();
  const viewToken = generateToken();
  const createdAt = Date.now();

  const { title, description, slots, timezone = 'Asia/Tokyo', mode = 'datetime' } = body;

  // Insert event
  await c.env.DB.prepare(
    'INSERT INTO events (id, title, description, edit_token, view_token, created_at, timezone, mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(eventId, title, description || null, editToken, viewToken, createdAt, timezone, mode).run();

  // Insert slots
  for (const slot of slots) {
    await c.env.DB.prepare(
      'INSERT INTO event_slots (event_id, start_time, end_time) VALUES (?, ?, ?)'
    ).bind(eventId, slot.start, slot.end).run();
  }

  return c.json({
    id: eventId,
    editToken,
    viewToken,
    editUrl: `/e/${eventId}?token=${editToken}`,
    viewUrl: `/v/${eventId}?token=${viewToken}`,
  });
});

// Get event by ID and token
app.get('/events/:id', async (c) => {
  const eventId = c.req.param('id');
  const token = c.req.query('token');

  if (!token) {
    return c.json({ error: 'Token required' }, 401);
  }

  const eventResult = await c.env.DB.prepare(
    'SELECT * FROM events WHERE id = ?'
  ).bind(eventId).first<any>();

  if (!eventResult) {
    return c.json({ error: 'Event not found' }, 404);
  }

  // Validate token
  const isEdit = token === eventResult.edit_token;
  const isView = token === eventResult.view_token;

  if (!isEdit && !isView) {
    return c.json({ error: 'Invalid token' }, 403);
  }

  // Get slots
  const slotsResult = await c.env.DB.prepare(
    'SELECT * FROM event_slots WHERE event_id = ? ORDER BY start_time'
  ).bind(eventId).all<any>();

  // Get responses
  const responsesResult = await c.env.DB.prepare(
    'SELECT * FROM responses WHERE event_id = ? ORDER BY created_at DESC'
  ).bind(eventId).all<any>();

  const responses = [];
  for (const response of responsesResult.results || []) {
    const responseSlots = await c.env.DB.prepare(
      'SELECT * FROM response_slots WHERE response_id = ?'
    ).bind(response.id).all<any>();

    responses.push({
      id: response.id,
      eventId: response.event_id,
      participantName: response.participant_name,
      createdAt: response.created_at,
      slots: (responseSlots.results || []).map((s: any) => ({
        start: s.slot_start,
        end: s.slot_end,
        availability: s.availability,
      })),
    });
  }

  const event: Event = {
    id: eventResult.id,
    title: eventResult.title,
    description: eventResult.description,
    editToken: isEdit ? eventResult.edit_token : '',
    viewToken: eventResult.view_token,
    createdAt: eventResult.created_at,
    confirmedSlots: eventResult.confirmed_slots,
    timezone: eventResult.timezone,
    mode: eventResult.mode || 'datetime',
    slots: (slotsResult.results || []).map((s: any) => ({
      id: s.id,
      start: s.start_time,
      end: s.end_time,
    })),
    responses: responses,
  };

  return c.json({ event, canEdit: isEdit });
});

// Submit participant response
app.post('/events/:id/responses', async (c) => {
  const eventId = c.req.param('id');
  const body: CreateResponseRequest = await c.req.json();
  const createdAt = Date.now();

  // Check if event exists
  const eventResult = await c.env.DB.prepare(
    'SELECT id FROM events WHERE id = ?'
  ).bind(eventId).first();

  if (!eventResult) {
    return c.json({ error: 'Event not found' }, 404);
  }

  // Insert response
  const responseResult = await c.env.DB.prepare(
    'INSERT INTO responses (event_id, participant_name, created_at) VALUES (?, ?, ?) RETURNING id'
  ).bind(eventId, body.participantName, createdAt).first<any>();

  const responseId = responseResult.id;

  // Insert response slots
  for (const slot of body.slots) {
    await c.env.DB.prepare(
      'INSERT INTO response_slots (response_id, slot_start, slot_end, availability) VALUES (?, ?, ?, ?)'
    ).bind(responseId, slot.start, slot.end, slot.availability).run();
  }

  return c.json({ success: true, responseId });
});

// Get aggregated slot recommendations
app.get('/events/:id/aggregation', async (c) => {
  const eventId = c.req.param('id');
  const token = c.req.query('token');

  if (!token) {
    return c.json({ error: 'Token required' }, 401);
  }

  const eventResult = await c.env.DB.prepare(
    'SELECT edit_token, view_token FROM events WHERE id = ?'
  ).bind(eventId).first<any>();

  if (!eventResult || (token !== eventResult.edit_token && token !== eventResult.view_token)) {
    return c.json({ error: 'Invalid token' }, 403);
  }

  // Get all slots and responses
  const slotsResult = await c.env.DB.prepare(
    'SELECT * FROM event_slots WHERE event_id = ? ORDER BY start_time'
  ).bind(eventId).all<any>();

  const responsesResult = await c.env.DB.prepare(
    'SELECT id FROM responses WHERE event_id = ?'
  ).bind(eventId).all<any>();

  const aggregation: SlotAggregation[] = [];

  for (let i = 0; i < (slotsResult.results || []).length; i++) {
    const slot = slotsResult.results![i];
    let availableCount = 0;
    let maybeCount = 0;
    let unavailableCount = 0;

    for (const response of responsesResult.results || []) {
      const responseSlot = await c.env.DB.prepare(
        'SELECT availability FROM response_slots WHERE response_id = ? AND slot_start = ? AND slot_end = ?'
      ).bind(response.id, slot.start_time, slot.end_time).first<any>();

      if (responseSlot) {
        if (responseSlot.availability === 'available') availableCount++;
        else if (responseSlot.availability === 'maybe') maybeCount++;
        else unavailableCount++;
      }
    }

    const score = availableCount * 2 + maybeCount * 1;

    aggregation.push({
      slot: { id: slot.id, start: slot.start_time, end: slot.end_time },
      index: i,
      availableCount,
      maybeCount,
      unavailableCount,
      score,
    });
  }

  // Sort by score descending
  aggregation.sort((a, b) => b.score - a.score);

  return c.json({ aggregation });
});

// Update participant response
app.put('/events/:id/responses/:responseId', async (c) => {
  const eventId = c.req.param('id');
  const responseId = c.req.param('responseId');
  const body: CreateResponseRequest = await c.req.json();

  // Check if response exists and belongs to this event
  const responseResult = await c.env.DB.prepare(
    'SELECT id FROM responses WHERE id = ? AND event_id = ?'
  ).bind(responseId, eventId).first();

  if (!responseResult) {
    return c.json({ error: 'Response not found' }, 404);
  }

  // Update participant name
  await c.env.DB.prepare(
    'UPDATE responses SET participant_name = ? WHERE id = ?'
  ).bind(body.participantName, responseId).run();

  // Delete old slots and insert new ones
  await c.env.DB.prepare(
    'DELETE FROM response_slots WHERE response_id = ?'
  ).bind(responseId).run();

  for (const slot of body.slots) {
    await c.env.DB.prepare(
      'INSERT INTO response_slots (response_id, slot_start, slot_end, availability) VALUES (?, ?, ?, ?)'
    ).bind(responseId, slot.start, slot.end, slot.availability).run();
  }

  return c.json({ success: true });
});

// Delete participant response
app.delete('/events/:id/responses/:responseId', async (c) => {
  const eventId = c.req.param('id');
  const responseId = c.req.param('responseId');

  // Check if response exists and belongs to this event
  const responseResult = await c.env.DB.prepare(
    'SELECT id FROM responses WHERE id = ? AND event_id = ?'
  ).bind(responseId, eventId).first();

  if (!responseResult) {
    return c.json({ error: 'Response not found' }, 404);
  }

  // Delete response slots first (foreign key)
  await c.env.DB.prepare(
    'DELETE FROM response_slots WHERE response_id = ?'
  ).bind(responseId).run();

  // Delete response
  await c.env.DB.prepare(
    'DELETE FROM responses WHERE id = ?'
  ).bind(responseId).run();

  return c.json({ success: true });
});

// Confirm event slots
app.post('/events/:id/confirm', async (c) => {
  const eventId = c.req.param('id');
  const token = c.req.query('token');
  const body: ConfirmEventRequest = await c.req.json();

  if (!token) {
    return c.json({ error: 'Token required' }, 401);
  }

  const eventResult = await c.env.DB.prepare(
    'SELECT edit_token FROM events WHERE id = ?'
  ).bind(eventId).first<any>();

  if (!eventResult || token !== eventResult.edit_token) {
    return c.json({ error: 'Invalid edit token' }, 403);
  }

  await c.env.DB.prepare(
    'UPDATE events SET confirmed_slots = ? WHERE id = ?'
  ).bind(JSON.stringify(body.confirmedSlots), eventId).run();

  return c.json({ success: true });
});

export const onRequest = handle(app);
