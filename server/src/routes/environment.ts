import { Hono } from 'hono';
import type { WorkbenchConfig } from '../domain/types.js';
import { checkEnvironment, discoverGenCptHome } from '../services/environmentService.js';

export function createEnvironmentRoute(config: WorkbenchConfig): Hono {
  const route = new Hono();

  const resolveResult = () => {
    const home = config.gencpt.home ?? discoverGenCptHome({ cwd: process.cwd(), env: process.env }) ?? '';
    return checkEnvironment({
      opencodeCommand: config.opencode.command,
      gencptHome: home,
      artifactDir: config.storage.artifactDir,
      sessionRoot: config.gencpt.sessionRoot
    });
  };

  route.get('/environment', (c) => c.json(resolveResult()));

  route.post('/environment/rescan', (c) => c.json(resolveResult()));

  route.post('/environment', async (c) => {
    let body: Record<string, unknown> = {};
    try { body = await c.req.json() as Record<string, unknown>; } catch { return c.json({ error: 'invalid JSON' }, 400); }
    if (body?.gencptHome && typeof body.gencptHome === 'string') {
      config.gencpt.home = body.gencptHome;
      return c.json(resolveResult());
    }
    return c.json({ error: 'gencptHome required' }, 400);
  });

  return route;
}