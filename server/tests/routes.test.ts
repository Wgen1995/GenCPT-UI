import Database from 'better-sqlite3';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { applySchema } from '../src/db/schema.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/loadConfig.js';
import { discoverGenCptHome } from '../src/services/environmentService.js';
import { createSession } from '../src/services/sessionService.js';
import { join } from 'node:path';

describe('app routes', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    applySchema(db);
  });

  afterEach(() => {
    db.close();
  });

  function makeConfig() {
    const configPath = join(
      process.cwd(),
      '..',
      'config',
      'gencpt-workbench.example.yaml'
    );
    const config = loadConfig(configPath);
    if (!config.gencpt.home) {
      const home = discoverGenCptHome({ cwd: process.cwd(), env: process.env });
      if (home) config.gencpt.home = home;
    }
    return config;
  }

  it('GET /api/health returns ok', async () => {
    const app = createApp({ db, config: makeConfig() });
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.service).toBe('gencpt-workbench');
  });

  it('GET /api/assets returns GenCPT asset index', async () => {
    const app = createApp({ db, config: makeConfig() });
    const res = await app.request('/api/assets');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.entrySkill).toBeDefined();
    expect(json.childSkills.length).toBeGreaterThanOrEqual(15);
  });

  it('GET /api/sessions returns list (initially empty)', async () => {
    const app = createApp({ db, config: makeConfig() });
    const res = await app.request('/api/sessions');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });

  it('GET /api/dashboard returns view model with assets and sessions', async () => {
    const app = createApp({ db, config: makeConfig() });
    const res = await app.request('/api/dashboard');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.assets).toBeDefined();
    expect(Array.isArray(json.sessions)).toBe(true);
    expect(json.currentSession).toBeNull();
  });

  it('GET /api/sessions/:id/<slice> returns 404 for unknown session', async () => {
    const app = createApp({ db, config: makeConfig() });
    const res = await app.request('/api/sessions/nonexistent-id/graph');
    expect(res.status).toBe(404);
  });

  it('GET /api/sessions/:id/<slice> returns summary slice for stored session', async () => {
    const session = createSession(db, {
      source: 'imported',
      server: 'srv1',
      mode: 'fast',
      scope: 'k8s',
      approval: 'standard',
      summary: {
        graph: { nodes: 3, edges: 1 },
        warnings: [{ level: 'info', message: 'ok' }],
        reports: [{ name: 'pentest_report.md' }],
        insights: ['insight-1']
      }
    });
    const app = createApp({ db, config: makeConfig() });

    const graphRes = await app.request(`/api/sessions/${session.id}/graph`);
    expect(graphRes.status).toBe(200);
    const graphJson = await graphRes.json();
    expect(graphJson.graph).toEqual({ nodes: 3, edges: 1 });

    const qgRes = await app.request(`/api/sessions/${session.id}/quality-gates`);
    expect(qgRes.status).toBe(200);
    const qgJson = await qgRes.json();
    expect(Array.isArray(qgJson.warnings)).toBe(true);
    expect(qgJson.warnings.length).toBe(1);

    const reportsRes = await app.request(`/api/sessions/${session.id}/reports`);
    expect(reportsRes.status).toBe(200);
    const reportsJson = await reportsRes.json();
    expect(reportsJson.reports.length).toBe(1);
    expect(reportsJson.insights).toEqual(['insight-1']);
  });
});