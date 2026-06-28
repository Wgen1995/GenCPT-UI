<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { getJson } from '../api/client.js';
import PanelCard from '../components/common/PanelCard.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const sessionId = computed(() => String(route.params.id ?? ''));

interface GraphNode {
  id?: string;
  label?: string;
  type?: string;
  [k: string]: unknown;
}
interface GraphEdge {
  id?: string;
  source?: string;
  target?: string;
  type?: string;
  label?: string;
  [k: string]: unknown;
}
interface GraphData {
  nodeCount?: number;
  edgeCount?: number;
  nodeTypes?: Record<string, number>;
  edgeTypes?: Record<string, number>;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  [k: string]: unknown;
}

const loading = ref(true);
const error = ref<string | null>(null);
const graph = ref<GraphData | null>(null);

const chartHost = ref<HTMLDivElement | null>(null);
let chart: { dispose(): void; resize(): void } | null = null;

const nodeCount = computed(() => graph.value?.nodeCount ?? 0);
const edgeCount = computed(() => graph.value?.edgeCount ?? 0);
const nodeTypes = computed(() => {
  const t = graph.value?.nodeTypes ?? {};
  return Object.entries(t).sort((a, b) => b[1] - a[1]);
});
const edgeTypes = computed(() => {
  const t = graph.value?.edgeTypes ?? {};
  return Object.entries(t).sort((a, b) => b[1] - a[1]);
});

async function load(): Promise<void> {
  if (!sessionId.value) return;
  loading.value = true;
  error.value = null;
  graph.value = null;
  try {
    const res = await getJson<{ graph: GraphData | null }>(
      `/api/sessions/${sessionId.value}/graph`
    );
    graph.value = res.graph ?? null;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function ensureChart(): Promise<void> {
  if (loading.value || error.value) return;
  if (!graph.value || nodeCount.value === 0) return;
  if (!chartHost.value) return;
  // dispose previous
  unmountChart();
  try {
    const mod = await import('echarts') as unknown as { default?: { init: (el: HTMLElement) => unknown }; init?: (el: HTMLElement) => unknown };
    const echarts = mod.default ?? mod;
    chart = (echarts as { init: (el: HTMLElement) => unknown }).init(chartHost.value) as { dispose(): void; resize(): void };
    const nodes = (graph.value?.nodes ?? []) as GraphNode[];
    const edges = (graph.value?.edges ?? []) as GraphEdge[];
    (chart as unknown as { setOption(o: unknown): void }).setOption({
      animation: true,
      tooltip: {},
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          label: { show: true, position: 'right', color: '#e6edf3', fontSize: 11 },
          force: { repulsion: 80, edgeLength: 60, gravity: 0.1 },
          data: nodes.slice(0, 200).map((n, i) => ({
            id: String(n.id ?? n.label ?? i),
            name: String(n.label ?? n.id ?? n.type ?? `n${i}`),
            category: String(n.type ?? 'unknown'),
            symbolSize: 12
          })),
          links: edges.slice(0, 400).map((e) => ({
            source: String(e.source ?? ''),
            target: String(e.target ?? ''),
            value: String(e.label ?? e.type ?? '')
          })),
          lineStyle: { color: '#2a3f58', width: 1, curveness: 0.1 },
          emphasis: { focus: 'adjacency' }
        }
      ]
    });
  } catch {
    // echarts unavailable — table views still work
  }
}

function unmountChart(): void {
  if (chart) {
    try { chart.dispose(); } catch { /* ignore */ }
    chart = null;
  }
}

function onResize(): void {
  if (chart) {
    try { chart.resize(); } catch { /* ignore */ }
  }
}

watch([loading, error, graph, nodeCount], () => {
  void nextTick(() => { void ensureChart(); });
});

onMounted(() => {
  void load();
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  unmountChart();
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <div class="view knowledge-graph-view">
    <div class="view-head">
      <h1>知识图谱与资产画像</h1>
      <span class="muted">session: {{ sessionId }}</span>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <EmptyState
      v-if="!loading && !error && (!graph || nodeCount === 0)"
      icon="◈"
      title="知识图谱未生成或文件缺失"
      description="请在执行阶段确保 Phase 产出 knowledge-graph.json（或其他 graph 产物）"
    />

    <template v-if="graph && nodeCount > 0">
      <div class="grid-2">
        <PanelCard title="图谱概览" accent>
          <dl class="kv">
            <dt>节点</dt><dd>{{ nodeCount }}</dd>
            <dt>边</dt><dd>{{ edgeCount }}</dd>
            <dt>节点类型</dt><dd>{{ nodeTypes.length }}</dd>
            <dt>边类型</dt><dd>{{ edgeTypes.length }}</dd>
          </dl>
        </PanelCard>

        <PanelCard title="节点类型分布">
          <ul class="dist-list">
            <li v-for="[k, v] in nodeTypes" :key="k">
              <span class="key">{{ k }}</span>
              <span class="bar" :style="{ '--w': `${Math.min(100, (v / Math.max(1, nodeCount)) * 100)}%` }" />
              <span class="num">{{ v }}</span>
            </li>
          </ul>
        </PanelCard>
      </div>

      <PanelCard title="边类型分布" flat>
        <ul class="dist-list">
          <li v-for="[k, v] in edgeTypes" :key="k">
            <span class="key">{{ k }}</span>
            <span class="bar" :style="{ '--w': `${Math.min(100, (v / Math.max(1, edgeCount)) * 100)}%` }" />
            <span class="num">{{ v }}</span>
          </li>
        </ul>
      </PanelCard>

      <PanelCard title="力导向图（交互式）" flat>
        <div ref="chartHost" class="chart-host"></div>
        <p class="muted" v-if="!chart">如未渲染，说明 echarts 未就绪或节点过多；上方分布表仍可读。</p>
      </PanelCard>
    </template>
  </div>
</template>

<style scoped>
.view-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.view-head h1 { font-size: 16px; margin: 0; }
.muted { color: var(--t3); }
.err { color: var(--rd); }
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--gap);
  margin-bottom: var(--gap);
}
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
.kv dt { color: var(--t3); font-size: 11px; letter-spacing: 0.06em; }
.kv dd { margin: 0; }
.dist-list { list-style: none; padding: 0; margin: 0; }
.dist-list li {
  display: grid;
  grid-template-columns: 160px 1fr 50px;
  gap: 8px;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px dashed var(--bd);
}
.dist-list .key { color: var(--t2); font-size: 12px; }
.dist-list .bar {
  display: block;
  height: 6px;
  background: var(--bg1);
  border-radius: 3px;
  position: relative;
}
.dist-list .bar::after {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: var(--w, 0%);
  background: linear-gradient(90deg, var(--cy), var(--ac));
  border-radius: 3px;
}
.dist-list .num { text-align: right; color: var(--ac); }
.chart-host {
  width: 100%;
  height: 480px;
  border: 1px solid var(--bd);
  border-radius: var(--radius-sm);
  background: var(--bg1);
}
</style>