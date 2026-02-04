import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { Resvg } from '@cf-wasm/resvg';
import type { Env, Event, CreateEventRequest, CreateResponseRequest, ConfirmEventRequest, SlotAggregation, Availability, ParticipantResponse, ResponseSlot } from '../../src/types';

const app = new Hono<{ Bindings: Env }>().basePath('/api');

// Generate cryptographically secure random tokens
function generateToken(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('').substring(0, length);
}

function formatForGoogleCalendar(date: Date, isAllDay: boolean): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  if (isAllDay) {
    return `${year}${month}${day}`;
  }
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function isDiscordWebhook(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'discord.com' && parsed.pathname.startsWith('/api/webhooks/');
  } catch {
    return false;
  }
}

function isSlackWebhook(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'hooks.slack.com' && parsed.pathname.startsWith('/services/');
  } catch {
    return false;
  }
}

function buildSlackBlocks({
  title,
  description,
  url,
  footer,
  fields,
  imageUrl,
}: {
  title: string;
  description?: string;
  url?: string;
  footer?: string;
  fields?: { name: string; value: string }[];
  imageUrl?: string;
}) {
  const blocks: any[] = [];

  // Header
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: title,
      emoji: true,
    },
  });

  // Description section with link
  if (description || url) {
    const text = description
      ? url
        ? `${description}\n\n<${url}|イベントを見る>`
        : description
      : url
        ? `<${url}|イベントを見る>`
        : '';
    if (text) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text,
        },
      });
    }
  }

  // Fields
  if (fields && fields.length > 0) {
    blocks.push({
      type: 'section',
      fields: fields.map((f) => ({
        type: 'mrkdwn',
        text: `*${f.name}*\n${f.value}`,
      })),
    });
  }

  // Image
  if (imageUrl) {
    blocks.push({
      type: 'image',
      image_url: imageUrl,
      alt_text: title,
    });
  }

  // Footer context
  if (footer) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: footer,
        },
      ],
    });
  }

  return blocks;
}

function buildGoogleCalendarLink({
  title,
  description,
  start,
  end,
  timezone,
  isAllDay,
}: {
  title: string;
  description?: string | null;
  start: Date;
  end: Date;
  timezone: string;
  isAllDay: boolean;
}): string {
  const startStr = formatForGoogleCalendar(start, isAllDay);
  const endStr = formatForGoogleCalendar(end, isAllDay);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details: description || '',
    dates: `${startStr}/${endStr}`,
    ctz: timezone,
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

function buildDiscordEmbed({
  title,
  description,
  url,
  footer,
  fields,
  imageUrl,
}: {
  title: string;
  description?: string;
  url?: string;
  footer?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  imageUrl?: string;
}) {
  return {
    title,
    description,
    url,
    color: 0x667eea,
    fields,
    footer: footer ? { text: footer } : undefined,
    image: imageUrl ? { url: imageUrl } : undefined,
  };
}

function formatHumanRange(start: Date, end: Date, timezone: string, isAllDay: boolean): string {
  if (isAllDay) {
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    }).format(start);
  }
  const fmtDate = new Intl.DateTimeFormat('ja-JP', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(start);
  const fmtTime = new Intl.DateTimeFormat('ja-JP', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${fmtDate} ${fmtTime.format(start)} - ${fmtTime.format(end)} (${timezone})`;
}

// Create event
app.post('/events', async (c) => {
  const body: CreateEventRequest = await c.req.json();
  const eventId = generateToken(16);
  const editToken = generateToken();
  const viewToken = generateToken();
  const createdAt = Date.now();

  const { title, description, slots, timezone = 'Asia/Tokyo', mode = 'datetime', webhookUrl } = body;

  // Insert event
  await c.env.DB.prepare(
    'INSERT INTO events (id, title, description, edit_token, view_token, created_at, webhook_url, timezone, mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(eventId, title, description || null, editToken, viewToken, createdAt, webhookUrl || null, timezone, mode).run();

  // Insert slots using batch (optimized from loop INSERT)
  if (slots.length > 0) {
    const slotStatements = slots.map(slot =>
      c.env.DB.prepare('INSERT INTO event_slots (event_id, start_time, end_time) VALUES (?, ?, ?)')
        .bind(eventId, slot.start, slot.end)
    );
    await c.env.DB.batch(slotStatements);
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

  // Get responses with slots in a single JOIN query (optimized from N+1)
  const responsesWithSlots = await c.env.DB.prepare(
    `SELECT r.id, r.event_id, r.participant_name, r.created_at,
            rs.slot_start, rs.slot_end, rs.availability
     FROM responses r
     LEFT JOIN response_slots rs ON r.id = rs.response_id
     WHERE r.event_id = ?
     ORDER BY r.created_at DESC, rs.slot_start`
  ).bind(eventId).all<any>();

  // Group results by response
  const responsesMap = new Map<number, ParticipantResponse>();

  for (const row of responsesWithSlots.results || []) {
    if (!responsesMap.has(row.id)) {
      responsesMap.set(row.id, {
        id: row.id,
        eventId: row.event_id,
        participantName: row.participant_name,
        createdAt: row.created_at,
        slots: [],
      });
    }
    if (row.slot_start !== null) {
      const slot: ResponseSlot = {
        start: row.slot_start,
        end: row.slot_end,
        availability: row.availability as Availability,
      };
      responsesMap.get(row.id)!.slots.push(slot);
    }
  }

  const responses = Array.from(responsesMap.values());

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
    webhookUrl: eventResult.webhook_url || undefined,
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

  // Insert response slots using batch (optimized from loop INSERT)
  if (body.slots.length > 0) {
    const slotStatements = body.slots.map(slot =>
      c.env.DB.prepare('INSERT INTO response_slots (response_id, slot_start, slot_end, availability) VALUES (?, ?, ?, ?)')
        .bind(responseId, slot.start, slot.end, slot.availability)
    );
    await c.env.DB.batch(slotStatements);
  }

  const webhookResult = await c.env.DB.prepare(
    'SELECT webhook_url, title, view_token, mode, timezone FROM events WHERE id = ?'
  ).bind(eventId).first<any>();

  if (webhookResult?.webhook_url) {
    const origin = new URL(c.req.url).origin;
    const viewUrl = `${origin}/v/${eventId}?token=${webhookResult.view_token}`;
    const ogImage = `${origin}/api/events/${eventId}/og`;
    const isDiscord = isDiscordWebhook(webhookResult.webhook_url);
    const isSlack = isSlackWebhook(webhookResult.webhook_url);
    let payload: any;
    if (isDiscord) {
      payload = {
        content: `新しい回答が届きました`,
        embeds: [
          buildDiscordEmbed({
            title: webhookResult.title || 'イベント',
            description: `${body.participantName} さんが回答しました。`,
            url: viewUrl,
            fields: [
              {
                name: '回答者',
                value: body.participantName,
                inline: true,
              },
            ],
            imageUrl: ogImage,
          }),
        ],
      };
    } else if (isSlack) {
      payload = {
        text: `新しい回答: ${body.participantName} さんが "${webhookResult.title}" に回答しました`,
        blocks: buildSlackBlocks({
          title: webhookResult.title || 'イベント',
          description: `${body.participantName} さんが回答しました。`,
          url: viewUrl,
          fields: [
            {
              name: '回答者',
              value: body.participantName,
            },
          ],
          imageUrl: ogImage,
        }),
      };
    } else {
      payload = {
        text: `新しい回答: ${body.participantName} さんが "${webhookResult.title}" に回答しました`,
      };
    }
    try {
      await fetch(webhookResult.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Webhook dispatch failed for URL:', webhookResult.webhook_url, err);
    }
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

  // Get aggregated counts in a single query (optimized from O(slots × responses) queries)
  const aggregationResult = await c.env.DB.prepare(
    `SELECT es.id, es.start_time, es.end_time,
            COALESCE(SUM(CASE WHEN rs.availability = 'available' THEN 1 ELSE 0 END), 0) as available_count,
            COALESCE(SUM(CASE WHEN rs.availability = 'maybe' THEN 1 ELSE 0 END), 0) as maybe_count,
            COALESCE(SUM(CASE WHEN rs.availability = 'unavailable' THEN 1 ELSE 0 END), 0) as unavailable_count
     FROM event_slots es
     LEFT JOIN responses r ON r.event_id = es.event_id
     LEFT JOIN response_slots rs ON rs.response_id = r.id AND es.start_time = rs.slot_start AND es.end_time = rs.slot_end
     WHERE es.event_id = ?
     GROUP BY es.id, es.start_time, es.end_time
     ORDER BY es.start_time`
  ).bind(eventId).all<any>();

  const aggregation: SlotAggregation[] = (aggregationResult.results || []).map((row: any, index: number) => ({
    slot: { id: row.id, start: row.start_time, end: row.end_time },
    index,
    availableCount: row.available_count,
    maybeCount: row.maybe_count,
    unavailableCount: row.unavailable_count,
    score: row.available_count * 2 + row.maybe_count * 1,
  }));

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

  // Delete old slots and insert new ones using batch (optimized from loop INSERT)
  await c.env.DB.prepare(
    'DELETE FROM response_slots WHERE response_id = ?'
  ).bind(responseId).run();

  if (body.slots.length > 0) {
    const slotStatements = body.slots.map(slot =>
      c.env.DB.prepare('INSERT INTO response_slots (response_id, slot_start, slot_end, availability) VALUES (?, ?, ?, ?)')
        .bind(responseId, slot.start, slot.end, slot.availability)
    );
    await c.env.DB.batch(slotStatements);
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

// Generate OGP image for event (PNG)
app.get('/events/:id/og', async (c) => {
  const eventId = c.req.param('id');

  const eventResult = await c.env.DB.prepare(
    'SELECT title, description, mode FROM events WHERE id = ?'
  ).bind(eventId).first<any>();

  if (!eventResult) {
    return c.text('Event not found', 404);
  }

  const title = eventResult.title || 'イベント';
  const description = eventResult.description || '';
  const mode = eventResult.mode === 'dateonly' ? '日程調整' : '日時調整';

  // Escape XML entities
  const escapeXml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  // Truncate for display
  const displayTitle = title.length > 18 ? title.substring(0, 18) + '...' : title;
  const displayDesc = description.length > 35 ? description.substring(0, 35) + '...' : description;

  try {
    // Fetch Japanese font
    const fontData = await fetch(
      'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-jp@latest/japanese-500-normal.woff2'
    ).then(res => res.arrayBuffer());

    // Generate SVG with the loaded font
    const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/>
      <stop offset="100%" style="stop-color:#764ba2"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="40" y="40" width="1120" height="550" rx="20" fill="white" fill-opacity="0.95"/>

  <!-- App name and mode -->
  <text x="100" y="120" font-family="Noto Sans JP" font-size="36" fill="#667eea" font-weight="500">Glassine</text>
  <text x="270" y="120" font-family="Noto Sans JP" font-size="28" fill="#888"> - ${escapeXml(mode)}</text>

  <!-- Title -->
  <text x="100" y="280" font-family="Noto Sans JP" font-size="64" fill="#333" font-weight="500">${escapeXml(displayTitle)}</text>

  <!-- Description -->
  ${displayDesc ? `<text x="100" y="360" font-family="Noto Sans JP" font-size="32" fill="#666">${escapeXml(displayDesc)}</text>` : ''}
</svg>`;

    // Convert SVG to PNG using @cf-wasm/resvg with font
    const resvg = new Resvg(svg, {
      font: {
        fontBuffers: [new Uint8Array(fontData)],
      },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return new Response(pngBuffer.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('OGP generation error:', error);
    // Fallback to simple SVG if PNG generation fails
    const fallbackSvg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="#667eea"/>
      <text x="600" y="315" font-size="48" fill="white" text-anchor="middle">${escapeXml(title)}</text>
    </svg>`;
    return new Response(fallbackSvg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
});

// Get event info for OGP (public, no token required)
app.get('/events/:id/info', async (c) => {
  const eventId = c.req.param('id');

  const eventResult = await c.env.DB.prepare(
    'SELECT title, description, mode FROM events WHERE id = ?'
  ).bind(eventId).first<any>();

  if (!eventResult) {
    return c.json({ error: 'Event not found' }, 404);
  }

  return c.json({
    title: eventResult.title,
    description: eventResult.description,
    mode: eventResult.mode,
  });
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

  const webhookResult = await c.env.DB.prepare(
    'SELECT webhook_url, title, description, mode, view_token, timezone FROM events WHERE id = ?'
  ).bind(eventId).first<any>();

  if (webhookResult?.webhook_url) {
    const isAllDay = webhookResult.mode === 'dateonly';
    const confirmed = body.confirmedSlots[0];
    let timeText = '';
    let googleCalUrl = '';
    let humanRange = '';
    if (confirmed !== undefined) {
      const slot = await c.env.DB.prepare(
        'SELECT start_time, end_time FROM event_slots WHERE event_id = ? ORDER BY start_time LIMIT 1 OFFSET ?'
      ).bind(eventId, confirmed).first<any>();
      if (slot) {
        const startDate = new Date(slot.start_time);
        const endDate = new Date(slot.end_time);
        const start = formatForGoogleCalendar(startDate, isAllDay);
        const end = formatForGoogleCalendar(endDate, isAllDay);
        timeText = `${start} - ${end}`;
        humanRange = formatHumanRange(startDate, endDate, webhookResult.timezone || 'UTC', isAllDay);
        googleCalUrl = buildGoogleCalendarLink({
          title: webhookResult.title || 'イベント',
          description: webhookResult.description,
          start: startDate,
          end: endDate,
          timezone: webhookResult.timezone || 'UTC',
          isAllDay,
        });
      }
    }
    const origin = new URL(c.req.url).origin;
    const viewUrl = `${origin}/v/${eventId}?token=${webhookResult.view_token}`;
    const ogImage = `${origin}/api/events/${eventId}/og`;
    const isDiscord = isDiscordWebhook(webhookResult.webhook_url);
    const isSlack = isSlackWebhook(webhookResult.webhook_url);
    let payload: any;
    if (isDiscord) {
      payload = {
        content: `イベントが確定しました`,
        embeds: [
          buildDiscordEmbed({
            title: webhookResult.title || 'イベント',
            description: webhookResult.description || '',
            url: viewUrl,
            footer: humanRange || timeText ? humanRange || timeText : undefined,
            fields: [
              ...(humanRange
                ? [
                    {
                      name: '日時',
                      value: humanRange,
                      inline: false,
                    },
                  ]
                : []),
              ...(googleCalUrl
                ? [
                    {
                      name: 'Google Calendar',
                      value: `[追加する](${googleCalUrl})`,
                      inline: false,
                    },
                  ]
                : []),
            ],
            imageUrl: ogImage,
          }),
        ],
      };
    } else if (isSlack) {
      payload = {
        text: `イベントが確定しました: ${webhookResult.title}${humanRange ? ` (${humanRange})` : ''}`,
        blocks: buildSlackBlocks({
          title: webhookResult.title || 'イベント',
          description: webhookResult.description || '',
          url: viewUrl,
          fields: [
            ...(humanRange
              ? [
                  {
                    name: '日時',
                    value: humanRange,
                  },
                ]
              : []),
            ...(googleCalUrl
              ? [
                  {
                    name: 'Google Calendar',
                    value: `<${googleCalUrl}|追加する>`,
                  },
                ]
              : []),
          ],
          imageUrl: ogImage,
          footer: humanRange || undefined,
        }),
      };
    } else {
      payload = {
        text: `イベントが確定しました: ${webhookResult.title}${humanRange ? ` (${humanRange})` : ''}`,
      };
    }
    try {
      await fetch(webhookResult.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Webhook dispatch failed for URL:', webhookResult.webhook_url, err);
    }
  }

  return c.json({ success: true });
});

export const onRequest = handle(app);
