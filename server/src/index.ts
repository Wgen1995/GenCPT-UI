import { serve } from '@hono/node-server';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { loadConfig } from './config/loadConfig.js';
import { openDatabase } from './db/client.js';
import { discoverGenCptHome } from './services/environmentService.js';
import { createApp } from './app.js';

function resolveConfigPath(): string {
  const explicit = process.env.GENCPT_WORKBENCH_CONFIG;
  if (explicit) return resolve(process.cwd(), explicit);

  let current = resolve(process.cwd());
  while (true) {
    const p1 = join(current, 'config', 'gencpt-workbench.yaml');
    if (existsSync(p1)) return p1;
    const p2 = join(current, 'config', 'gencpt-workbench.example.yaml');
    if (existsSync(p2)) return p2;
    const root = dirname(current);
    if (root === current) break;
    current = root;
  }
  return join(resolve(process.cwd()), 'config', 'gencpt-workbench.example.yaml');
}

const configPath = resolveConfigPath();
const config = loadConfig(configPath);

if (!config.gencpt.home) {
  const home = discoverGenCptHome({ cwd: dirname(configPath), env: process.env });
  if (home) config.gencpt.home = home;
}

const db = openDatabase(join(config.storage.dataDir, 'workbench.db'));
const app = createApp({ db, config });
const port = Number(process.env.PORT ?? config.server.port);
const hostname = process.env.HOST ?? config.server.host;

serve({ fetch: app.fetch, port, hostname }, () => {
  console.log(`GenCPT Workbench server listening on http://${hostname}:${port}`);
  console.log(`Config loaded from ${configPath}`);
  console.log(`GenCPT home: ${config.gencpt.home ?? 'not found'}`);
});