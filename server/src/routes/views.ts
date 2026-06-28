import type Database from 'better-sqlite3';
import { Hono } from 'hono';
import { scanGenCptAssets } from '../services/assetScanner.js';
import {
  getSessionViewModel,
  getDashboardViewModel
} from '../services/viewModels.js';

export function createViewsRoute(
  db: Database.Database,
  gencptHome: string
): Hono {
  const route = new Hono();

  route.get('/dashboard', (c) => {
    return c.json(getDashboardViewModel(db, gencptHome));
  });

  route.get('/sessions/:id/dashboard', (c) => {
    return c.json(getDashboardViewModel(db, gencptHome, c.req.param('id')));
  });

  route.get('/sessions/:id/candidate-panorama', (c) => {
    const vm = getSessionViewModel(db, c.req.param('id'));
    if (!vm) return c.json({ error: 'session not found' }, 404);
    return c.json({
      sessionId: vm.session.id,
      summary: vm.summary,
      assets: scanGenCptAssets(gencptHome)
    });
  });

  route.get('/sessions/:id/quality-gates', (c) => {
    const vm = getSessionViewModel(db, c.req.param('id'));
    if (!vm) return c.json({ error: 'session not found' }, 404);
    return c.json({
      sessionId: vm.session.id,
      summary: vm.summary,
      warnings: vm.summary?.warnings ?? []
    });
  });

  route.get('/sessions/:id/tool-assets', (c) => {
    return c.json(scanGenCptAssets(gencptHome));
  });

  route.get('/sessions/:id/graph', (c) => {
    const vm = getSessionViewModel(db, c.req.param('id'));
    if (!vm) return c.json({ error: 'session not found' }, 404);
    return c.json({ graph: vm.summary?.graph ?? null });
  });

  route.get('/sessions/:id/compliance', (c) => {
    const vm = getSessionViewModel(db, c.req.param('id'));
    if (!vm) return c.json({ error: 'session not found' }, 404);
    return c.json({ compliance: vm.summary?.compliance ?? null });
  });

  route.get('/sessions/:id/tri-library', (c) => {
    const vm = getSessionViewModel(db, c.req.param('id'));
    if (!vm) return c.json({ error: 'session not found' }, 404);
    return c.json({ triLibrary: vm.summary?.triLibrary ?? null });
  });

  route.get('/sessions/:id/attacks', (c) => {
    const vm = getSessionViewModel(db, c.req.param('id'));
    if (!vm) return c.json({ error: 'session not found' }, 404);
    return c.json({ attacks: vm.summary?.attacks ?? null });
  });

  route.get('/sessions/:id/chains', (c) => {
    const vm = getSessionViewModel(db, c.req.param('id'));
    if (!vm) return c.json({ error: 'session not found' }, 404);
    return c.json({ chains: vm.summary?.chains ?? null });
  });

  route.get('/sessions/:id/coverage', (c) => {
    const vm = getSessionViewModel(db, c.req.param('id'));
    if (!vm) return c.json({ error: 'session not found' }, 404);
    return c.json({ coverage: vm.summary?.coverage ?? null });
  });

  route.get('/sessions/:id/poc', (c) => {
    const vm = getSessionViewModel(db, c.req.param('id'));
    if (!vm) return c.json({ error: 'session not found' }, 404);
    return c.json({ poc: vm.summary?.poc ?? null });
  });

  route.get('/sessions/:id/reports', (c) => {
    const vm = getSessionViewModel(db, c.req.param('id'));
    if (!vm) return c.json({ error: 'session not found' }, 404);
    return c.json({
      reports: vm.summary?.reports ?? [],
      insights: vm.summary?.insights ?? []
    });
  });

  route.get('/sessions/:id/evolution', (c) => {
    const vm = getSessionViewModel(db, c.req.param('id'));
    if (!vm) return c.json({ error: 'session not found' }, 404);
    return c.json({ evolution: vm.summary?.evolution ?? null });
  });

  route.get('/sessions/:id/baseline', (c) => {
    const vm = getSessionViewModel(db, c.req.param('id'));
    if (!vm) return c.json({ error: 'session not found' }, 404);
    return c.json({ baseline: vm.summary?.baseline ?? null });
  });

  return route;
}