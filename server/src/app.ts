import type Database from 'better-sqlite3';
import { Hono } from 'hono';
import type { WorkbenchConfig } from './domain/types.js';
import { createHealthRoute } from './routes/health.js';
import { createEnvironmentRoute } from './routes/environment.js';
import { createAssetsRoute } from './routes/assets.js';
import { createSessionsRoute } from './routes/sessions.js';
import { createEventsRoute } from './routes/events.js';
import { createArtifactsRoute } from './routes/artifacts.js';
import { createRunRoute } from './routes/run.js';
import { createViewsRoute } from './routes/views.js';
import { discoverGenCptHome } from './services/environmentService.js';

export type AppConfig = {
  db: Database.Database;
  config: WorkbenchConfig;
};

export function createApp(appConfig: AppConfig): Hono {
  const app = new Hono();
  const { db, config } = appConfig;

  const gencptHome =
    config.gencpt.home ??
    discoverGenCptHome({ cwd: process.cwd(), env: process.env }) ??
    '';

  app.route('/api', createHealthRoute());
  app.route('/api', createEnvironmentRoute(config));
  app.route('/api', createAssetsRoute(config));
  app.route('/api', createSessionsRoute(db, config.storage.artifactDir));
  app.route('/api', createEventsRoute(db));
  app.route('/api', createArtifactsRoute(db));
  app.route(
    '/api',
    createRunRoute(db, {
      gencptPath: gencptHome,
      opencodeCommand: config.opencode.command,
      sessionRoot: config.gencpt.sessionRoot,
      artifactRoot: config.storage.artifactDir
    })
  );
  app.route('/api', createViewsRoute(db, gencptHome));

  return app;
}