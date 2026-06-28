<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getJson } from '../api/client.js';
import type { ReportsViewModel, ReportEntry } from '../api/types.js';
import PanelCard from '../components/common/PanelCard.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const sessionId = computed(() => String(route.params.id ?? ''));

const loading = ref(true);
const error = ref<string | null>(null);
const reports = ref<ReportEntry[]>([]);
const insights = ref<unknown[]>([]);
const selected = ref<ReportEntry | null>(null);
const preview = ref<string>('');
const previewLoading = ref(false);
const previewError = ref<string | null>(null);

async function load(): Promise<void> {
  if (!sessionId.value) return;
  loading.value = true;
  error.value = null;
  try {
    const data = await getJson<Partial<ReportsViewModel>>(
      `/api/sessions/${sessionId.value}/reports`
    );
    reports.value = data.reports ?? [];
    insights.value = data.insights ?? [];
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

function fileUrl(r: ReportEntry): string {
  return `/api/sessions/${sessionId.value}/artifacts/content?path=${encodeURIComponent(r.relativePath)}`;
}

async function previewReport(r: ReportEntry): Promise<void> {
  selected.value = r;
  preview.value = '';
  previewError.value = null;
  previewLoading.value = true;
  try {
    const res = await fetch(fileUrl(r));
    if (!res.ok) {
      previewError.value = `${res.status} ${res.url}`;
    } else {
      preview.value = await res.text();
    }
  } catch (e) {
    previewError.value = (e as Error).message;
  } finally {
    previewLoading.value = false;
  }
}

function fmtSize(n?: number): string {
  if (!n) return '-';
  return n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
}

const selectedLabel = computed(() => selected.value?.relativePath ?? '');

onMounted(load);
</script>

<template>
  <div class="view">
    <div class="view-head">
      <h1>报告与追溯</h1>
      <span class="muted">session: {{ sessionId }}</span>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <EmptyState
      v-if="!loading && !error && reports.length === 0 && !sessionId"
      icon="✶"
      title="无 session 或无报告"
      description="session 完成且生成了 report 后将在此出现"
    />

    <div class="reports-layout">
      <PanelCard :title="`报告列表（${reports.length}）`">
        <EmptyState v-if="reports.length === 0" icon="🗏" title="无报告产物" />
        <ul v-else class="report-list">
          <li
            v-for="r in reports"
            :key="r.relativePath"
            :class="{ active: selected?.relativePath === r.relativePath }"
            @click="previewReport(r)"
          >
            <span class="kind">{{ r.reportType }}</span>
            <code class="mono">{{ r.relativePath }}</code>
            <span class="muted">{{ fmtSize(r.size) }}</span>
          </li>
        </ul>
      </PanelCard>

      <PanelCard :title="selected ? `预览 · ${selectedLabel}` : 'Markdown 预览'" accent>
        <EmptyState
          v-if="!selected"
          icon="◈"
          title="点击左侧报告"
          description="将通过 /artifacts/content?path= 拉取 Markdown 全文"
        />
        <div v-else class="preview-pane">
          <div class="row">
            <a class="link" :href="fileUrl(selected)" target="_blank" rel="noreferrer">在新窗口打开 ↗</a>
            <RouterLink class="link" :to="`/sessions/${sessionId}/baseline`">→ 追溯入口</RouterLink>
          </div>
          <p v-if="previewLoading" class="muted">加载中…</p>
          <p v-if="previewError" class="err">{{ previewError }}</p>
          <pre v-if="preview" class="md">{{ preview }}</pre>
        </div>
      </PanelCard>
    </div>

    <PanelCard v-if="insights.length > 0" title="insights" flat>
      <ul class="insight-list">
        <li v-for="(it, i) in insights" :key="i" class="muted">{{ JSON.stringify(it) }}</li>
      </ul>
    </PanelCard>
  </div>
</template>

<style scoped>
.view-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.view-head h1 { font-size: 16px; margin: 0; }
.muted { color: var(--t3); }
.mono { font-family: inherit; }
.err { color: var(--rd); }
.link { color: var(--cy); }
.link:hover { color: var(--ac); }
.reports-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: var(--gap);
}
.report-list { list-style: none; padding: 0; margin: 0; }
.report-list li {
  display: grid;
  grid-template-columns: 90px 1fr auto;
  gap: 8px;
  cursor: pointer;
  padding: 6px 4px;
  border-bottom: 1px dashed var(--bd);
  align-items: baseline;
}
.report-list li:hover { background: var(--bg2); }
.report-list li.active { background: rgba(0, 255, 136, 0.08); border-left: 2px solid var(--ac); padding-left: 6px; }
.report-list .kind { color: var(--cy); font-size: 10px; letter-spacing: 0.06em; border: 1px solid var(--bd); padding: 1px 6px; border-radius: 999px; }
.preview-pane { display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; gap: 12px; align-items: center; }
.md {
  height: 480px;
  overflow: auto;
  background: var(--bg0);
  border: 1px solid var(--bd);
  border-radius: var(--radius-sm);
  padding: 8px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--t2);
}
.insight-list { list-style: none; padding: 0; margin: 0; }
.insight-list li { padding: 2px 0; font-size: 11px; }
</style>