import { describe, expect, it } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import { createPinia } from 'pinia';

import AppShell from '../src/components/layout/AppShell.vue';
import PanelCard from '../src/components/common/PanelCard.vue';
import StatusBadge from '../src/components/common/StatusBadge.vue';
import EmptyState from '../src/components/common/EmptyState.vue';
import { routes } from '../src/router.js';

function makeTestRouter(initial = '/dashboard'): Router {
  return createRouter({
    history: createMemoryHistory(initial),
    routes
  });
}

function mountWithRouter(
  component: Parameters<typeof mount>[0],
  opts: Parameters<typeof mount>[1] = {},
  router?: Router
): ReturnType<typeof mount> {
  const r = router ?? makeTestRouter();
  return mount(component, {
    ...opts,
    global: {
      plugins: [r, createPinia()],
      stubs: { RouterView: true, ...(opts.global?.stubs ?? {}) },
      ...(opts.global ?? {})
    }
  });
}

describe('AppShell', () => {
  it('renders the brand title', async () => {
    const r = makeTestRouter();
    const w = mountWithRouter(AppShell, {}, r);
    await flushPromises();
    expect(w.text()).toContain('GenCPT');
    expect(w.find('.hd').exists()).toBe(true);
    expect(w.find('.sb').exists()).toBe(true);
    expect(w.find('.ws').exists()).toBe(true);
    expect(w.findAll('.sb-g').length).toBeGreaterThan(0);
  });
});

describe('PanelCard', () => {
  it('renders title and slot content', () => {
    const w = mount(PanelCard, {
      props: { title: 'Session Stats', accent: true },
      slots: { default: '<p class="c">hello panel</p>' }
    });
    expect(w.text()).toContain('Session Stats');
    expect(w.find('p.c').text()).toBe('hello panel');
    expect(w.find('.accent').exists()).toBe(true);
  });
});

describe('StatusBadge', () => {
  it('renders tier badges', () => {
    const w = mount(StatusBadge, { props: { tier: 'C1' } });
    expect(w.text()).toContain('C1');
    expect(w.classes()).toContain('c1');
  });

  it('renders state badges', () => {
    const w = mount(StatusBadge, { props: { state: 'fail', label: 'FAIL' } });
    expect(w.text()).toContain('FAIL');
    expect(w.classes()).toContain('s-fail');
  });

  it('renders L-level badges', () => {
    const w = mount(StatusBadge, { props: { tier: 'L2' } });
    expect(w.text()).toContain('L2');
    expect(w.classes()).toContain('l2');
  });
});

describe('EmptyState', () => {
  it('renders icon and title', () => {
    const w = mount(EmptyState, {
      props: { icon: '✶', title: 'No sessions', description: 'run an import first' }
    });
    expect(w.find('.icon').text()).toBe('✶');
    expect(w.find('.title').text()).toBe('No sessions');
    expect(w.text()).toContain('run an import first');
  });
});