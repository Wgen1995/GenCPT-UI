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
      <h1>总览驾驶舱</h1>
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

      <div class="kpi-row" v-if="assets">
        <div class="mc"><div class="mc-l">子技能</div><div class="mc-v">{{ skillCount }}</div><div class="mc-s">可独立运行</div></div>
        <div class="mc"><div class="mc-l">合规规则</div><div class="mc-v" style="color:var(--am)">{{ ruleCount }}</div><div class="mc-s">3 平台 / 41 分组</div></div>
        <div class="mc"><div class="mc-l">攻击模式</div><div class="mc-v" style="color:var(--rd)">{{ patternCount }}</div><div class="mc-s">7 攻击面</div></div>
        <div class="mc"><div class="mc-l">三库</div><div class="mc-v" style="color:var(--pp)">{{ triLibCount }}</div><div class="mc-s">CHK/ATK/XREF</div></div>
        <div class="mc"><div class="mc-l">Harness 机制</div><div class="mc-v" style="color:var(--teal)">{{ harnessCount }}</div><div class="mc-s">AI 工程纪律</div></div>
        <div class="mc"><div class="mc-l">公共规范</div><div class="mc-v" style="color:var(--cy)">{{ sharedSpecCount }}</div><div class="mc-s">shared 规范库</div></div>
      </div>

      <div class="grid-2" v-if="assets" style="margin-top:20px">
        <PanelCard title="安全测试能力资产" accent>
          <dl class="kv">
            <dt>入口 SKILL</dt>
            <dd>
              <StatusBadge :state="assets.entrySkill.exists ? 'pass' : 'fail'"
                :label="assets.entrySkill.exists ? '存在' : '缺失'" />
            </dd>
            <dt>攻击面</dt><dd>{{ attackSurfaceCount }}</dd>
            <dt>tools 工具库</dt>
            <dd>
              <StatusBadge :state="assets.tools.indexExists ? 'pass' : 'warn'"
                :label="assets.tools.indexExists ? '存在' : '缺失'" />
            </dd>
          </dl>
          <template #footer>
            <RouterLink class="link" to="/tool-assets">查看工具资产全景 →</RouterLink>
          </template>
        </PanelCard>

        <PanelCard title="AI Harness 工程资产">
          <dl class="kv">
            <dt>写盘优先</dt><dd><StatusBadge state="pass" label="已就绪" /></dd>
            <dt>反幻觉六条</dt><dd><StatusBadge state="pass" label="已就绪" /></dd>
            <dt>QA 三层</dt><dd><StatusBadge state="pass" label="已就绪" /></dd>
            <dt>审批门控</dt><dd><StatusBadge state="pass" label="已就绪" /></dd>
          </dl>
          <template #footer>
            <span class="muted">扫描时间: {{ assets.scannedAt }}</span>
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
.kpi-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}
.link-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.link-list li { padding: 4px 0; }
.row { display: flex; gap: 12px; align-items: center; }
.risk-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.risk {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--bd);
  border-radius: 8px;
  background: var(--bg1);
}
.risk .big { font-size: 24px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
.alarm { color: var(--rd); }
.verdict {
  font-weight: 700;
  font-size: 16px;
  color: var(--ac);
}
</style>