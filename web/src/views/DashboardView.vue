<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getJson } from '../api/client.js';
import type {
  AssetIndex,
  DashboardViewModel,
  SessionListItem
} from '../api/types.js';
import PanelCard from '../components/common/PanelCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import EmptyState from '../components/common/EmptyState.vue';
import CodeRain from '../components/gencpt/CodeRain.vue';

const router = useRouter();

const loading = ref(true);
const error = ref<string | null>(null);
const assets = ref<AssetIndex | null>(null);
const sessions = ref<SessionListItem[]>([]);
const currentSession = ref<SessionListItem | null>(null);
const selectedSessionId = ref('');

const hasSession = computed(() => currentSession.value !== null);
const skillCount = computed(() => assets.value?.childSkills.length ?? 0);
const ruleCount = computed(() => assets.value?.compliance.totalRules ?? 0);
const patternCount = computed(() => assets.value?.attackPatterns.length ?? 0);
const harnessCount = computed(() => assets.value?.harnessMechanisms.length ?? 0);
const triLibCount = computed(() => assets.value?.hypotheses.files.length ?? 0);
const sharedSpecCount = computed(
  () => assets.value?.sharedSpecs.filter((s) => s.exists).length ?? 0
);
const attackSurfaces = computed(() => {
  if (!assets.value) return [];
  const map = new Map<string, { name: string; count: number }>();
  for (const p of assets.value.attackPatterns) {
    const id = p.attackSurface;
    if (!map.has(id)) {
      const names: Record<string,string> = {'AS-1':'逃逸','AS-2':'认证授权','AS-3':'网络','AS-4':'数据泄露','AS-5':'拒绝服务','AS-6':'供应链','AS-7':'持久化'};
      map.set(id, { name: names[id] ?? id, count: 0 });
    }
    map.get(id)!.count++;
  }
  return [...map.entries()].map(([id, v]) => ({ id, ...v }));
});

const summary = computed(
  () => (currentSession.value?.summary ?? {}) as Record<string, unknown>
);

const riskCounts = computed(() => {
  const s = summary.value;
  const c1 = Number(s.c1 ?? 0);
  const c2 = Number(s.c2 ?? 0);
  const c3 = Number(s.c3 ?? 0);
  const open = Number(s.openCandidates ?? 0);
  return { c1, c2, c3, open };
});

const qualityVerdict = computed(() => {
  const v = String(summary.value.qualityVerdict ?? '');
  if (!v) return null;
  return v;
});

async function loadDashboard(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const data = await getJson<DashboardViewModel>('/api/dashboard');
    assets.value = data.assets;
    sessions.value = data.sessions ?? [];
    currentSession.value = data.currentSession ?? null;
    if (currentSession.value) selectedSessionId.value = currentSession.value.id;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

function selectSession(): void {
  const id = selectedSessionId.value;
  if (!id) return;
  currentSession.value = sessions.value.find(s => s.id === id) ?? null;
}

function launch(): void {
  router.push('/launch');
}

onMounted(loadDashboard);
</script>

<template>
  <div class="view dashboard-view" style="position:relative;z-index:1">
    <CodeRain />
    <div class="view-head">
      <div>
        <h1>总览驾驶舱</h1>
        <p class="subtitle">GenCPT 容器渗透测试平台 · 能力资产与安全态势</p>
      </div>
      <div class="quick-actions">
        <button class="primary" @click="launch">▶ 启动新评估</button>
        <RouterLink class="link-btn" to="/launch?tab=import">导入 Session</RouterLink>
      </div>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <!-- 能力资产 KPI 行（始终显示） -->
    <div class="kpi-row" v-if="assets">
      <div class="mc mc-click mc-top-green" @click="router.push('/tool-assets?tab=pipeline')"><div class="mc-l">子技能</div><div class="mc-v">{{ skillCount }}</div><div class="mc-s">可独立运行 →</div></div>
      <div class="mc mc-click mc-top-amber" @click="router.push('/tool-assets?tab=knowledge')"><div class="mc-l">合规规则</div><div class="mc-v">{{ ruleCount }}</div><div class="mc-s">3 平台 / 41 分组 →</div></div>
      <div class="mc mc-click mc-top-red" @click="router.push('/tool-assets?tab=knowledge')"><div class="mc-l">攻击模式</div><div class="mc-v">{{ patternCount }}</div><div class="mc-s">7 攻击面 →</div></div>
      <div class="mc mc-click mc-top-purple" @click="router.push('/tool-assets?tab=knowledge')"><div class="mc-l">三库</div><div class="mc-v">{{ triLibCount }}</div><div class="mc-s">CHK/ATK/XREF →</div></div>
      <div class="mc mc-click mc-top-teal" @click="router.push('/tool-assets?tab=harness')"><div class="mc-l">Harness 机制</div><div class="mc-v">{{ harnessCount }}</div><div class="mc-s">AI 工程纪律 →</div></div>
      <div class="mc mc-click mc-top-blue" @click="router.push('/tool-assets?tab=harness')"><div class="mc-l">公共规范</div><div class="mc-v">{{ sharedSpecCount }}</div><div class="mc-s">shared 规范库 →</div></div>
    </div>

    <!-- 攻击面标签行 -->
    <div class="as-row" v-if="assets">
      <span class="as-label">攻击面覆盖：</span>
      <span v-for="as in attackSurfaces" :key="as.id" class="as-tag" @click="router.push('/tool-assets?tab=knowledge')">
        {{ as.id }} {{ as.name }} {{ as.count }}
      </span>
    </div>

    <!-- 能力资产详情 -->
    <div class="grid-2" v-if="assets">
      <div class="mc-click" @click="router.push('/tool-assets?tab=knowledge')">
        <PanelCard title="安全测试能力资产" accent>
          <div class="stats-grid">
            <div class="stat"><span class="stat-v">{{ ruleCount }}</span><span class="stat-l">合规规则</span></div>
            <div class="stat"><span class="stat-v">{{ patternCount }}</span><span class="stat-l">攻击模式</span></div>
            <div class="stat"><span class="stat-v">{{ triLibCount }}</span><span class="stat-l">三库</span></div>
            <div class="stat"><span class="stat-v">{{ sharedSpecCount }}</span><span class="stat-l">公共规范</span></div>
          </div>
          <template #footer>
            <span class="link">查看工具资产全景 →</span>
          </template>
        </PanelCard>
      </div>

      <div class="mc-click" @click="router.push('/tool-assets?tab=harness')">
        <PanelCard title="AI Harness 工程资产">
          <div class="harness-grid">
            <div class="h-item" v-for="m in assets.harnessMechanisms.slice(0,8)" :key="m.id">
              <span class="h-name">{{ m.name }}</span>
              <span class="h-cat">{{ m.category }}</span>
            </div>
          </div>
          <template #footer>
            <span class="link">查看全部 {{ assets.harnessMechanisms.length }} 项机制 →</span>
          </template>
        </PanelCard>
      </div>
    </div>

    <!-- 无 session：快捷入口 -->
    <template v-if="!hasSession">
      <EmptyState
        v-if="!loading && !error && sessions.length === 0"
        icon="◈"
        title="尚未加载任何 session"
        description="启动一次新评估或导入已有 session 即可开始"
      >
        <div class="row">
          <button class="primary" @click="launch">启动新评估</button>
          <RouterLink class="link" to="/launch">导入已有 session →</RouterLink>
        </div>
      </EmptyState>
    </template>

    <!-- 有 session：session 筛选器 + session 详情 -->
    <template v-else>
      <div class="session-selector">
        <select v-model="selectedSessionId" @change="selectSession" class="gi">
          <option v-for="s in sessions" :key="s.id" :value="s.id">
            {{ s.server ?? s.id?.slice(0,8) }} · {{ s.status }} · {{ s.mode ?? '-' }}
          </option>
        </select>
        <button class="primary" @click="launch">+ 启动新评估</button>
      </div>
      <PanelCard title="Session 摘要" accent>
        <dl class="kv">
          <dt>id</dt><dd>{{ currentSession!.id }}</dd>
          <dt>server</dt><dd>{{ currentSession!.server ?? '-' }}</dd>
          <dt>mode</dt><dd>{{ currentSession!.mode ?? '-' }}</dd>
          <dt>scope</dt><dd>{{ currentSession!.scope ?? '-' }}</dd>
          <dt>approval</dt><dd>{{ currentSession!.approval ?? '-' }}</dd>
          <dt>status</dt>
          <dd><StatusBadge :state="(currentSession!.status as any) ?? 'pending'" /></dd>
        </dl>
      </PanelCard>

      <div class="grid-2">
        <PanelCard title="风险汇总 · C1/C2/C3">
          <div class="risk-grid">
            <div class="risk c1">
              <StatusBadge tier="C1" /><span class="big">{{ riskCounts.c1 }}</span>
            </div>
            <div class="risk c2">
              <StatusBadge tier="C2" /><span class="big">{{ riskCounts.c2 }}</span>
            </div>
            <div class="risk c3">
              <StatusBadge tier="C3" /><span class="big">{{ riskCounts.c3 }}</span>
            </div>
            <div class="risk open">
              <span class="muted">未闭环候选</span>
              <span class="big" :class="{ alarm: riskCounts.open > 0 }">{{ riskCounts.open }}</span>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="质量状态">
          <p v-if="qualityVerdict" class="verdict">{{ qualityVerdict }}</p>
          <p v-else class="muted">session 暂无 quality verdict（可能尚未完成）</p>
        </PanelCard>
      </div>
    </template>
  </div>
</template>

<style scoped>
.kpi-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; margin-bottom: 16px; }
.kpi-row .mc-l { font-size: 13px; color: var(--t2); }
.kpi-row .mc-s { font-size: 12px; color: var(--t3); }
.mc-top-green  { border-top: 3px solid #00FF88; }
.mc-top-amber  { border-top: 3px solid #D29922; }
.mc-top-red    { border-top: 3px solid #F85149; }
.mc-top-purple { border-top: 3px solid #A371F7; }
.mc-top-teal   { border-top: 3px solid #2DD4BF; }
.mc-top-blue   { border-top: 3px solid #2F81F7; }
.subtitle { color: var(--t3); font-size: 13px; margin: 4px 0 0; }
.quick-actions { display: flex; gap: 10px; align-items: center; }
.link-btn { padding: 8px 16px; border: 1px solid var(--border); border-radius: 6px; color: var(--t2); cursor: pointer; font-size: 14px; text-decoration: none; }
.link-btn:hover { border-color: var(--accent-blue); color: var(--accent-blue); }
.mc-click { cursor: pointer; transition: transform 0.15s; }
.mc-click:hover { transform: translateY(-2px); }
.row { display: flex; gap: 12px; align-items: center; }
.risk-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.risk { display: flex; align-items: center; gap: 8px; padding: 12px; border: 1px solid var(--bd); border-radius: 8px; background: var(--bg1); }
.risk .big { font-size: 24px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
.alarm { color: var(--rd); }
.verdict { font-weight: 700; font-size: 16px; color: var(--ac); }
.session-selector { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; padding: 12px; background: var(--bg2); border: 1px solid var(--bd); border-radius: 8px; }
.gi { flex: 1; max-width: 400px; }

.as-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; padding: 12px; background: var(--bg2); border: 1px solid var(--bd); border-radius: 8px; }
.as-label { font-size: 13px; font-weight: 600; color: var(--t2); }
.as-tag { cursor: pointer; padding: 3px 10px; border-radius: 4px; font-size: 12px; background: var(--bg3); border: 1px solid var(--bd); color: var(--t2); font-family: 'JetBrains Mono', monospace; white-space: nowrap; }
.as-tag:hover { border-color: var(--ac); color: var(--ac); }

.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.stat { text-align: center; padding: 8px; background: var(--bg1); border-radius: 6px; }
.stat-v { display: block; font-size: 22px; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: var(--ac); }
.stat-l { display: block; font-size: 11px; color: var(--t2); margin-top: 4px; }

.harness-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; max-height: 240px; overflow-y: auto; }
.h-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: var(--bg1); border-radius: 4px; font-size: 12px; }
.h-name { color: var(--t1); }
.h-cat { font-size: 10px; color: var(--t3); padding: 1px 6px; background: var(--bg3); border-radius: 3px; }
</style>