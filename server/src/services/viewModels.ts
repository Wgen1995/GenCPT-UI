import type Database from 'better-sqlite3';
import { scanGenCptAssets } from './assetScanner.js';
import { getSession, listSessions } from './sessionService.js';
import { listEvents } from './eventService.js';
import { listArtifacts } from './artifactService.js';
import type { AssetIndex } from '../domain/types.js';

export type SessionSummary = {
  graph?: unknown;
  compliance?: unknown;
  triLibrary?: unknown;
  attacks?: unknown;
  chains?: unknown;
  coverage?: unknown;
  poc?: unknown;
  reports?: unknown[];
  insights?: unknown[];
  evolution?: unknown;
  baseline?: unknown;
  warnings?: unknown[];
} & Record<string, unknown>;

export type DashboardViewModel = {
  assets: AssetIndex;
  sessions: ReturnType<typeof listSessions>;
  currentSession: ReturnType<typeof getSession> | null;
};

export type SessionViewModel = {
  session: { id: string; status: string; [k: string]: unknown };
  events: ReturnType<typeof listEvents>;
  artifacts: ReturnType<typeof listArtifacts>;
  summary: SessionSummary | null;
  noData?: boolean;
};

export function getDashboardViewModel(
  db: Database.Database,
  gencptHome: string,
  sessionId?: string
): DashboardViewModel {
  const assets = scanGenCptAssets(gencptHome);
  const sessions = listSessions(db);
  let currentSession: ReturnType<typeof getSession> = null;
  if (sessionId && sessionId !== '_') {
    currentSession = getSession(db, sessionId);
  } else if (sessionId === '_') {
    currentSession = null;
  } else if (sessions.length > 0) {
    currentSession = sessions[0];
  }
  return { assets, sessions, currentSession };
}

export function getSessionViewModel(
  db: Database.Database,
  sessionId: string
): SessionViewModel | null {
  if (sessionId === '_') {
    return {
      session: { id: '_', status: 'pending' } as any,
      events: [],
      artifacts: [],
      summary: null
    };
  }
  const session = getSession(db, sessionId);
  if (!session) return null;
  const events = listEvents(db, sessionId);
  const artifacts = listArtifacts(db, sessionId);
  const summary = (session.summary ?? null) as SessionSummary | null;
  return { session, events, artifacts, summary };
}