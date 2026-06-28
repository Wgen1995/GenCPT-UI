import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { existsSync, statSync } from 'node:fs';
import { getSession, listSessions } from '../services/sessionService.js';
import { importSession } from '../services/importService.js';

export function createSessionsRoute(db: Database.Database, artifactRoot: string): Hono {
  const route = new Hono();

  route.get('/sessions', (c) => c.json(listSessions(db)));

  route.get('/sessions/:id', (c) => {
    const id = c.req.param('id');
    const session = getSession(db, id);
    if (!session) return c.json({ error: 'session not found' }, 404);
    return c.json(session);
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