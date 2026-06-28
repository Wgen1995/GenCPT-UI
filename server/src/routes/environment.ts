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
    const body = await c.req.json();
    if (body?.gencptHome && typeof body.gencptHome === 'string') {
      const result = checkEnvironment({
        opencodeCommand: config.opencode.command,
        gencptHome: body.gencptHome,
        artifactDir: config.storage.artifactDir,
        sessionRoot: config.gencpt.sessionRoot
      });
      return c.json(result);
    }
    return c.json({ error: 'gencptHome required' }, 400);
  });

  return route;
}