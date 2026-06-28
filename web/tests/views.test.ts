import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import { createPinia } from 'pinia';

import DashboardView from '../src/views/DashboardView.vue';
import LaunchImportView from '../src/views/LaunchImportView.vue';
import ExecutionView from '../src/views/ExecutionView.vue';
import CandidatePanoramaView from '../src/views/CandidatePanoramaView.vue';
import ToolAssetsView from '../src/views/ToolAssetsView.vue';
import QualityGatesView from '../src/views/QualityGatesView.vue';
import ReportsView from '../src/views/ReportsView.vue';

function makeRouter(initial = '/dashboard'): Router {
  return createRouter({
    history: createMemoryHistory(initial),
    routes: [
      { path: '/', redirect: '/dashboard' },
      { path: '/dashboard', name: 'dashboard', component: { template: '<div/>' } },
      { path: '/launch', name: 'launch', component: { template: '<div/>' } },
      { path: '/sessions/:id/execution', name: 'execution', component: { template: '<div/>' } },
      { path: '/sessions/:id/baseline', name: 'baseline', component: { template: '<div/>' } },
      { path: '/tool-assets', name: 'tool-assets', component: { template: '<div/>' } }
    ]
  });
}

function mountView(C: Parameters<typeof mount>[0], route = '/dashboard'): ReturnType<typeof mount> {
  const r = makeRouter(route);
  return mount(C, {
    global: {
      plugins: [r, createPinia()],
      stubs: {
        RouterLink: true,
        RouterView: true
      }
    }
  });
}

function emptyIndex() {
  return {
    scannedAt: '2026-01-01T00:00:00.000Z',
    gencptHome: '/tmp',
    entrySkill: { exists: true, path: '/tmp/SKILL.md' },
    childSkills: [],
    sharedSpecs: [],
    compliance: { k8s: { rules: 0, groups: 0 }, docker: { rules: 0, groups: 0 }, containerd: { rules: 0, groups: 0 }, totalRules: 0 },
    attackPatterns: [],
    hypotheses: { files: [], chkCandCount: 0, atkHypCount: 0, xrefCount: 0 },
    references: [],
    tools: { indexExists: false, path: '/tmp/tools/_index.md' },
    learnedPatterns: [],
    harnessMechanisms: []
  };
}

describe('core views smoke tests', () => {
  beforeEach(() => {
    const fetchImpl = async (url: string): Promise<Response> => {
      const u = String(url);
      if (u.startsWith('/api/dashboard')) {
        return new Response(JSON.stringify({
          assets: emptyIndex(),
          sessions: [],
          currentSession: null
        }), { status: 200 });
      }
      if (u === '/api/assets') {
        return new Response(JSON.stringify(emptyIndex()), { status: 200 });
      }
      if (u.startsWith('/api/sessions/')) {
        if (u.endsWith('/reports')) {
          return new Response(JSON.stringify({ reports: [], insights: [] }), { status: 200 });
        }
        if (u.endsWith('/quality-gates')) {
          return new Response(JSON.stringify({ verdict: 'pending', checks: [], warnings: [] }), { status: 200 });
        }
        if (u.endsWith('/candidate-panorama')) {
          return new Response(JSON.stringify({ assets: emptyIndex(), channels: [] }), { status: 200 });
        }
        if (u.endsWith('/events/stream')) {
          return new Response('{}', { status: 200 });
        }
        if (u.endsWith('/artifacts')) {
          return new Response(JSON.stringify({ artifacts: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({ id: 's1', status: 'running', server: 'h', mode: 'fast', scope: 'all' }), { status: 200 });
      }
      return new Response('ok', { status: 200 });
    };
    vi.stubGlobal('fetch', vi.fn(fetchImpl));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('DashboardView renders', async () => {
    const w = mountView(DashboardView);
    await flushPromises();
    expect(w.find('.dashboard-view').exists()).toBe(true);
  });

  it('LaunchImportView renders and switches tabs', async () => {
    const w = mountView(LaunchImportView);
    await flushPromises();
    expect(w.find('.launch-import-view').exists()).toBe(true);
    expect(w.text()).toContain('启动评估');
    const tabs = w.findAll('.tabs button');
    if (tabs.length > 1) {
      await tabs[1].trigger('click');
      expect(w.text()).toContain('导入 session');
    }
  });

  it('ExecutionView renders', async () => {
    const w = mountView(ExecutionView, '/sessions/s1/execution');
    await flushPromises();
    expect(w.find('.execution-view').exists()).toBe(true);
  });

  it('CandidatePanoramaView renders', async () => {
    const w = mountView(CandidatePanoramaView, '/sessions/s1/candidate-panorama');
    await flushPromises();
    expect(w.text()).toContain('攻击候选来源全景');
  });

  it('ToolAssetsView renders tabs', async () => {
    const w = mountView(ToolAssetsView);
    await flushPromises();
    expect(w.text()).toContain('工具资产全景');
  });

  it('QualityGatesView renders empty state when no session', async () => {
    const w = mountView(QualityGatesView);
    await flushPromises();
    expect(w.text()).toContain('无 session');
  });

  it('ReportsView renders empty state', async () => {
    const w = mountView(ReportsView, '/sessions/s1/reports');
    await flushPromises();
    expect(w.text()).toContain('报告与追溯');
  });
});