<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import { useUiStore } from '../../stores/ui.js';
import { useSessionsStore } from '../../stores/sessions.js';

const ui = useUiStore();
const sessions = useSessionsStore();
const router = useRouter();

interface NavItem {
  to: string;
  label: string;
  needsSession?: boolean;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  { label: '总览', items: [{ to: '/dashboard', label: 'Dashboard' }] },
  { label: '运行', items: [{ to: '/launch', label: 'Launch / Import' }] },
  {
    label: '质量与发现',
    items: [
      { to: 'quality', label: 'Quality Gates', needsSession: true },
      { to: 'candidate-panorama', label: 'Candidate Panorama', needsSession: true }
    ]
  },
  {
    label: '分析',
    items: [
      { to: 'graph', label: 'Knowledge Graph', needsSession: true },
      { to: 'compliance', label: 'Compliance', needsSession: true },
      { to: 'tri-library', label: 'Tri-Library', needsSession: true },
      { to: 'attacks', label: 'Attacks', needsSession: true },
      { to: 'chains', label: 'Chains', needsSession: true },
      { to: 'coverage', label: 'Coverage', needsSession: true },
      { to: 'poc', label: 'POC', needsSession: true }
    ]
  },
  {
    label: '交付',
    items: [
      { to: 'reports', label: 'Reports', needsSession: true },
      { to: 'baseline', label: 'Baseline', needsSession: true }
    ]
  },
  {
    label: '进化与设置',
    items: [
      { to: 'evolution', label: 'Evolution', needsSession: true },
      { to: '/settings', label: 'Settings' }
    ]
  }
];

const sessionName = computed(() => {
  const id = ui.currentSessionId ?? sessions.current?.id;
  if (!id) return null;
  return sessions.current?.name ?? id;
});

function resolveTo(item: NavItem): string {
  if (item.needsSession) {
    const id = ui.currentSessionId ?? sessions.current?.id;
    if (!id) return '/launch';
    return `/sessions/${id}/${item.to}`;
  }
  return item.to;
}

function go(item: NavItem) {
  router.push(resolveTo(item));
}
</script>

<template>
  <div class="app-shell" :class="{ collapsed: ui.sidebarCollapsed }">
    <header class="app-header">
      <span class="brand">GenCPT · WORKBENCH</span>
      <button @click="ui.toggleSidebar()" aria-label="toggle sidebar">
        {{ ui.sidebarCollapsed ? '»' : '«' }}
      </button>
      <span v-if="sessionName" class="session-pill">session: {{ sessionName }}</span>
    </header>
    <nav class="app-sidebar">
      <div v-for="g in groups" :key="g.label" class="group">
        <div class="group-label">{{ g.label }}</div>
        <a
          v-for="item in g.items"
          :key="item.label"
          class="link"
          href="javascript:void(0)"
          @click="go(item)"
        >
          {{ item.label }}
        </a>
      </div>
    </nav>
    <main class="app-workspace">
      <RouterView />
    </main>
  </div>
</template>