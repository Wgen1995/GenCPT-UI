<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getJson } from '../api/client.js';
import PanelCard from '../components/common/PanelCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const sessionId = computed(() => String(route.params.id ?? ''));

interface QualityResponse {
  sessionId?: string;
  verdict?: 'deliverable' | 'review' | 'blocked' | 'pending';
  checks?: Array<{ id: string; label: string; state: string; detail?: string }>;
  warnings?: unknown[];
  summary?: Record<string, unknown>;
}

const loading = ref(true);
const error = ref<string | null>(null);
const data = ref<QualityResponse | null>(null);

const CHECK_DEFS: Array<{ id: string; label: string }> = [
  { id: 'phase-must-output', label: 'Phase MUST 输出齐全' },
  { id: 'compliance-triple-verify', label: '合规三重校验（文本 + SSH + 理由）' },
  { id: 'five-state-closure', label: '五态闭环（[ ] 必须为 0）' },
  { id: 'candidate-closure', label: '攻击候选闭环' },
  { id: 'qa-three-layer', label: 'QA 三层（自检 / 语义抽检 / abstract review）' },
  { id: 'coverage-matrix', label: '覆盖矩阵完整' }
];

const checks = computed(() => data.value?.checks ?? []);
const verdict = computed(() => data.value?.verdict ?? null);
const verdictState = computed(() => {
  switch (verdict.value) {
    case 'deliverable': return 'pass';
    case 'review': return 'warn';
    case 'blocked': return 'fail';
    default: return 'pending';
  }
});
const verdictLabel = computed(() => {
  switch (verdict.value) {
    case 'deliverable': return '可交付';
    case 'review': return '需复核';
    case 'blocked': return '不可交付';
    default: return 'pending';
  }
});

const hasSession = computed(() => Boolean(sessionId.value));
const openBracket = computed(() => {
  const s = (data.value?.summary as Record<string, unknown>) ?? {};
  return Number(s.openCandidates ?? s.bracketOpen ?? 0);
});

function findCheck(id: string): { state: string; detail?: string } | null {
  const hit = checks.value.find((c) => c.id === id);
  if (!hit) return null;
  return { state: String(hit.state), detail: hit.detail };
}

async function load(): Promise<void> {
  if (!sessionId.value) return;
  loading.value = true;
  error.value = null;
  try {
    data.value = await getJson<QualityResponse>(
      `/api/sessions/${sessionId.value}/quality-gates`
    );
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="view">
    <div class="view-head">
      <h1>质量门禁</h1>
      <span class="muted">session: {{ sessionId || '(无)' }}</span>
    </div>

    <EmptyState
      v-if="!hasSession"
      icon="✶"
      title="无 session 或 session 未完成"
      description="请先启动或导入 session，质量门禁依赖于完整产物"
    />

    <p v-else-if="error" class="err">{{ error }}</p>

    <template v-else-if="!loading && data">
      <PanelCard title="质量状态结论" accent>
        <div class="verdict-row">
          <StatusBadge
            :state="(verdictState as any) ?? 'pending'"
            :label="verdictLabel"
          />
          <p class="verdict-desc">{{ verdictLabel }}</p>
        </div>
        <p class="muted">未闭环候选（[ ]）：{{ openBracket }}{{ openBracket > 0 ? ' · 不可交付' : '' }}</p>
      </PanelCard>

      <PanelCard title="检查列表" flat>
        <ul class="check-list">
          <li v-for="def in CHECK_DEFS" :key="def.id">
            <StatusBadge
              :state="(findCheck(def.id)?.state as any) ?? 'pending'"
              :label="(findCheck(def.id)?.state as any)?.toUpperCase() ?? 'PENDING'"
            />
            <span class="check-label">{{ def.label }}</span>
            <code v-if="findCheck(def.id)?.detail" class="detail">{{ findCheck(def.id)?.detail }}</code>
          </li>
        </ul>
      </PanelCard>

      <PanelCard v-if="(data.warnings ?? []).length > 0" title="QG 警告" flat>
        <ul class="warn-list">
          <li v-for="(w, i) in (data.warnings ?? [])" :key="i" class="muted">
            {{ JSON.stringify(w) }}
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
.verdict-row { display: flex; align-items: center; gap: 12px; }
.verdict-desc { font-weight: 700; letter-spacing: 0.08em; color: var(--ac); margin: 0; }
.check-list { list-style: none; padding: 0; margin: 0; }
.check-list li { display: grid; grid-template-columns: 130px 1fr max-content; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px dashed var(--bd); }
.check-label { color: var(--t1); }
.detail { color: var(--t2); font-size: 11px; }
.warn-list { list-style: none; padding: 0; margin: 0; }
</style>