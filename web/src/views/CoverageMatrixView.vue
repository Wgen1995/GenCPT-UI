<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getJson } from '../api/client.js';
import PanelCard from '../components/common/PanelCard.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const sessionId = computed(() => String(route.params.id ?? ''));

interface CoverageCell {
  pattern?: string;
  status?: string;
  confidence?: string;
  evidence?: string;
  [k: string]: unknown;
}
interface CoverageRow {
  surface?: string;
  cells?: Record<string, CoverageCell>;
  counts?: Record<string, number>;
  [k: string]: unknown;
}
interface CoverageData {
  surfaces?: CoverageRow[];
  statuses?: string[];
  patterns?: string[];
  matrix?: CoverageRow[];
  maxBlindSpot?: string;
  gapList?: string[];
  retestSuggestions?: string[];
  total?: number;
  triggered?: number;
  [k: string]: unknown;
}

const loading = ref(true);
const error = ref<string | null>(null);
const data = ref<CoverageData | null>(null);

async function load(): Promise<void> {
  if (!sessionId.value) return;
  loading.value = true;
  error.value = null;
  data.value = null;
  try {
    const res = await getJson<{ coverage: CoverageData | null }>(
      `/api/sessions/${sessionId.value}/coverage`
    );
    data.value = res.coverage ?? null;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

const rows = computed<CoverageRow[]>(() => (data.value?.surfaces ?? data.value?.matrix ?? []) as CoverageRow[]);
const cols = computed(() => (data.value?.patterns ?? data.value?.statuses ?? []) as string[]);

function cellOf(row: CoverageRow, col: string): CoverageCell | null {
  const cells = (row.cells ?? {}) as Record<string, CoverageCell>;
  if (cells[col]) return cells[col];
  return null;
}

function statusClass(c: CoverageCell | null): string {
  if (!c || c.status === undefined) return 'cell-na';
  const v = String(c.status).toLowerCase();
  if (v === '已触发' || v === 'triggered' || v === 'confirmed') return 'cell-triggered';
  if (v === '未触发' || v === 'pending' || v === 'idle') return 'cell-idle';
  if (v === '已证伪' || v === 'refuted') return 'cell-refuted';
  if (v === '已阻断' || v === 'blocked') return 'cell-blocked';
  if (v === '未覆盖' || v === 'uncovered' || v === 'gap') return 'cell-gap';
  return 'cell-na';
}

function cellText(c: CoverageCell | null): string {
  if (!c || c.status === undefined) return '·';
  return String(c.status ?? '·');
}

onMounted(load);
</script>

<template>
  <div class="view coverage-view">
    <div class="view-head">
      <h1>覆盖矩阵与防漏视图</h1>
      <span class="muted">session: {{ sessionId }}</span>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <EmptyState
      v-if="!loading && !error && (!data || rows.length === 0)"
      icon="◈"
      title="覆盖矩阵未生成"
      description="完成 Phase 8 后在此查看 7 大攻击面 × 攻击模式的覆盖状态"
    />

    <template v-if="data && rows.length > 0">
      <div class="grid-2">
        <PanelCard title="覆盖总览" accent>
          <dl class="kv inline">
            <dt>攻击面</dt><dd>{{ rows.length }}</dd>
            <dt>模式</dt><dd>{{ cols.length }}</dd>
            <dt>已触发</dt><dd>{{ data.triggered ?? '-' }}</dd>
            <dt>合计</dt><dd>{{ data.total ?? rows.length * Math.max(1, cols.length) }}</dd>
          </dl>
        </PanelCard>

        <PanelCard title="最大盲区">
          <p>{{ data.maxBlindSpot ?? '未检测到明显盲区' }}</p>
        </PanelCard>
      </div>

      <PanelCard title="覆盖矩阵" flat>
        <div class="matrix-scroll">
          <table class="matrix">
            <thead>
              <tr>
                <th class="surface-col">攻击面 / 模式</th>
                <th v-for="(p, i) in cols" :key="i">{{ p }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in rows" :key="i">
                <td class="surface-col">{{ r.surface ?? '-' }}</td>
                <td
                  v-for="(p, j) in cols"
                  :key="j"
                  :class="statusClass(cellOf(r, p))"
                  :title="cellOf(r, p)?.evidence ?? ''"
                >
                  {{ cellText(cellOf(r, p)) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="legend">
          <span class="lg cell-triggered">已触发</span>
          <span class="lg cell-idle">未触发</span>
          <span class="lg cell-refuted">已证伪</span>
          <span class="lg cell-blocked">已阻断</span>
          <span class="lg cell-gap">未覆盖</span>
          <span class="lg cell-na">N/A</span>
        </div>
      </PanelCard>

      <PanelCard title="补测建议" flat>
        <EmptyState v-if="(data.retestSuggestions ?? []).length === 0 && (data.gapList ?? []).length === 0" icon="◇" title="暂无补测建议（覆盖完整）" />
        <ul v-else class="suggest-list">
          <li v-for="(g, i) in (data.retestSuggestions ?? data.gapList ?? [])" :key="i" class="muted">· {{ g }}</li>
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
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); margin-bottom: var(--gap); }
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
.kv.inline { grid-template-columns: repeat(4, max-content 1fr); }
.kv dt { color: var(--t3); font-size: 11px; letter-spacing: 0.06em; }
.kv dd { margin: 0; }
.matrix-scroll { overflow-x: auto; }
.matrix { width: 100%; border-collapse: collapse; font-size: 11px; }
.matrix th, .matrix td {
  border: 1px solid var(--bd);
  padding: 4px 6px;
  text-align: center;
  white-space: nowrap;
}
.matrix th { color: var(--t3); font-weight: normal; background: var(--bg1); }
.matrix .surface-col { text-align: left; color: var(--t1); background: var(--bg1); position: sticky; left: 0; }
.cell-triggered { background: rgba(0, 255, 136, 0.18); color: var(--ac); }
.cell-idle { background: rgba(0, 180, 216, 0.10); color: var(--cy); }
.cell-refuted { background: rgba(248, 81, 73, 0.15); color: var(--rd); }
.cell-blocked { background: rgba(163, 113, 247, 0.18); color: var(--pp); }
.cell-gap { background: rgba(255, 184, 0, 0.20); color: var(--am); }
.cell-na { background: var(--bg1); color: var(--t3); }
.legend { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.lg { padding: 2px 6px; border: 1px solid var(--bd); border-radius: 3px; font-size: 11px; }
.suggest-list { list-style: none; padding: 0; margin: 0; }
.suggest-list li { padding: 2px 0; }
</style>