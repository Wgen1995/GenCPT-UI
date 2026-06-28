<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRouter, useRoute } from 'vue-router';
import { useUiStore } from '../../stores/ui.js';
import { useSessionsStore } from '../../stores/sessions.js';

const ui = useUiStore();
const sessions = useSessionsStore();
const router = useRouter();
const route = useRoute();

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
  { label: '总览', items: [{ to: '/dashboard', label: '总览驾驶舱' }] },
  { label: '运行', items: [{ to: '/launch', label: '启动 / 导入' }] },
  {
    label: '质量与发现',
    items: [
      { to: 'quality', label: '质量门禁', needsSession: true },
      { to: 'candidate-panorama', label: '攻击候选来源全景', needsSession: true }
    ]
  },
  {
    label: '分析',
    items: [
      { to: 'graph', label: '知识图谱', needsSession: true },
      { to: 'compliance', label: '合规检测', needsSession: true },
      { to: 'tri-library', label: '三库联动', needsSession: true },
      { to: 'attacks', label: '攻击验证', needsSession: true },
      { to: 'chains', label: '攻击链', needsSession: true },
      { to: 'coverage', label: '覆盖矩阵', needsSession: true },
      { to: 'poc', label: 'POC 复现', needsSession: true }
    ]
  },
  {
    label: '交付',
    items: [
      { to: 'reports', label: '报告追溯', needsSession: true },
      { to: 'baseline', label: 'Baseline 对比', needsSession: true }
    ]
  },
  {
    label: '进化与设置',
    items: [
      { to: 'evolution', label: '进化控制台', needsSession: true },
      { to: '/tool-assets', label: '工具资产全景' },
      { to: '/settings', label: '环境设置' }
    ]
  }
];

const sessionName = computed(() => {
  const id = ui.currentSessionId ?? sessions.current?.id;
  if (!id) return null;
  return sessions.current?.server ?? id;
});

const currentSessionId = computed(() => {
  const m = route.path.match(/^\/sessions\/([^/]+)/);
  return m ? m[1] : ui.currentSessionId;
});

const currentPath = computed(() => route.path);

function resolveTo(item: NavItem): string {
  if (item.needsSession) {
    const id = currentSessionId.value;
    if (!id) return '';
    return `/sessions/${id}/${item.to}`;
  }
  return item.to;
}

function isDisabled(item: NavItem): boolean {
  if (item.needsSession) {
    return !currentSessionId.value;
  }
  return false;
}

function isActive(item: NavItem): boolean {
  const to = resolveTo(item);
  if (!to) return false;
  return currentPath.value === to || currentPath.value.startsWith(to + '/');
}

function go(item: NavItem) {
  if (isDisabled(item)) return;
  router.push(resolveTo(item));
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/dashboard');
  }
}

const showBackButton = computed(() => {
  return currentPath.value !== '/dashboard';
});
</script>

<template>
  <div class="app-shell" :class="{ collapsed: ui.sidebarCollapsed }">
    <header class="app-header">
      <button v-if="showBackButton" class="back-btn" @click="goBack">← 返回</button>
      <span class="brand" @click="router.push('/dashboard')">⬡ GenCPT · Workbench</span>
      <button @click="ui.toggleSidebar()" aria-label="切换侧栏">
        {{ ui.sidebarCollapsed ? '»' : '«' }}
      </button>
      <span v-if="sessionName" class="session-pill">当前 Session: {{ sessionName }}</span>
    </header>
    <nav class="app-sidebar">
      <div v-for="g in groups" :key="g.label" class="group">
        <div class="group-label">{{ g.label }}</div>
        <a
          v-for="item in g.items"
          :key="item.label"
          class="link"
          :class="{ 'router-link-active': isActive(item), disabled: isDisabled(item) }"
          href="javascript:void(0)"
          @click="go(item)"
        >
          {{ item.label }}
          <span v-if="isDisabled(item)" class="muted" style="font-size:10px;margin-left:auto">需 Session</span>
        </a>
      </div>
    </nav>
    <main class="app-workspace">
      <RouterView />
    </main>
  </div>
</template>