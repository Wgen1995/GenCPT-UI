import { Hono } from 'hono';
import type { WorkbenchConfig } from '../domain/types.js';
import { discoverGenCptHome } from '../services/environmentService.js';
import { scanGenCptAssets } from '../services/assetScanner.js';

export function createAssetsRoute(config: WorkbenchConfig): Hono {
  const route = new Hono();

  const resolveHome = () =>
    config.gencpt.home ??
    discoverGenCptHome({ cwd: process.cwd(), env: process.env }) ??
    '';

  const scan = () => {
    const home = resolveHome();
    return scanGenCptAssets(home);
  };

  route.get('/assets', (c) => c.json(scan()));

  route.post('/assets/rescan', (c) => c.json(scan()));

  route.post('/assets', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (body?.gencptHome && typeof body.gencptHome === 'string') {
      return c.json(scanGenCptAssets(body.gencptHome));
    }
    return c.json({ error: 'gencptHome required' }, 400);
  });

  return route;
}