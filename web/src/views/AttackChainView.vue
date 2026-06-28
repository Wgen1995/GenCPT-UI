<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getJson } from '../api/client.js';
import PanelCard from '../components/common/PanelCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const sessionId = computed(() => String(route.params.id ?? ''));

interface ChainStep {
  order?: number;
  attackPoint?: string;
  action?: string;
  level?: string;
  confidence?: string;
  status?: string;
  evidence?: string;
  attackView?: string;
  defenseView?: string;
  defenseBypassed?: boolean;
  [k: string]: unknown;
}
interface ChainEntry {
  id?: string;
  name?: string;
  hypothesis?: string;
  steps?: ChainStep[];
  stepCount?: number;
  defenseScore?: number;
  status?: string;
  [k: string]: unknown;
}
interface ChainsData {
  chains?: ChainEntry[];
  verified?: number;
  blocked?: number;
  [k: string]: unknown;
}

const loading = ref(true);
const error = ref<string | null>(null);
const data = ref<ChainsData | null>(null);
const view = ref<'attacker' | 'defender'>('attacker');
const activeChain = ref<number>(0);
const playStep = ref<number>(-1);
let playTimer: ReturnType<typeof setInterval> | null = null;

async function load(): Promise<void> {
  if (!sessionId.value) return;
  loading.value = true;
  error.value = null;
  data.value = null;
  try {
    const res = await getJson<{ chains: ChainsData | null }>(
      `/api/sessions/${sessionId.value}/chains`
    );
    data.value = res.chains ?? null;
    activeChain.value = 0;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

const chains = computed<ChainEntry[]>(() => (data.value?.chains ?? []) as ChainEntry[]);

const current = computed<ChainEntry | null>(() => {
  if (chains.value.length === 0) return null;
  const idx = Math.min(activeChain.value, chains.value.length - 1);
  return chains.value[idx] ?? null;
});

const steps = computed<ChainStep[]>(() => (current.value?.steps ?? []) as ChainStep[]);

const playLabel = computed(() => playStep.value < 0 ? '▶ 播放' : '■ 停止');

function togglePlay(): void {
  if (playTimer) { stopPlay(); return; }
  if (steps.value.length === 0) return;
  playStep.value = playStep.value < 0 ? 0 : playStep.value;
  playStep.value = 0;
  playTimer = setInterval(() => {
    playStep.value += 1;
    if (playStep.value >= steps.value.length) stopPlay();
  }, 1000);
}

function stopPlay(): void {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
  playStep.value = -1;
}

function confidenceOf(c: string): 'C1' | 'C2' | 'C3' | undefined {
  const v = String(c ?? '').toUpperCase();
  if (v === 'C1' || v === 'C2' || v === 'C3') return v;
  return undefined;
}

function stateOf(s: string): 'pass' | 'warn' | 'fail' | 'na' | 'pending' {
  const v = String(s ?? '').toLowerCase();
  if (v === 'confirmed' || v === 'pass' || v === 'verified') return 'pass';
  if (v === 'refuted' || v === 'fail' || v === 'rejected') return 'fail';
  if (v === 'blocked') return 'na';
  if (v === 'partially_verified' || v === 'condition_met') return 'warn';
  return 'pending';
}

function isActive(i: number): boolean {
  if (playStep.value < 0) return true;
  return i <= playStep.value;
}

function selectChain(i: number): void {
  stopPlay();
  activeChain.value = i;
}

onMounted(load);
</script>

<template>
  <div class="view attack-chain-view">
    <div class="view-head">
      <h1>攻击链与动画回放</h1>
      <span class="muted">session: {{ sessionId }}</span>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <EmptyState
      v-if="!loading && !error && (!data || chains.length === 0)"
      icon="◈"
      title="攻击链未生成"
      description="完成 Phase 5（攻击链构建与验证）后在此查看"
    />

    <template v-if="data && chains.length > 0">
      <PanelCard title="CHAIN 列表与切换" flat>
        <div class="chain-tabs">
          <button
            v-for="(c, i) in chains"
            :key="c.id ?? i"
            :class="{ active: i === activeChain }"
            @click="selectChain(i)"
          >
            <code class="mono">{{ c.id ?? c.name ?? `chain-${i + 1}` }}</code>
            <span class="muted"> · {{ c.stepCount ?? (c.steps?.length ?? 0) }} 步</span>
          </button>
        </div>
      </PanelCard>

      <div class="grid-2" v-if="current">
        <PanelCard title="攻击链回放" accent>
          <div class="player-bar">
            <button class="primary" @click="togglePlay">{{ playLabel }}</button>
            <button @click="stopPlay">⟲ 重置</button>
            <div class="view-toggle">
              <button :class="{ active: view === 'attacker' }" @click="view = 'attacker'">攻击者视角</button>
              <button :class="{ active: view === 'defender' }" @click="view = 'defender'">防御者视角</button>
            </div>
          </div>
          <div class="steps">
            <div
              v-for="(s, i) in steps"
              :key="i"
              class="step"
              :class="{ dim: !isActive(i), bypassed: s.defenseBypassed === true }"
            >
              <span class="step-no">{{ i + 1 }}</span>
              <div class="step-body">
                <p class="step-title">{{ s.attackPoint ?? '-' }}</p>
                <p class="step-action">{{ s.action ?? '' }}</p>
                <div class="step-meta">
                  <StatusBadge v-if="confidenceOf(String(s.confidence ?? ''))" :tier="confidenceOf(String(s.confidence ?? ''))" />
                  <StatusBadge :state="stateOf(String(s.status ?? ''))" :label="String(s.status ?? 'pending')" />
                </div>
                <p v-if="view === 'attacker' && s.attackView" class="muted step-view">{{ s.attackView }}</p>
                <p v-if="view === 'defender' && s.defenseView" class="muted step-view">{{ s.defenseView }}</p>
                <p v-if="s.evidence" class="evidence"><span class="muted">证据：</span><code class="mono">{{ s.evidence }}</code></p>
              </div>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="防御有效性评估">
          <dl class="kv">
            <dt>链 ID</dt><dd class="mono">{{ current.id ?? '-' }}</dd>
            <dt>步骤数</dt><dd>{{ current.stepCount ?? steps.length }}</dd>
            <dt>防御得分</dt>
            <dd>
              <span class="big" :class="{ alarm: (current.defenseScore ?? 0) <= 30 }">{{ current.defenseScore ?? '-' }}</span>
              <span class="muted"> / 100</span>
            </dd>
            <dt>状态</dt><dd><StatusBadge :state="stateOf(String(current.status ?? ''))" :label="String(current.status ?? 'pending')" /></dd>
          </dl>
          <p class="muted desc">
            分数越低表示防御越弱（攻击者越容易走完整条链）。
            <span v-if="current.defenseScore ?? 0 <= 30">· 当前评分偏低，建议补齐防御控制。</span>
          </p>
        </PanelCard>
      </div>
    </template>
  </div>
</template>

<style scoped>
.view-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.view-head h1 { font-size: 16px; margin: 0; }
.muted { color: var(--t3); }
.err { color: var(--rd); }
.mono { font-family: inherit; }
.grid-2 { display: grid; grid-template-columns: 2fr 1fr; gap: var(--gap); }
.chain-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.chain-tabs button { padding: 4px 10px; }
.chain-tabs button.active { border-color: var(--ac); color: var(--ac); }
.player-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
.view-toggle { margin-left: auto; display: flex; gap: 4px; }
.view-toggle button.active { color: var(--cy); border-color: var(--cy); }
.steps { display: flex; flex-direction: column; gap: 6px; }
.step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 8px;
  border: 1px solid var(--bd);
  border-radius: var(--radius-sm);
  background: var(--bg1);
  padding: 6px 8px;
  opacity: 1;
  transition: opacity 0.4s ease, transform 0.4s ease, border-color 0.4s ease;
}
.step.dim { opacity: 0.35; transform: translateX(-4px); }
.step.bypassed { border-color: var(--am); }
.step-no {
  font-weight: 700; color: var(--cy);
  font-size: 14px; text-align: center;
}
.step-title { margin: 0; font-weight: 600; color: var(--t1); font-size: 12px; }
.step-action { margin: 2px 0; font-size: 12px; color: var(--t2); }
.step-meta { display: flex; gap: 6px; margin: 4px 0; flex-wrap: wrap; }
.step-view { font-size: 11px; }
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
.kv dt { color: var(--t3); font-size: 11px; letter-spacing: 0.06em; }
.kv dd { margin: 0; }
.big { font-size: 24px; font-weight: 700; color: var(--ac); }
.alarm { color: var(--rd); }
.desc { margin: 8px 0 0; font-size: 12px; }
.evidence { margin: 2px 0 0; font-size: 11px; }
</style>