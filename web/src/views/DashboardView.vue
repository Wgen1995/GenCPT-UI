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

const router = useRouter();

const loading = ref(true);
const error = ref<string | null>(null);
const assets = ref<AssetIndex | null>(null);
const sessions = ref<SessionListItem[]>([]);
const currentSession = ref<SessionListItem | null>(null);

const hasSession = computed(() => currentSession.value !== null);
const skillCount = computed(() => assets.value?.childSkills.length ?? 0);
const ruleCount = computed(() => assets.value?.compliance.totalRules ?? 0);
const patternCount = computed(() => assets.value?.attackPatterns.length ?? 0);
const harnessCount = computed(() => assets.value?.harnessMechanisms.length ?? 0);
const triLibCount = computed(() => assets.value?.hypotheses.files.length ?? 0);
const sharedSpecCount = computed(
  () => assets.value?.sharedSpecs.filter((s) => s.exists).length ?? 0
);
const attackSurfaceCount = computed(
  () => new Set(assets.value?.attackPatterns.map((p) => p.attackSurface) ?? []).size
);

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
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

function openSession(id: string): void {
  router.push(`/sessions/${id}/execution`);
}

function launch(): void {
  router.push('/launch');
}

onMounted(loadDashboard);
</script>

<template>
  <div class="view dashboard-view">
    <div class="view-head">
      <h1>Dashboard</h1>
      <span v-if="loading" class="muted">刷新中…</span>
      <button v-else class="primary" @click="loadDashboard()">⟳ 刷新</button>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <!-- 无 session：资产驾驶舱 -->
    <template v-if="!hasSession">
      <EmptyState
        v-if="!loading && !error && sessions.length === 0"
        icon="◈"
        title="尚未加载任何 session"
        description="启动一次新评估或导入已有 session 即可开始"
      >
        <div class="row">
          <button class="primary" @click="launch">启动新评估</button>
        </div>
      </EmptyState>

      <div class="grid-2" v-if="assets">
        <PanelCard title="安全测试能力资产" accent>
          <dl class="kv">
            <dt>子 SKILL</dt><dd>{{ skillCount }}</dd>
            <dt>合规规则总数</dt><dd>{{ ruleCount }}</dd>
            <dt>攻击模式</dt><dd>{{ patternCount }}</dd>
            <dt>攻击面</dt><dd>{{ attackSurfaceCount }}</dd>
            <dt>三库（hypothesis-libraries）</dt><dd>{{ triLibCount }}</dd>
            <dt>shared 规范（已就绪）</dt><dd>{{ sharedSpecCount }}</dd>
          </dl>
          <template #footer>
            <RouterLink class="link" to="/tool-assets">查看 Tool Assets →</RouterLink>
          </template>
        </PanelCard>

        <PanelCard title="AI Harness 工程资产">
          <dl class="kv">
            <dt>Harness 机制</dt><dd>{{ harnessCount }}</dd>
            <dt>entry SKILL</dt>
            <dd>
              <StatusBadge :state="assets.entrySkill.exists ? 'pass' : 'fail'"
                :label="assets.entrySkill.exists ? '存在' : '缺失'" />
            </dd>
            <dt>tools/_index.md</dt>
            <dd>
              <StatusBadge :state="assets.tools.indexExists ? 'pass' : 'warn'"
                :label="assets.tools.indexExists ? '存在' : '缺失'" />
            </dd>
          </dl>
          <template #footer>
            <span class="muted">扫描于 {{ assets.scannedAt }}</span>
          </template>
        </PanelCard>
      </div>

      <PanelCard v-if="sessions.length > 0" title="历史 session（点击进入）" flat>
        <ul class="link-list">
          <li v-for="s in sessions" :key="s.id">
            <a href="javascript:void(0)" class="link" @click="openSession(s.id)">
              {{ s.id }}
              <span class="muted"> · {{ s.status }} · {{ s.mode ?? '-' }} · {{ s.createdAt }}</span>
            </a>
          </li>
        </ul>
      </PanelCard>

      <PanelCard title="快捷入口" flat>
        <div class="row">
          <button class="primary" @click="launch">启动新评估</button>
          <RouterLink class="link" to="/launch">导入已有 session →</RouterLink>
        </div>
      </PanelCard>
    </template>

    <!-- 有 session：session 总览 -->
    <template v-else>
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

      <PanelCard title="历史趋势（简单文本）" flat>
        <p class="muted">
          共 {{ sessions.length }} 个 session · 最新更新 {{ currentSession!.updatedAt }}
        </p>
        <ul class="link-list">
          <li v-for="s in sessions" :key="s.id">
            <a href="javascript:void(0)" class="link" @click="openSession(s.id)">
              {{ s.id }}
              <span class="muted"> · {{ s.status }} · {{ s.createdAt }}</span>
            </a>
          </li>
        </ul>
      </PanelCard>

      <PanelCard title="资产快照" flat>
        <dl class="kv inline">
          <dt>SKILL</dt><dd>{{ skillCount }}</dd>
          <dt>规则</dt><dd>{{ ruleCount }}</dd>
          <dt>模式</dt><dd>{{ patternCount }}</dd>
          <dt>Harness 机制</dt><dd>{{ harnessCount }}</dd>
        </dl>
      </PanelCard>
    </template>
  </div>
</template>

<style scoped>
.view-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.view-head h1 {
  font-size: 16px;
  letter-spacing: 0.05em;
  margin: 0;
}
.muted { color: var(--t3); }
.err { color: var(--rd); }
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--gap);
  margin-bottom: var(--gap);
}
.kv {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
  margin: 0;
}
.kv dt { color: var(--t3); font-size: 11px; letter-spacing: 0.06em; }
.kv dd { margin: 0; }
.kv.inline { grid-template-columns: repeat(4, max-content 1fr); }
.link-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.link-list li { padding: 2px 0; }
.row { display: flex; gap: var(--gap); align-items: center; }
.risk-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--gap);
}
.risk {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--bd);
  border-radius: var(--radius-sm);
  background: var(--bg1);
}
.risk .big { font-size: 20px; font-weight: 700; }
.alarm { color: var(--rd); }
.verdict {
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--ac);
}
.link { color: var(--cy); }
.link:hover { color: var(--ac); }
</style>