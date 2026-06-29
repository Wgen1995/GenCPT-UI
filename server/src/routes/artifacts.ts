import type Database from 'better-sqlite3';
import { Hono } from 'hono';
import { resolve } from 'node:path';
import { listArtifacts, getArtifactContent } from '../services/artifactService.js';
import { getSession } from '../services/sessionService.js';

export function createArtifactsRoute(db: Database.Database): Hono {
  const route = new Hono();

  route.get('/sessions/:id/artifacts', (c) => {
    const sessionId = c.req.param('id');
    if (sessionId === '_') return c.json([]);
    if (!getSession(db, sessionId)) return c.json({ error: 'session not found' }, 404);
    return c.json(listArtifacts(db, sessionId));
  });

  route.get('/sessions/:id/artifacts/content', (c) => {
    const sessionId = c.req.param('id');
    if (sessionId === '_') return c.json({ error: 'no session' }, 404);
    const relativePath = c.req.query('path');
    if (!relativePath) return c.json({ error: 'path (relative) required' }, 400);

    const session = getSession(db, sessionId);
    if (!session) return c.json({ error: 'session not found' }, 404);
    if (!session.archivedDir) return c.json({ error: 'session not archived' }, 400);

    const basePath = resolve(session.archivedDir);
    const targetPath = resolve(basePath, relativePath);

    if (targetPath !== basePath && !targetPath.startsWith(basePath + '/')) {
      return c.json({ error: 'path outside archive' }, 403);
    }

    const artifacts = listArtifacts(db, sessionId);
    const found = artifacts.find((a) => a.relativePath === relativePath);
    if (!found) return c.json({ error: 'artifact not found' }, 404);

    if (resolve(found.absolutePath) !== targetPath) {
      return c.json({ error: 'artifact path mismatch' }, 403);
    }

    try {
      const content = getArtifactContent(found.absolutePath);
      return c.text(content);
    } catch {
      return c.json({ error: 'cannot read file' }, 500);
    }
  });

  return route;
}