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
  icon: string;
  color?: string;
  needsSession?: boolean;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  { label: '概况', items: [
    { to: '/dashboard', label: '总览驾驶舱', icon: '◎', color: '#00FF88' },
    { to: '/launch', label: '启动 / 导入', icon: '▶', color: '#3FB950' },
  ]},
  { label: '检测发现', items: [
    { to: 'quality', label: '质量门禁', icon: '✓', color: '#3FB950', needsSession: true },
    { to: 'candidate-panorama', label: '攻击候选来源全景', icon: '◈', color: '#D29922', needsSession: true },
  ]},
  { label: '威胁分析', items: [
    { to: 'graph', label: '知识图谱', icon: '⬡', color: '#A371F7', needsSession: true },
    { to: 'compliance', label: '合规检测', icon: '☰', color: '#2F81F7', needsSession: true },
    { to: 'tri-library', label: '三库联动', icon: '🔗', color: '#D29922', needsSession: true },
    { to: 'attacks', label: '攻击验证', icon: '⚔', color: '#F85149', needsSession: true },
    { to: 'chains', label: '攻击链', icon: '⛓', color: '#F85149', needsSession: true },
    { to: 'coverage', label: '覆盖矩阵', icon: '▦', color: '#2DD4BF', needsSession: true },
    { to: 'poc', label: 'POC 复现', icon: '◆', color: '#A371F7', needsSession: true },
  ]},
  { label: '交付', items: [
    { to: 'reports', label: '报告追溯', icon: '▤', color: '#2F81F7', needsSession: true },
    { to: 'baseline', label: 'Baseline 对比', icon: '↔', color: '#2DD4BF', needsSession: true },
  ]},
  { label: '进化管理', items: [
    { to: 'evolution', label: '进化控制台', icon: '⬢', color: '#A371F7', needsSession: true },
    { to: '/tool-assets', label: '工具资产全景', icon: '⬣', color: '#00FF88' },
    { to: '/settings', label: '环境设置', icon: '⚙', color: '#8B949E' },
  ]},
];

const opencodeSessionId = computed(() => {
  const id = ui.currentSessionId ?? sessions.current?.id;
  if (!id) return null;
  return sessions.current?.gencptSessionId ?? id;
});

const currentSessionId = computed(() => {
  const m = route.path.match(/^\/sessions\/([^/]+)/);
  return m ? m[1] : ui.currentSessionId;
});

function resolveTo(item: NavItem): string {
  if (item.needsSession) {
    const id = currentSessionId.value;
    if (!id) return `/sessions/_/${item.to}`;
    return `/sessions/${id}/${item.to}`;
  }
  return item.to;
}

function isActive(item: NavItem): boolean {
  const to = resolveTo(item);
  if (!to) return false;
  return route.path === to || route.path.startsWith(to + '/');
}

function go(item: NavItem) {
  router.push(resolveTo(item));
}

function goBack() {
  if (window.history.length > 1) router.back();
  else router.push('/dashboard');
}

const showBackButton = computed(() => route.path !== '/dashboard');
</script>

<template>
  <div class="shell">
    <!-- Header -->
    <header class="hd">
      <div class="hd-l">
        <button v-if="showBackButton" class="hd-back" @click="goBack">←</button>
        <div class="hd-logo" @click="router.push('/dashboard')">
          <span class="hd-logo-icon">⬡</span>
          <span class="hd-logo-text">GenCPT</span>
        </div>
      </div>
      <div class="hd-c">
        <span v-if="opencodeSessionId" class="hd-sess">
          <span class="dot-live"></span>
          <span class="mono">{{ opencodeSessionId }}</span>
        </span>
      </div>
      <div class="hd-r">
        <span class="hd-status"><span class="dot-live"></span> runtime ready</span>
      </div>
    </header>

    <div class="bd">
      <!-- Sidebar -->
      <aside class="sb">
        <div v-for="g in groups" :key="g.label" class="sb-g">
          <div class="sb-gl">{{ g.label }}</div>
          <div
            v-for="item in g.items"
            :key="item.label"
            class="sb-i"
            :class="{ on: isActive(item) }"
            @click="go(item)"
          >
            <span class="sb-ic" :style="item.color ? { color: item.color } : {}">{{ item.icon }}</span>
            <span class="sb-il">{{ item.label }}</span>
          </div>
        </div>
      </aside>

      <!-- Workspace -->
      <main class="ws">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style>
.shell { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

/* Header */
.hd {
  height: 52px; min-height: 52px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; gap: 16px;
  background: linear-gradient(180deg, #0D1A1A, #0A0E14);
  border-bottom: 1px solid #1A252D;
  box-shadow: 0 1px 0 rgba(0, 255, 136, 0.10);
  z-index: 100;
}
.hd-l { display: flex; align-items: center; gap: 16px; }
.hd-back {
  background: none; border: none; font-size: 18px; color: #9DA7B3;
  cursor: pointer; padding: 4px 8px; border-radius: 4px;
}
.hd-back:hover { color: #E6EDF3; background: #1C232C; }
.hd-logo { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.hd-logo-icon { font-size: 20px; color: #00FF88; text-shadow: 0 0 8px rgba(0, 255, 136, 0.4); }
.hd-logo-text { font-size: 16px; font-weight: 700; color: #00FF88; letter-spacing: 0.05em; }
.hd-c { flex: 1; display: flex; justify-content: center; }
.hd-sess {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 4px 14px; border-radius: 999px;
  background: #1C232C; border: 1px solid #2D333B;
  font-size: 12px; color: #9DA7B3;
}
.hd-sess .mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
.hd-r { display: flex; align-items: center; gap: 8px; }
.hd-status { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #3FB950; }

.dot-live {
  width: 7px; height: 7px; border-radius: 50%; background: #00FF88;
  animation: pulse 1.5s infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }

/* Body */
.bd { display: flex; flex: 1; overflow: hidden; }

/* Sidebar */
.sb {
  width: 232px; min-width: 232px;
  background: #0A0E14;
  border-right: 1px solid #1A252D;
  overflow-y: auto; overflow-x: hidden;
  padding: 12px 0 24px;
  position: relative;
}
.sb::after {
  content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 2px;
  background: linear-gradient(180deg, transparent, rgba(0, 255, 136, 0.15), transparent);
  pointer-events: none;
}
.sb-g { margin-bottom: 16px; }
.sb-gl {
  padding: 10px 20px 6px;
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1.5px; color: #00FF88;
  border-bottom: 1px solid #1A252D;
  margin: 0 8px 4px; padding-bottom: 6px;
}
.sb-i {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 20px; margin: 1px 4px;
  border-radius: 6px; cursor: pointer;
  font-size: 13px; color: #C8D6E5;
  border-left: 2px solid transparent;
  transition: all 0.12s ease;
  position: relative;
}
.sb-i:hover { background: rgba(0, 255, 136, 0.08); color: #E6EDF3; border-left-color: rgba(0, 255, 136, 0.5); }
.sb-i.on {
  background: rgba(0, 255, 136, 0.12);
  color: #00FF88; border-left-color: #00FF88;
  box-shadow: inset 0 0 20px rgba(0, 255, 136, 0.05);
}
.sb-i.off { opacity: 0.3; cursor: default; }
.sb-ic { width: 18px; text-align: center; font-size: 14px; font-style: normal; opacity: 1; filter: brightness(1.2); }
.sb-il { flex: 1; }
.sb-tag {
  font-size: 9px; padding: 1px 6px; border-radius: 3px;
  background: #1A252D; color: #8B949E;
}

/* Workspace */
.ws {
  flex: 1; overflow-y: auto;
  background: #060A10;
  background-image:
    linear-gradient(rgba(0, 255, 136, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 255, 136, 0.04) 1px, transparent 1px);
  background-size: 40px 40px;
  padding: 28px;
}
.ws > * { animation: fadeUp 0.25s ease; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>