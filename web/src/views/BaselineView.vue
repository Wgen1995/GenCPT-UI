<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getJson } from '../api/client.js';
import PanelCard from '../components/common/PanelCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const sessionId = computed(() => String(route.params.id ?? ''));

interface BaselineEntry {
  category?: string;
  severity?: string;
  status?: string;
  description?: string;
  detail?: string;
  [k: string]: unknown;
}
interface BaselineData {
  used?: boolean;
  baselineVersion?: string;
  compareVersion?: string;
  compatibility?: string;
  redLines?: string[];
  newRisks?: BaselineEntry[];
  fixedRisks?: BaselineEntry[];
  ongoingRisks?: BaselineEntry[];
  summary?: Record<string, unknown>;
  [k: string]: unknown;
}

const loading = ref(true);
const error = ref<string | null>(null);
const data = ref<BaselineData | null>(null);

async function load(): Promise<void> {
  if (!sessionId.value) return;
  loading.value = true;
  error.value = null;
  data.value = null;
  try {
    const res = await getJson<{ baseline: BaselineData | null }>(
      `/api/sessions/${sessionId.value}/baseline`
    );
    data.value = res.baseline ?? null;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

const used = computed(() => Boolean(data.value?.used));
const newRisks = computed<BaselineEntry[]>(() => (data.value?.newRisks ?? []) as BaselineEntry[]);
const fixedRisks = computed<BaselineEntry[]>(() => (data.value?.fixedRisks ?? []) as BaselineEntry[]);
const ongoingRisks = computed<BaselineEntry[]>(() => (data.value?.ongoingRisks ?? []) as BaselineEntry[]);
const redLines = computed<string[]>(() => (data.value?.redLines ?? []) as string[]);

function severityState(s: string): 'pass' | 'warn' | 'fail' | 'na' {
  const v = String(s ?? '').toLowerCase();
  if (v === 'critical' || v === 'high') return 'fail';
  if (v === 'medium') return 'warn';
  if (v === 'low' || v === 'info') return 'na';
  return 'warn';
}

onMounted(load);
</script>

<template>
  <div class="view baseline-view">
    <div class="view-head">
      <h1>Baseline 与历史对比</h1>
      <span class="muted">session: {{ sessionId }}</span>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <EmptyState
      v-if="!loading && !error && (!data || !used)"
      icon="◈"
      title="未使用 baseline 或无历史数据"
      description="在启动评估时指定 `--baseline` 参数即可启用历史对比"
    />

    <template v-if="data && used">
      <div class="grid-2">
        <PanelCard title="Baseline 概览" accent>
          <dl class="kv">
            <dt>Baseline 版本</dt><dd class="mono">{{ data.baselineVersion ?? '-' }}</dd>
            <dt>对比版本</dt><dd class="mono">{{ data.compareVersion ?? '-' }}</dd>
            <dt>兼容性</dt><dd>{{ data.compatibility ?? '-' }}</dd>
            <dt>本次使用</dt><dd><StatusBadge state="pass" label="已启用" /></dd>
          </dl>
        </PanelCard>

        <PanelCard title="Baseline 红线提示">
          <ul v-if="redLines.length > 0" class="red-list">
            <li v-for="(r, i) in redLines" :key="i" class="red-item">⚠ {{ r }}</li>
          </ul>
          <p v-else class="muted">无红线提示</p>
        </PanelCard>
      </div>

      <div class="grid-3">
        <PanelCard title="新增风险" flat>
          <EmptyState v-if="newRisks.length === 0" icon="◇" title="无新增风险" />
          <ul v-else class="risk-list">
            <li v-for="(r, i) in newRisks" :key="i">
              <StatusBadge :state="severityState(String(r.severity ?? ''))" :label="String(r.severity ?? '-')" />
              <p class="risk-desc">{{ r.description ?? r.detail ?? '-' }}</p>
            </li>
          </ul>
        </PanelCard>

        <PanelCard title="已修复风险" flat>
          <EmptyState v-if="fixedRisks.length === 0" icon="◇" title="无已修复" />
          <ul v-else class="risk-list">
            <li v-for="(r, i) in fixedRisks" :key="i">
              <StatusBadge state="pass" label="已修复" />
              <p class="risk-desc">{{ r.description ?? r.detail ?? '-' }}</p>
            </li>
          </ul>
        </PanelCard>

        <PanelCard title="持续风险" flat>
          <EmptyState v-if="ongoingRisks.length === 0" icon="◇" title="无持续风险" />
          <ul v-else class="risk-list">
            <li v-for="(r, i) in ongoingRisks" :key="i">
              <StatusBadge :state="severityState(String(r.severity ?? ''))" :label="String(r.severity ?? '-')" />
              <p class="risk-desc">{{ r.description ?? r.detail ?? '-' }}</p>
            </li>
          </ul>
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
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); margin-bottom: var(--gap); }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--gap); }
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
.kv dt { color: var(--t3); font-size: 11px; letter-spacing: 0.06em; }
.kv dd { margin: 0; }
.red-list { list-style: none; padding: 0; margin: 0; }
.red-item { color: var(--rd); padding: 4px 0; border-bottom: 1px dashed var(--bd); font-size: 12px; }
.risk-list { list-style: none; padding: 0; margin: 0; }
.risk-list li { padding: 6px 0; border-bottom: 1px dashed var(--bd); }
.risk-desc { margin: 4px 0 0; font-size: 12px; color: var(--t2); }
</style>