import { Hono } from 'hono';

export function createHealthRoute(): Hono {
  const route = new Hono();
  route.get('/health', (c) =>
    c.json({ status: 'ok', service: 'gencpt-workbench' })
  );
  return route;
}