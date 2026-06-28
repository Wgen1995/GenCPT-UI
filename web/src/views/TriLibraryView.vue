<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getJson } from '../api/client.js';
import PanelCard from '../components/common/PanelCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const sessionId = computed(() => String(route.params.id ?? ''));

interface TriItem {
  id?: string;
  label?: string;
  source?: string;
  children?: TriItem[];
  [k: string]: unknown;
}
interface TriLibraryData {
  reasoningChains?: Array<{
    complianceRule?: string;
    chkCand?: string;
    atkHyp?: string;
    attackPattern?: string;
    atkCand?: string;
    source?: string;
    items?: TriItem[];
    [k: string]: unknown;
  }>;
  chkCands?: TriItem[];
  atkHyps?: TriItem[];
  attackPatterns?: TriItem[];
  atkCands?: TriItem[];
  byComplianceRule?: Record<string, TriItem[]>;
  libraryMeta?: { static?: number; learned?: number; llm?: number };
  [k: string]: unknown;
}

const loading = ref(true);
const error = ref<string | null>(null);
const data = ref<TriLibraryData | null>(null);

async function load(): Promise<void> {
  if (!sessionId.value) return;
  loading.value = true;
  error.value = null;
  data.value = null;
  try {
    const res = await getJson<{ triLibrary: TriLibraryData | null }>(
      `/api/sessions/${sessionId.value}/tri-library`
    );
    data.value = res.triLibrary ?? null;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

const chains = computed(() => (data.value?.reasoningChains ?? []) as Array<Record<string, unknown>>);

const counts = computed(() => ({
  chk: (data.value?.chkCands ?? []).length,
  hyp: (data.value?.atkHyps ?? []).length,
  pat: (data.value?.attackPatterns ?? []).length,
  cand: (data.value?.atkCands ?? []).length
}));

function sourceBadge(src: string): { tier?: 'L3'; state?: 'pass' | 'warn' | 'na'; label: string } {
  const v = String(src ?? '').toLowerCase();
  if (v === 'static') return { state: 'pass', label: '静态库' };
  if (v === 'learned') return { state: 'warn', label: 'learned' };
  if (v === 'llm' || v === 'llm-reasoning') return { state: 'na', label: 'LLM 推理' };
  return { state: 'na', label: src || '-' };
}

onMounted(load);
</script>

<template>
  <div class="view tri-library-view">
    <div class="view-head">
      <h1>三库联动与推理链</h1>
      <span class="muted">session: {{ sessionId }}</span>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <EmptyState
      v-if="!loading && !error && !data"
      icon="◈"
      title="三库联动数据未生成"
      description="三库＝合规规则库 / 攻击模式库 / 假设库（hypothesis-libraries）。完成 Phase 3 后可在此查看推理链"
    />

    <template v-if="data">
      <PanelCard title="四库联动概览" accent>
        <dl class="kv inline">
          <dt>CHK-CAND</dt><dd>{{ counts.chk }}</dd>
          <dt>ATK-HYP</dt><dd>{{ counts.hyp }}</dd>
          <dt>攻击模式</dt><dd>{{ counts.pat }}</dd>
          <dt>ATK-CAND</dt><dd>{{ counts.cand }}</dd>
        </dl>
      </PanelCard>

      <PanelCard title="推理链（合规 → ATK-CAND）" flat>
        <EmptyState v-if="chains.length === 0" icon="◇" title="无推理链" />
        <div v-else class="chains">
          <div v-for="(c, i) in chains" :key="i" class="chain">
            <div class="col">
              <span class="col-label">合规规则</span>
              <code class="mono">{{ c.complianceRule ?? '-' }}</code>
            </div>
            <span class="arrow">→</span>
            <div class="col">
              <span class="col-label">CHK-CAND</span>
              <code class="mono">{{ c.chkCand ?? '-' }}</code>
            </div>
            <span class="arrow">→</span>
            <div class="col">
              <span class="col-label">ATK-HYP</span>
              <code class="mono">{{ c.atkHyp ?? '-' }}</code>
            </div>
            <span class="arrow">→</span>
            <div class="col">
              <span class="col-label">攻击模式</span>
              <code class="mono">{{ c.attackPattern ?? '-' }}</code>
            </div>
            <span class="arrow">→</span>
            <div class="col">
              <span class="col-label">ATK-CAND</span>
              <code class="mono">{{ c.atkCand ?? '-' }}</code>
            </div>
            <span class="col src">
              <StatusBadge v-bind="sourceBadge(String(c.source ?? ''))" />
            </span>
          </div>
        </div>
      </PanelCard>
    </template>
  </div>
</template>

<style scoped>
.view-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.view-head h1 { font-size: 16px; margin: 0; }
.muted { color: var(--t3); }
.err { color: var(--rd); }
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
.kv.inline { display: grid; grid-template-columns: repeat(4, max-content 1fr); gap: 4px 16px; margin: 0; }
.kv dt { color: var(--t3); font-size: 11px; letter-spacing: 0.06em; }
.kv dd { margin: 0; }
.chains { display: flex; flex-direction: column; gap: 8px; }
.chain {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--bd);
  border-radius: var(--radius-sm);
  background: var(--bg1);
  flex-wrap: wrap;
}
.chain .col { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.chain .col.src { flex: 0 0 auto; }
.chain .col-label { color: var(--t3); font-size: 10px; letter-spacing: 0.08em; }
.chain .mono { font-family: inherit; font-size: 11px; color: var(--t1); word-break: break-all; }
.chain .arrow { color: var(--cy); padding: 0 2px; }
</style>