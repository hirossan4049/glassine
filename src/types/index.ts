export type Availability = 'available' | 'maybe' | 'unavailable';

export type EventMode = 'dateonly' | 'datetime';

export interface TimeSlot {
  start: number; // Unix timestamp
  end: number;   // Unix timestamp
}

export interface EventSlot extends TimeSlot {
  id?: number;
}

export interface ResponseSlot extends TimeSlot {
  availability: Availability;
}

export interface ParticipantResponse {
  id?: number;
  eventId: string;
  participantName: string;
  createdAt: number;
  slots: ResponseSlot[];
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  editToken: string;
  viewToken: string;
  webhookUrl?: string;
  createdAt: number;
  confirmedSlots?: string; // JSON string of confirmed slot indices
  timezone: string;
  mode: EventMode;
  slots: EventSlot[];
  responses?: ParticipantResponse[];
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  slots: TimeSlot[];
  timezone?: string;
  mode?: EventMode;
  webhookUrl?: string;
}

export interface CreateResponseRequest {
  participantName: string;
  slots: ResponseSlot[];
}

export interface ConfirmEventRequest {
  confirmedSlots: number[]; // Indices of confirmed slots
}

export interface SlotAggregation {
  slot: EventSlot;
  index: number;
  availableCount: number;
  maybeCount: number;
  unavailableCount: number;
  score: number; // Higher is better
}

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
}
