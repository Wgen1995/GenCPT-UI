import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useEnvironmentStore } from '../src/stores/environment.js';
import { useAssetsStore } from '../src/stores/assets.js';
import { useSessionsStore } from '../src/stores/sessions.js';
import { useEventsStore } from '../src/stores/events.js';
import { useUiStore } from '../src/stores/ui.js';

describe('pinia stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('environment store initializes empty', () => {
    const s = useEnvironmentStore();
    expect(s.data).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('assets store initializes empty', () => {
    const s = useAssetsStore();
    expect(s.index).toEqual([]);
    expect(s.loading).toBe(false);
  });

  it('sessions store initializes empty', () => {
    const s = useSessionsStore();
    expect(s.list).toEqual([]);
    expect(s.current).toBeNull();
    expect(s.loading).toBe(false);
  });

  it('events store initializes empty and clears', () => {
    const s = useEventsStore();
    expect(s.events).toEqual([]);
    expect(s.live).toBe(false);
    expect(s.sessionId).toBeNull();
    s.clear();
    expect(s.events).toEqual([]);
  });

  it('ui store holds current session and collapses', () => {
    const s = useUiStore();
    expect(s.sidebarCollapsed).toBe(false);
    s.setCurrentSession('abc');
    s.toggleSidebar();
    expect(s.currentSessionId).toBe('abc');
    expect(s.sidebarCollapsed).toBe(true);
  });

  it('events store exposes subscribe action', () => {
    const s = useEventsStore();
    expect(typeof s.subscribe).toBe('function');
    expect(typeof s.clear).toBe('function');
  });
});