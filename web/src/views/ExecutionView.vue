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
  gencptSessionId?: string | null;
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

interface FailureDetail {
  title: string;
  reason: string;
  timedOut: boolean;
  details?: string;
}
const failureDetail = ref<FailureDetail | null>(null);

let pollEvents: ReturnType<typeof setInterval> | null = null;
const eventsLoaded = ref(0);
let eventsAccumulated: SessionEvent[] = [];

function formatJsonLine(chunk: string): string {
  const trimmed = chunk.trim();
  if (!trimmed.startsWith('{')) return chunk;
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    switch (obj.type) {
      case 'step_start': return '\n─────────────────────────────────';
      case 'step_finish': return '─────────────────────────────────\n';
      case 'text': {
        const t = String((obj.part as Record<string,unknown>)?.text ?? '');
        return t;
      }
      case 'tool_use': {
        const p = obj.part as Record<string,unknown>;
        const tool = String(p?.tool ?? 'tool');
        const input = p?.state as Record<string,unknown> | undefined;
        const cmd = input?.input as Record<string,unknown> | undefined;
        if (tool === 'skill') return `▶ 加载 GenCPT skill`;
        if (tool === 'Task') return `▶ 启动子代理`;
        if (tool.startsWith('ssh')) {
          const server = cmd?.server ?? '';
          const command = cmd?.command ?? cmd?.cmd ?? '';
          return `▶ SSH ${server}: ${command}`;
        }
        if (tool === 'question') return `? ${String(cmd?.questions ?? '')}`;
        return `▶ ${tool}`;
      }
      case 'tool_result': {
        const p = obj.part as Record<string,unknown>;
        const tool = String(p?.tool ?? '');
        const output = p?.state as Record<string,unknown> | undefined;
        const ok = output?.status === 'completed' ? '✓' : '✗';
        const summary = String(output?.output ?? '').slice(0, 120);
        if (tool === 'ssh-manager_ssh_execute') return `  ${ok} ${summary}`;
        return `  ${ok}`;
      }
      case 'reasoning': return '';  // 隐藏推理块
      default: return '';
    }
  } catch { return chunk; }
}

const stdout = computed(() => {
  return events.value
    .filter((e) => e.type === 'opencode.stdout' || e.type === 'stdout' || e.eventType === 'opencode.stdout')
    .map((e) => {
      const raw = String((e.payload as Record<string,unknown> | null)?.chunk ?? '');
      return formatJsonLine(raw);
    })
    .filter(Boolean)
    .join('\n');
});

const stderr = computed(() => {
  // 过滤掉 opencode 内部 INFO 日志，只保留真正的错误
  return events.value
    .filter((e) => e.type === 'opencode.stderr' || e.type === 'stderr' || e.eventType === 'opencode.stderr')
    .map((e) => {
      const raw = String((e.payload as Record<string,unknown> | null)?.chunk ?? '');
      if (raw.includes('level=INFO')) return '';
      return raw;
    })
    .filter(Boolean)
    .join('\n');
});

function parseFailureFromEvent(payload: Record<string, unknown>): FailureDetail | null {
  const timedOut = Boolean(payload?.timedOut);
  const stderr = payload?.stderr != null ? String(payload.stderr) : '';
  const exitCode = payload?.exitCode;
  let title = '评估执行失败';
  let reason = '';
  if (timedOut) {
    title = '评估执行超时';
    reason = 'opencode 进程在超时时限内未完成（可能由余额耗尽、网络中断或目标不可达导致）。';
  } else if (stderr) {
    reason = stderr.split('\n').find((l) => l.trim().length > 0) ?? stderr.slice(0, 200);
  } else if (exitCode != null) {
    reason = `opencode 进程异常退出（exit code ${exitCode}），未捕获 stderr 输出。`;
  } else {
    return null;
  }
  return { title, reason, timedOut, details: stderr || undefined };
}

let stopStream: (() => void) | null = null;

async function loadEvents(): Promise<void> {
  if (!sessionId.value) return;
  try {
    const evs = await getJson<SessionEvent[]>(`/api/sessions/${sessionId.value}/events`);
    // Merge: keep new events since last loaded count
    if (evs.length > eventsLoaded.value) {
      const newEvts = evs.slice(eventsLoaded.value);
      for (const e of newEvts) {
        eventsAccumulated.push(e);
        countEvent(e);
      }
      events.value = [...eventsAccumulated];
      eventsLoaded.value = evs.length;
    }
  } catch {
    /* ignore */
  }
}

function countEvent(e: SessionEvent): void {
  if (e.type === 'opencode.stderr' || e.type === 'stderr' || e.eventType === 'opencode.stderr') stderrCount.value++;
  if (e.type === 'approval.requested' || e.type === 'approval_request') approvalCount.value++;
  if (e.type === 'assessment.error' || e.type === 'error') errorCount.value++;
  if (e.type === 'assessment.failed' || e.type === 'assessment.error') {
    const detail = parseFailureFromEvent((e.payload as Record<string, unknown>) ?? {});
    if (detail) failureDetail.value = detail;
    if (sessionInfo.value) sessionInfo.value = { ...sessionInfo.value, status: 'failed' };
  }
  if (e.type === 'assessment.completed') {
    if (sessionInfo.value) sessionInfo.value = { ...sessionInfo.value, status: 'completed' };
  }
}

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
    await loadEvents();
    if (s.status === 'failed' || s.status === 'completed') {
      const fail = eventsAccumulated.find((e) =>
        e.type === 'assessment.failed' || e.type === 'assessment.error' ||
        e.eventType === 'assessment.failed' || e.eventType === 'assessment.error'
      );
      if (fail) {
        failureDetail.value = parseFailureFromEvent((fail.payload as Record<string, unknown>) ?? {});
      } else if (s.status === 'failed') {
        failureDetail.value = { title: '评估执行失败', reason: '请查看下方事件流', timedOut: false };
      }
    }
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function startStream(): void {
  if (!sessionId.value) return;
  live.value = true;

  // Try SSE
  stopStream = subscribeEvents(
    sessionId.value,
    (e) => {
      eventsAccumulated.push(e);
      events.value = [...eventsAccumulated];
      countEvent(e);
    },
    () => {
      live.value = false;
      void loadSession();
    }
  );

  // Also poll events API every 2s as fallback
  pollEvents = setInterval(async () => {
    await loadEvents();
    // Refresh session status
    try {
      const s = await getJson<SessionInfo>(`/api/sessions/${sessionId.value}`);
      if (sessionInfo.value?.status !== s.status) {
        sessionInfo.value = s;
      }
      if (s.status === 'completed' || s.status === 'failed') {
        if (pollEvents) { clearInterval(pollEvents); pollEvents = null; }
        live.value = false;
        await loadSession();
      }
    } catch { /* ignore */ }
  }, 2000);
}

function stopTyping(): void {
  if (stopStream) stopStream();
  stopStream = null;
  if (pollEvents) { clearInterval(pollEvents); pollEvents = null; }
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
        <span class="muted">opencode session:</span>
        <code>{{ sessionInfo?.gencptSessionId ?? '—' }}</code>
        <span class="muted">workbench:</span>
        <code class="muted-code">{{ sessionId }}</code>
        <StatusBadge v-if="sessionInfo" :state="(sessionInfo.status as any) ?? 'pending'" />
        <StatusBadge v-if="live" state="running" label="LIVE" />
      </div>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <div v-if="failureDetail" class="alert-banner danger">
      <span class="alert-icon">⚠</span>
      <div class="alert-body">
        <div class="alert-title">{{ failureDetail.title }}</div>
        <div>{{ failureDetail.reason }}</div>
        <pre v-if="failureDetail.details">{{ failureDetail.details }}</pre>
      </div>
    </div>
    <div v-else-if="sessionInfo && sessionInfo.status === 'failed'" class="alert-banner warning">
      <span class="alert-icon">⚠</span>
      <div class="alert-body">
        <div class="alert-title">Session 状态为 failed</div>
        <div>未捕获到 assessment.failed 事件详情，可在下方事件流中查看 stderr 输出。</div>
      </div>
    </div>

    <PanelCard v-if="sessionInfo" title="Session 元信息" flat>
      <dl class="kv inline">
        <dt>server</dt><dd>{{ sessionInfo.server ?? '-' }}</dd>
        <dt>mode</dt><dd>{{ sessionInfo.mode ?? '-' }}</dd>
        <dt>scope</dt><dd>{{ sessionInfo.scope ?? '-' }}</dd>
        <dt>opencode sid</dt><dd>{{ sessionInfo.gencptSessionId ?? '-' }}</dd>
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
            title="等待执行输出…"
            description="正在连接并等待 opencode 执行内容"
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
        <StatusBadge :state="live ? 'running' : 'pending'" :label="live ? 'LIVE' : '轮询中'" />
        <span class="muted">事件: {{ events.length }}</span>
        <span class="muted">错误: {{ stderrCount }}</span>
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
.muted-code { color: var(--t3); }
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