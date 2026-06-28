<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getJson } from '../api/client.js';
import PanelCard from '../components/common/PanelCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const sessionId = computed(() => String(route.params.id ?? ''));

interface EvolutionCand {
  id?: string;
  pattern?: string;
  hypothesis?: string;
  evidence?: string;
  status?: string;
  age?: number;
  [k: string]: unknown;
}
interface LifecycleEntry {
  name?: string;
  state?: string;
  stages?: Record<string, number>;
  age?: number;
  hits?: number;
  [k: string]: unknown;
}
interface EvolutionData {
  newCandidates?: EvolutionCand[];
  gateStates?: Record<string, string>;
  learnedLifecycle?: LifecycleEntry[];
  high?: number;
  medium?: number;
  stale?: number;
  archived?: number;
  consistency?: { static?: number; learned?: number; llm?: number };
  [k: string]: unknown;
}

const loading = ref(true);
const error = ref<string | null>(null);
const data = ref<EvolutionData | null>(null);

async function load(): Promise<void> {
  if (!sessionId.value) return;
  loading.value = true;
  error.value = null;
  data.value = null;
  try {
    const res = await getJson<{ evolution: EvolutionData | null }>(
      `/api/sessions/${sessionId.value}/evolution`
    );
    data.value = res.evolution ?? null;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

const newCands = computed<EvolutionCand[]>(() => (data.value?.newCandidates ?? []) as EvolutionCand[]);
const lifecycle = computed<LifecycleEntry[]>(() => (data.value?.learnedLifecycle ?? []) as LifecycleEntry[]);
const consistency = computed(() => (data.value?.consistency ?? {}) as Record<string, number>);

const GATES = ['gate-1-candidate', 'gate-2-corroborated', 'gate-3-promoted', 'gate-4-stable'];

function gateStateLabel(s: string | undefined): string {
  return String(s ?? 'unknown');
}

function gateState(s: string | undefined): 'pass' | 'warn' | 'fail' | 'pending' {
  const v = String(s ?? '').toLowerCase();
  if (v === 'pass' || v === 'reached' || v === 'open') return 'pass';
  if (v === 'blocked' || v === 'reject' || v === 'fail') return 'fail';
  if (v === 'pending' || v === 'idle') return 'pending';
  return 'warn';
}

onMounted(load);
</script>

<template>
  <div class="view evolution-view">
    <div class="view-head">
      <h1>进化控制台</h1>
      <span class="muted">session: {{ sessionId }}</span>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <EmptyState
      v-if="!loading && !error && !data"
      icon="◈"
      title="无 evolve 产物或未运行 Phase 9"
      description="完成 Phase 9（attack-reasoning + evolve）后可在此查看 LLM 推理新候选与三库一致性"
    />

    <template v-if="data">
      <div class="grid-2">
        <PanelCard title="learned 模式生命周期" accent>
          <dl class="kv inline">
            <dt>high</dt><dd>{{ data.high ?? 0 }}</dd>
            <dt>medium</dt><dd>{{ data.medium ?? 0 }}</dd>
            <dt>stale</dt><dd>{{ data.stale ?? 0 }}</dd>
            <dt>archived</dt><dd>{{ data.archived ?? 0 }}</dd>
          </dl>
        </PanelCard>

        <PanelCard title="三库一致性">
          <dl class="kv">
            <dt>static</dt><dd>{{ consistency.static ?? '-' }}</dd>
            <dt>learned</dt><dd>{{ consistency.learned ?? '-' }}</dd>
            <dt>LLM</dt><dd>{{ consistency.llm ?? '-' }}</dd>
          </dl>
        </PanelCard>
      </div>

      <PanelCard title="4 门槛状态" flat>
        <ul class="gate-list">
          <li v-for="g in GATES" :key="g">
            <span class="gate-id">{{ g }}</span>
            <StatusBadge :state="gateState(data.gateStates?.[g])" :label="gateStateLabel(data.gateStates?.[g])" />
          </li>
        </ul>
      </PanelCard>

      <PanelCard title="LLM 新候选" flat>
        <EmptyState v-if="newCands.length === 0" icon="◇" title="无新候选" />
        <table v-else class="cands-table">
          <thead>
            <tr><th>ID</th><th>pattern</th><th>evidence</th><th>状态</th><th>age</th></tr>
          </thead>
          <tbody>
            <tr v-for="(c, i) in newCands" :key="c.id ?? i">
              <td class="mono">{{ c.id ?? '-' }}</td>
              <td>{{ c.pattern ?? '-' }}</td>
              <td class="small">{{ c.evidence ?? '-' }}</td>
              <td><StatusBadge :label="String(c.status ?? '-')" /></td>
              <td>{{ c.age ?? '-' }}</td>
            </tr>
          </tbody>
        </table>
      </PanelCard>

      <PanelCard title="learned 生命周期明细" flat>
        <EmptyState v-if="lifecycle.length === 0" icon="◇" title="无 learned 模式" />
        <ul v-else class="lc-list">
          <li v-for="(l, i) in lifecycle" :key="i">
            <code class="mono">{{ l.name ?? '-' }}</code>
            <StatusBadge :label="String(l.state ?? '-')" />
            <span class="muted">age {{ l.age ?? '-' }} · hits {{ l.hits ?? '-' }}</span>
          </li>
        </ul>
      </PanelCard>
    </template>
  </div>
</template>

<style scoped>
.view-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.view-head h1 { font-size: 16px; margin: 0; }
.muted { color: var(--t3); }
.err { color: var(--rd); }
.mono { font-family: inherit; }
.small { font-size: 10px; color: var(--t2); }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); margin-bottom: var(--gap); }
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
.kv.inline { display: grid; grid-template-columns: repeat(4, max-content 1fr); gap: 4px 16px; }
.kv dt { color: var(--t3); font-size: 11px; letter-spacing: 0.06em; }
.kv dd { margin: 0; }
.gate-list { list-style: none; padding: 0; margin: 0; }
.gate-list li { display: grid; grid-template-columns: 200px 200px; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed var(--bd); }
.gate-id { color: var(--cy); font-size: 12px; }
.cands-table { width: 100%; border-collapse: collapse; }
.cands-table th, .cands-table td { text-align: left; padding: 4px 8px; border-bottom: 1px dashed var(--bd); font-size: 12px; }
.cands-table th { color: var(--t3); font-weight: normal; letter-spacing: 0.06em; }
.lc-list { list-style: none; padding: 0; margin: 0; }
.lc-list li { display: flex; gap: 8px; align-items: center; padding: 4px 0; border-bottom: 1px dashed var(--bd); }
</style>