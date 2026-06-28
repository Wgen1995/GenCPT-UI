import type Database from 'better-sqlite3';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  gencpt_session_id TEXT,
  server TEXT,
  mode TEXT,
  scope TEXT,
  approval TEXT,
  original_dir TEXT,
  archived_dir TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  summary_json TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, created_at);

CREATE TABLE IF NOT EXISTS artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  absolute_path TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_artifacts_session ON artifacts(session_id);

CREATE TABLE IF NOT EXISTS asset_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gencpt_home TEXT NOT NULL,
  scanned_at TEXT NOT NULL,
  index_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export function applySchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
}