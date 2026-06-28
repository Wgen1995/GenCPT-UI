import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { existsSync, statSync } from 'node:fs';
import { getSession, listSessions, updateSessionStatus } from '../services/sessionService.js';
import { importSession } from '../services/importService.js';
import { stopSession } from '../services/runService.js';
import { appendEvent } from '../services/eventService.js';

export function createSessionsRoute(db: Database.Database, artifactRoot: string): Hono {
  const route = new Hono();

  route.get('/sessions', (c) => c.json(listSessions(db)));

  route.get('/sessions/:id', (c) => {
    const id = c.req.param('id');
    const session = getSession(db, id);
    if (!session) return c.json({ error: 'session not found' }, 404);
    return c.json(session);
  });

  route.post('/sessions/:id/stop', (c) => {
    const id = c.req.param('id');
    const session = getSession(db, id);
    if (!session) return c.json({ error: 'session not found' }, 404);
    if (session.status !== 'running') return c.json({ error: 'session is not running' }, 400);

    const stopped = stopSession(id);
    if (stopped) {
      updateSessionStatus(db, id, 'failed');
      appendEvent(db, { sessionId: id, eventType: 'session.stopped', payload: { reason: 'user requested' } });
      return c.json({ status: 'stopped' });
    }
    return c.json({ error: 'no running process found for this session' }, 404);
  });

  route.post('/sessions/import', async (c) => {
    let body: { sessionDir?: string } = {};
    try {
      body = (await c.req.json()) as { sessionDir?: string };
    } catch {
      body = {};
    }
    const sessionDir = typeof body.sessionDir === 'string' ? body.sessionDir.trim() : '';
    if (!sessionDir) {
      return c.json({ error: 'sessionDir is required' }, 400);
    }
    if (!existsSync(sessionDir) || !statSync(sessionDir).isDirectory()) {
      return c.json({ error: 'session directory not found' }, 400);
    }
    const result = importSession(db, { sessionDir, artifactRoot });
    return c.json(result, 201);
  });

  return route;
}