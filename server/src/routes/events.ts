import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { streamSSE } from 'hono/streaming';
import { listEvents } from '../services/eventService.js';
import { getSession } from '../services/sessionService.js';

export function createEventsRoute(db: Database.Database): Hono {
  const route = new Hono();

  route.get('/sessions/:id/events', (c) => {
    const id = c.req.param('id');
    if (id !== '_' && !getSession(db, id)) return c.json({ error: 'session not found' }, 404);
    if (id === '_') return c.json([]);
    const afterId = c.req.query('afterId');
    return c.json(listEvents(db, id, afterId ? Number(afterId) : undefined));
  });

  route.get('/sessions/:id/events/stream', (c) => {
    const id = c.req.param('id');
    if (id === '_') return c.json([]);

    return streamSSE(c, async (stream) => {
      let lastEventId = 0;

      const existing = listEvents(db, id);
      for (const ev of existing) {
        await stream.writeSSE({ event: ev.eventType, data: JSON.stringify(ev) });
        if (ev.id > lastEventId) lastEventId = ev.id;
      }

      const interval = setInterval(() => {
        const events = listEvents(db, id);
        for (const ev of events) {
          if (ev.id <= lastEventId) continue;
          stream.writeSSE({ event: ev.eventType, data: JSON.stringify(ev) });
          lastEventId = ev.id;
        }
      }, 500);

      stream.onAbort(() => clearInterval(interval));
    });
  });

  return route;
}