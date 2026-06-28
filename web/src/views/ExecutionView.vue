<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getJson } from '../api/client.js';
import { subscribeEvents, type SessionEvent } from '../api/sse.js';
import PanelCard from '../components/common/PanelCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const router = useRouter();
const sessionId = computed(() => String(route.params.id ?? ''));

interface SessionInfo {
  id: string;
  status: string;
  server: string | null;
  mode: string | null;
  scope: string | null;
}

const sessionInfo = ref<SessionInfo | null>(null);
const live = ref(false);
const events = ref<SessionEvent[]>([]);
const stderrCount = ref(0);
const approvalCount = ref(0);
const errorCount = ref(0);
const phaseProgress = ref<Record<string, { state: string; wuCount: number }>>({});
const artifacts = ref<Array<{ id: string; path: string; relativePath?: string; kind: string; size?: number }>>([]);
const error = ref<string | null>(null);

let stopStream: (() => void) | null = null;

const stdout = computed(() => {
  return events.value
    .filter((e) => e.type === 'stdout' || e.type === 'log')
    .map((e) => String((e.payload as Record<string, unknown>)?.line ?? ''))
    .join('\n');
});

const stderr = computed(() => {
  return events.value
    .filter((e) => e.type === 'stderr')
    .map((e) => String((e.payload as Record<string, unknown>)?.line ?? ''))
    .join('\n');
});

async function loadSession(): Promise<void> {
  if (!sessionId.value) return;
  try {
    const s = await getJson<SessionInfo>(`/api/sessions/${sessionId.value}`);
    sessionInfo.value = s;
    try {
      const arts = await getJson<{ artifacts?: typeof artifacts.value }>(
        `/api/sessions/${sessionId.value}/artifacts`
      );
      artifacts.value = arts.artifacts ?? [];
    } catch {
      artifacts.value = [];
    }
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function startStream(): void {
  if (!sessionId.value) return;
  live.value = true;
  events.value = [];
  stderrCount.value = 0;
  approvalCount.value = 0;
  errorCount.value = 0;
  phaseProgress.value = {};

  stopStream = subscribeEvents(
    sessionId.value,
    (e) => {
      events.value.push(e);
      if (events.value.length > 5000) events.value.splice(0, events.value.length - 5000);

      if (e.type === 'stderr') stderrCount.value++;
      if (e.type === 'approval' || e.type === 'approval_request') approvalCount.value++;
      if (e.type === 'error' || e.type === 'fail') errorCount.value++;
      if (e.type === 'phase') {
        const p = (e.payload as Record<string, unknown>) ?? {};
        const name = String(p.phase ?? p.name ?? '');
        const state = String(p.state ?? 'running');
        if (name) {
          phaseProgress.value = {
            ...phaseProgress.value,
            [name]: { state, wuCount: Number(p.wuCount ?? 0) }
          };
        }
      }
    },
    () => {
      live.value = false;
      error.value = error.value ?? 'stream closed';
    }
  );
}

function stopTyping(): void {
  if (stopStream) stopStream();
  stopStream = null;
  live.value = false;
}

function goQuality(): void {
  router.push(`/sessions/${sessionId.value}/quality`);
}

onMounted(async () => {
  await loadSession();
  startStream();
});

onBeforeUnmount(() => {
  stopTyping();
});
</script>

<template>
  <div class="view execution-view">
    <div class="view-head">
      <h1>实时执行控制台</h1>
      <div class="row">
        <span class="muted">session:</span>
        <code>{{ sessionId }}</code>
        <StatusBadge v-if="sessionInfo" :state="(sessionInfo.status as any) ?? 'pending'" />
        <StatusBadge v-if="live" state="running" label="LIVE" />
      </div>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <PanelCard v-if="sessionInfo" title="Session 元信息" flat>
      <dl class="kv inline">
        <dt>server</dt><dd>{{ sessionInfo.server ?? '-' }}</dd>
        <dt>mode</dt><dd>{{ sessionInfo.mode ?? '-' }}</dd>
        <dt>scope</dt><dd>{{ sessionInfo.scope ?? '-' }}</dd>
      </dl>
    </PanelCard>

    <div class="exec-layout">
      <!-- 左：Phase / WU 进度 -->
      <PanelCard title="Phase / WU 进度">
        <EmptyState
          v-if="Object.keys(phaseProgress).length === 0"
          icon="◷"
          title="尚未收到 phase 事件"
        />
        <ul v-else class="phase-list">
          <li v-for="(info, name) in phaseProgress" :key="name">
            <StatusBadge :state="(info.state as any) ?? 'running'" />
            <span class="ph-name">{{ name }}</span>
            <span class="muted" v-if="info.wuCount > 0">WU: {{ info.wuCount }}</span>
          </li>
        </ul>
      </PanelCard>

      <!-- 中：终端输出 -->
      <PanelCard title="终端输出">
        <div class="term">
          <pre v-if="stdout" class="stdout">{{ stdout }}</pre>
          <pre v-if="stderr" class="stderr">{{ stderr }}</pre>
          <EmptyState
            v-if="!stdout && !stderr"
            icon="◈"
            title="等待事件流…"
            description="SSE 连接到 /events/stream 后将在此显示 stdout / stderr"
          />
        </div>
      </PanelCard>

      <!-- 右：产物文件 -->
      <PanelCard title="产物文件">
        <EmptyState
          v-if="artifacts.length === 0"
          icon="🗏"
          title="无产物"
          description="阶段完成后将出现报告、合规检查点等产物"
        />
        <ul v-else class="art-list">
          <li v-for="a in artifacts" :key="a.id">
            <span class="kind">{{ a.kind }}</span>
            <code>{{ a.relativePath ?? a.path }}</code>
            <span v-if="a.size" class="muted">{{ a.size }}B</span>
          </li>
        </ul>
      </PanelCard>
    </div>

    <!-- 底：事件 -->
    <PanelCard title="事件流" flat>
      <div class="row">
        <StatusBadge :state="live ? 'running' : 'pending'" :label="live ? 'LIVE' : 'CLOSED'" />
        <span class="muted">events: {{ events.length }}</span>
        <span class="muted">stderr: {{ stderrCount }}</span>
        <span class="muted approval">approval: {{ approvalCount }}</span>
        <span class="muted err">errors: {{ errorCount }}</span>
        <button @click="startStream" :disabled="!sessionId">重启 SSE</button>
        <button @click="goQuality">查看 Quality Gates →</button>
      </div>
      <ul class="event-list">
        <li v-for="(e, i) in events.slice(-200)" :key="i" :class="`ev ev-${e.type}`">
          <span class="ev-type">{{ e.type }}</span>
          <code class="ev-payload">{{ JSON.stringify(e.payload ?? {}) }}</code>
          <span v-if="e.timestamp" class="muted">{{ e.timestamp }}</span>
        </li>
      </ul>
    </PanelCard>
  </div>
</template>

<style scoped>
.exec-layout {
  display: grid;
  grid-template-columns: 220px 1fr 280px;
  gap: var(--gap);
  margin-bottom: var(--gap);
}
.view-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.view-head h1 { font-size: 16px; margin: 0; }
.view-head .row { display: flex; align-items: center; gap: 8px; }
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.muted { color: var(--t3); }
.err { color: var(--rd); }
.muted.approval { color: var(--am); }
.muted.err { color: var(--rd); }
.kv.inline { display: grid; grid-template-columns: repeat(3, max-content 1fr); gap: 4px 16px; margin: 0; }
.kv dt { color: var(--t3); font-size: 11px; }
.kv dd { margin: 0; }
.phase-list, .art-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.phase-list li { display: flex; align-items: center; gap: 8px; }
.phase-list .ph-name { font-weight: 600; }
.art-list li { display: flex; gap: 8px; align-items: baseline; }
.art-list .kind { color: var(--cy); font-size: 10px; border: 1px solid var(--bd); padding: 1px 6px; border-radius: 999px; }
.term {
  height: 320px;
  overflow: auto;
  background: var(--bg0);
  border: 1px solid var(--bd);
  border-radius: var(--radius-sm);
  padding: 6px;
}
.term pre { margin: 0; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
.term .stdout { color: var(--t2); }
.term .stderr { color: var(--am); }
.event-list { list-style: none; padding: 0; margin: 8px 0 0; max-height: 220px; overflow: auto; }
.event-list li { display: grid; grid-template-columns: 120px 1fr auto; gap: 8px; padding: 2px 0; border-bottom: 1px dashed var(--bd); }
.ev-type { color: var(--cy); font-size: 11px; }
.ev-payload { color: var(--t2); font-size: 11px; }
.ev-error .ev-type { color: var(--rd); }
.ev-approval .ev-type { color: var(--am); }
.ev-phase .ev-type { color: var(--ac); }
</style>