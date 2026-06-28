import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export type SessionSource = 'imported' | 'started';
export type SessionStatus = 'created' | 'running' | 'completed' | 'failed' | 'archived';

export type Session = {
  id: string;
  source: SessionSource;
  status: SessionStatus;
  gencptSessionId: string | null;
  server: string | null;
  mode: string | null;
  scope: string | null;
  approval: string | null;
  originalDir: string | null;
  archivedDir: string | null;
  createdAt: string;
  updatedAt: string;
  summary: Record<string, unknown> | null;
};

export type CreateSessionInput = {
  source: SessionSource;
  server?: string;
  mode?: string;
  scope?: string;
  approval?: string;
  gencptSessionId?: string;
  originalDir?: string;
  archivedDir?: string;
  summary?: Record<string, unknown>;
};

type SessionRow = {
  id: string;
  source: string;
  status: string;
  gencpt_session_id: string | null;
  server: string | null;
  mode: string | null;
  scope: string | null;
  approval: string | null;
  original_dir: string | null;
  archived_dir: string | null;
  created_at: string;
  updated_at: string;
  summary_json: string | null;
};

function safeParse(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    source: row.source as SessionSource,
    status: row.status as SessionStatus,
    gencptSessionId: row.gencpt_session_id,
    server: row.server,
    mode: row.mode,
    scope: row.scope,
    approval: row.approval,
    originalDir: row.original_dir,
    archivedDir: row.archived_dir,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    summary: safeParse(row.summary_json)
  };
}

export function createSession(db: Database.Database, input: CreateSessionInput): Session {
  const id = randomUUID();
  const now = new Date().toISOString();
  const summaryJson = input.summary ? JSON.stringify(input.summary) : null;
  db.prepare(
    `INSERT INTO sessions (id, source, status, gencpt_session_id, server, mode, scope, approval, original_dir, archived_dir, created_at, updated_at, summary_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.source,
    'created',
    input.gencptSessionId ?? null,
    input.server ?? null,
    input.mode ?? null,
    input.scope ?? null,
    input.approval ?? null,
    input.originalDir ?? null,
    input.archivedDir ?? null,
    now,
    now,
    summaryJson
  );
  return getSession(db, id)!;
}

export function getSession(db: Database.Database, id: string): Session | null {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  return row ? rowToSession(row) : null;
}

export function listSessions(db: Database.Database): Session[] {
  const rows = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all() as SessionRow[];
  return rows.map(rowToSession);
}

export function updateSessionStatus(db: Database.Database, id: string, status: SessionStatus): void {
  const now = new Date().toISOString();
  db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
}

export function updateSessionSummary(db: Database.Database, id: string, summary: Record<string, unknown>): void {
  const now = new Date().toISOString();
  db.prepare('UPDATE sessions SET summary_json = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(summary), now, id);
}

export function updateSessionGenCptId(db: Database.Database, id: string, gencptSessionId: string): void {
  const now = new Date().toISOString();
  db.prepare('UPDATE sessions SET gencpt_session_id = ?, updated_at = ? WHERE id = ?').run(gencptSessionId, now, id);
}