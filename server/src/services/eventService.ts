import type Database from 'better-sqlite3';

export type Event = {
  id: number;
  sessionId: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export type AppendEventInput = {
  sessionId: string;
  eventType: string;
  payload?: Record<string, unknown>;
};

type EventRow = {
  id: number;
  session_id: string;
  event_type: string;
  payload_json: string | null;
  created_at: string;
};

function safeParse(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function rowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    sessionId: row.session_id,
    eventType: row.event_type,
    payload: safeParse(row.payload_json),
    createdAt: row.created_at
  };
}

export function appendEvent(db: Database.Database, input: AppendEventInput): Event {
  const now = new Date().toISOString();
  const payloadJson = input.payload ? JSON.stringify(input.payload) : null;
  const info = db
    .prepare(
      'INSERT INTO events (session_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)'
    )
    .run(input.sessionId, input.eventType, payloadJson, now);
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid) as EventRow;
  return rowToEvent(row);
}

export function listEvents(db: Database.Database, sessionId: string, afterId?: number): Event[] {
  const sql = afterId != null
    ? 'SELECT * FROM events WHERE session_id = ? AND id > ? ORDER BY id ASC'
    : 'SELECT * FROM events WHERE session_id = ? ORDER BY created_at ASC';
  const rows = afterId != null
    ? db.prepare(sql).all(sessionId, afterId) as EventRow[]
    : db.prepare(sql).all(sessionId) as EventRow[];
  return rows.map(rowToEvent);
}