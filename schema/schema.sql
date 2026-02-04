-- Events table
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  edit_token TEXT NOT NULL,
  view_token TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  confirmed_slots TEXT,
  webhook_url TEXT,
  timezone TEXT DEFAULT 'Asia/Tokyo',
  mode TEXT DEFAULT 'datetime' CHECK(mode IN ('dateonly', 'datetime'))
);

-- Event slots (30-minute slots)
CREATE TABLE IF NOT EXISTS event_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Participant responses
CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Response slots (availability for each slot)
CREATE TABLE IF NOT EXISTS response_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id INTEGER NOT NULL,
  slot_start INTEGER NOT NULL,
  slot_end INTEGER NOT NULL,
  availability TEXT NOT NULL CHECK(availability IN ('available', 'maybe', 'unavailable')),
  FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_slots_event_id ON event_slots(event_id);
CREATE INDEX IF NOT EXISTS idx_responses_event_id ON responses(event_id);
CREATE INDEX IF NOT EXISTS idx_response_slots_response_id ON response_slots(response_id);
