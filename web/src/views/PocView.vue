<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getJson } from '../api/client.js';
import PanelCard from '../components/common/PanelCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const sessionId = computed(() => String(route.params.id ?? ''));

interface PocCmdGroup {
  precondition?: string[];
  attack?: string[];
  diff?: string[];
  cleanup?: string[];
  [k: string]: unknown;
}
interface PocEntry {
  id?: string;
  relatedVuln?: string;
  relatedAtkCand?: string;
  relatedChain?: string;
  confidence?: string;
  status?: string;
  commands?: PocCmdGroup;
  description?: string;
  [k: string]: unknown;
}
interface PocData {
  pocs?: PocEntry[];
  bundlePath?: string;
  [k: string]: unknown;
}

const loading = ref(true);
const error = ref<string | null>(null);
const data = ref<PocData | null>(null);

async function load(): Promise<void> {
  if (!sessionId.value) return;
  loading.value = true;
  error.value = null;
  data.value = null;
  try {
    const res = await getJson<{ poc: PocData | null }>(
      `/api/sessions/${sessionId.value}/poc`
    );
    data.value = res.poc ?? null;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

const pocs = computed<PocEntry[]>(() => (data.value?.pocs ?? []) as PocEntry[]);

function cmdList(p: PocEntry, key: keyof PocCmdGroup): string[] {
  const g = p.commands ?? {};
  const v = g[key];
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === 'string') return [v];
  return [];
}

function confidenceOf(c: string): 'C1' | 'C2' | 'C3' | undefined {
  const v = String(c ?? '').toUpperCase();
  if (v === 'C1' || v === 'C2' || v === 'C3') return v;
  return undefined;
}

onMounted(load);
</script>

<template>
  <div class="view poc-view">
    <div class="view-head">
      <h1>POC 与复现包</h1>
      <span class="muted">session: {{ sessionId }}</span>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <EmptyState
      v-if="!loading && !error && (!data || pocs.length === 0)"
      icon="◈"
      title="无 confirmed 或 condition_met 攻击链"
      description="仅当存在已确认/条件满足的攻击链时才会生成 POC（Phase 7）"
    />

    <template v-if="data && pocs.length > 0">
      <PanelCard v-if="data.bundlePath" title="POC 复现包" flat>
        <p class="muted">包路径：<code class="mono">{{ data.bundlePath }}</code></p>
      </PanelCard>

      <div class="poc-list">
        <PanelCard
          v-for="(p, i) in pocs"
          :key="p.id ?? i"
          :title="`POC · ${p.id ?? i + 1}`"
          accent
        >
          <dl class="kv">
            <dt>关联漏洞</dt><dd class="mono">{{ p.relatedVuln ?? '-' }}</dd>
            <dt>ATK-CAND</dt><dd class="mono">{{ p.relatedAtkCand ?? '-' }}</dd>
            <dt>CHAIN</dt><dd class="mono">{{ p.relatedChain ?? '-' }}</dd>
            <dt>状态</dt><dd><StatusBadge :label="String(p.status ?? '-')" /></dd>
            <dt>可信度</dt>
            <dd><StatusBadge v-if="confidenceOf(String(p.confidence ?? ''))" :tier="confidenceOf(String(p.confidence ?? ''))" /></dd>
          </dl>
          <p v-if="p.description" class="desc">{{ p.description }}</p>

          <div class="cmd-grid">
            <div class="cmd-block">
              <span class="lbl">前置条件</span>
              <pre class="cmd">{{ cmdList(p, 'precondition').join('\n') || '—' }}</pre>
            </div>
            <div class="cmd-block">
              <span class="lbl lbl-atk">攻击验证</span>
              <pre class="cmd">{{ cmdList(p, 'attack').join('\n') || '—' }}</pre>
            </div>
            <div class="cmd-block">
              <span class="lbl lbl-diff">差分证明</span>
              <pre class="cmd">{{ cmdList(p, 'diff').join('\n') || '—' }}</pre>
            </div>
            <div class="cmd-block">
              <span class="lbl lbl-cln">清理</span>
              <pre class="cmd">{{ cmdList(p, 'cleanup').join('\n') || '—' }}</pre>
            </div>
          </div>
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
.poc-list { display: flex; flex-direction: column; gap: var(--gap); }
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0 0 8px; }
.kv dt { color: var(--t3); font-size: 11px; letter-spacing: 0.06em; }
.kv dd { margin: 0; }
.desc { color: var(--t2); font-size: 12px; margin: 0 0 8px; }
.cmd-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.cmd-block { display: flex; flex-direction: column; gap: 4px; }
.lbl { font-size: 10px; letter-spacing: 0.08em; color: var(--cy); }
.lbl-atk { color: var(--ac); }
.lbl-diff { color: var(--pp); }
.lbl-cln { color: var(--am); }
.cmd {
  background: var(--bg0);
  border: 1px solid var(--bd);
  border-radius: var(--radius-sm);
  padding: 6px;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 220px;
  overflow: auto;
}
</style>