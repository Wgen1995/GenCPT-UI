<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { postJson } from '../api/client.js';
import PanelCard from '../components/common/PanelCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';

const router = useRouter();

type Mode = 'fast' | 'full' | 'custom';
type Approval = 'standard' | 'express' | 'manual';
type ScopeItem = 'k8s' | 'docker' | 'containerd' | 'all';

const tab = ref<'launch' | 'import'>('launch');

const launchForm = reactive({
  server: '',
  mode: 'fast' as Mode,
  scope: ['all'] as ScopeItem[],
  approval: 'standard' as Approval,
  sourcePath: '',
  baseline: ''
});
const launching = ref(false);
const launchErr = ref<string | null>(null);

const importForm = reactive({ sessionDir: '' });
const importing = ref(false);
const importErr = ref<string | null>(null);

const SCOPE_OPTIONS: ScopeItem[] = ['all', 'k8s', 'docker', 'containerd'];

function toggleScope(item: ScopeItem): void {
  const i = launchForm.scope.indexOf(item);
  if (i === -1) {
    launchForm.scope.push(item);
    void removeConflicting(item);
  } else {
    launchForm.scope.splice(i, 1);
  }
  if (launchForm.scope.length === 0) launchForm.scope.push('all');
}

function removeConflicting(item: ScopeItem): void {
  if (item === 'all') {
    launchForm.scope = launchForm.scope.filter((s) => s === 'all');
  } else {
    launchForm.scope = launchForm.scope.filter((s) => s !== 'all');
  }
  if (launchForm.scope.length === 0) launchForm.scope.push(item);
}

async function submitLaunch(): Promise<void> {
  if (!launchForm.server.trim()) {
    launchErr.value = 'server 不能为空';
    return;
  }
  launching.value = true;
  launchErr.value = null;
  try {
    const body = {
      server: launchForm.server.trim(),
      mode: launchForm.mode,
      scope: launchForm.scope.includes('all')
        ? (['k8s', 'docker', 'containerd'] as ScopeItem[])
        : launchForm.scope,
      approval: launchForm.approval,
      ...(launchForm.sourcePath.trim() ? { sourcePath: launchForm.sourcePath.trim() } : {}),
      ...(launchForm.baseline.trim() ? { baseline: launchForm.baseline.trim() } : {})
    };
    const res = await postJson<{ sessionId: string }>(
      '/api/sessions/run',
      body
    );
    router.push(`/sessions/${res.sessionId}/execution`);
  } catch (e) {
    launchErr.value = (e as Error).message;
  } finally {
    launching.value = false;
  }
}

async function submitImport(): Promise<void> {
  if (!importForm.sessionDir.trim()) {
    importErr.value = 'sessionDir 不能为空';
    return;
  }
  importing.value = true;
  importErr.value = null;
  try {
    const res = await postJson<{ id?: string; sessionId?: string }>(
      '/api/sessions/import',
      { sessionDir: importForm.sessionDir.trim() }
    );
    const id = res.id ?? res.sessionId;
    if (id) router.push(`/dashboard`);
  } catch (e) {
    importErr.value = (e as Error).message;
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <div class="view launch-import-view">
    <div class="view-head">
      <h1>启动 / 导入</h1>
      <div class="tabs">
        <button :class="{ active: tab === 'launch' }" @click="tab = 'launch'">启动评估</button>
        <button :class="{ active: tab === 'import' }" @click="tab = 'import'">导入 session</button>
      </div>
    </div>

    <PanelCard v-if="tab === 'launch'" title="启动新评估" accent>
      <form class="form" @submit.prevent="submitLaunch">
        <label class="field">
          <span class="lb">server <em>*</em></span>
          <input
            v-model="launchForm.server"
            placeholder="例如 ssh_alias 或 root@host"
            :disabled="launching"
          />
        </label>

        <div class="field">
          <span class="lb">mode</span>
          <div class="seg">
            <button
              v-for="m in (['fast', 'full', 'custom'] as Mode[])"
              :key="m"
              type="button"
              :class="{ active: launchForm.mode === m }"
              @click="launchForm.mode = m"
              :disabled="launching"
            >
              {{ m }}
            </button>
          </div>
        </div>

        <div class="field">
          <span class="lb">scope</span>
          <div class="seg wrap">
            <button
              v-for="s in SCOPE_OPTIONS"
              :key="s"
              type="button"
              :class="{ active: launchForm.scope.includes(s) }"
              @click="toggleScope(s)"
              :disabled="launching"
            >
              <StatusBadge v-if="launchForm.scope.includes(s)" state="pass" />
              {{ s }}
            </button>
          </div>
        </div>

        <div class="field">
          <span class="lb">approval</span>
          <div class="seg">
            <button
              v-for="a in (['standard', 'express', 'manual'] as Approval[])"
              :key="a"
              type="button"
              :class="{ active: launchForm.approval === a }"
              @click="launchForm.approval = a"
              :disabled="launching"
            >
              {{ a }}
            </button>
          </div>
        </div>

        <label class="field">
          <span class="lb">sourcePath（可选）</span>
          <input v-model="launchForm.sourcePath" placeholder="本地源码目录" :disabled="launching" />
        </label>

        <label class="field">
          <span class="lb">baseline（可选）</span>
          <input v-model="launchForm.baseline" placeholder="历史 baseline session id" :disabled="launching" />
        </label>

        <p v-if="launchErr" class="err">{{ launchErr }}</p>

        <div class="row">
          <button type="submit" class="primary" :disabled="launching">
            {{ launching ? '启动中…' : '启动' }}
          </button>
          <RouterLink class="link" to="/dashboard">取消</RouterLink>
        </div>
      </form>
    </PanelCard>

    <PanelCard v-else title="导入已有 session" accent>
      <form class="form" @submit.prevent="submitImport">
        <label class="field">
          <span class="lb">sessionDir <em>*</em></span>
          <input
            v-model="importForm.sessionDir"
            placeholder="本地 session 归档目录绝对路径"
            :disabled="importing"
          />
        </label>
        <p v-if="importErr" class="err">{{ importErr }}</p>
        <div class="row">
          <button type="submit" class="primary" :disabled="importing">
            {{ importing ? '导入中…' : '导入' }}
          </button>
          <RouterLink class="link" to="/dashboard">取消</RouterLink>
        </div>
      </form>
    </PanelCard>
  </div>
</template>

<style scoped>
.view-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.view-head h1 { font-size: 16px; margin: 0; }
.tabs { display: flex; gap: 4px; }
.tabs button { padding: 4px 12px; }
.tabs button.active {
  border-color: var(--ac);
  color: var(--ac);
  background: rgba(0,255,136,0.08);
}
.form { display: flex; flex-direction: column; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field .lb {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--t3);
}
.field .lb em { color: var(--rd); font-style: normal; }
.seg { display: flex; gap: 4px; flex-wrap: wrap; }
.seg button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
}
.seg button.active {
  border-color: var(--ac);
  color: var(--ac);
  background: rgba(0,255,136,0.08);
}
.seg.wrap button { flex: 0 0 auto; }
.row { display: flex; gap: var(--gap); align-items: center; }
.err { color: var(--rd); }
.link { color: var(--cy); }
</style>