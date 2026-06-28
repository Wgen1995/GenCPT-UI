<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { postJson } from '../api/client.js';
import { useUiStore } from '../stores/ui.js';
import PanelCard from '../components/common/PanelCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';

const router = useRouter();
const ui = useUiStore();

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
  baseline: '',
  model: '',
  thinking: false,
  variant: '' as '' | 'high' | 'max' | 'minimal',
  agent: ''
});
const showAdvanced = ref(false);
const launching = ref(false);
const launchErr = ref<string | null>(null);
const launchSuccess = ref<string | null>(null);

const importForm = reactive({ sessionDir: '' });
const importing = ref(false);
const importErr = ref<string | null>(null);

const SCOPE_OPTIONS: ScopeItem[] = ['all', 'k8s', 'docker', 'containerd'];
const VARIANT_OPTIONS = ['', 'high', 'max', 'minimal'] as const;

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
  launchSuccess.value = null;
  try {
    const body = {
      server: launchForm.server.trim(),
      mode: launchForm.mode,
      scope: launchForm.scope.includes('all')
        ? (['k8s', 'docker', 'containerd'] as ScopeItem[])
        : launchForm.scope,
      approval: launchForm.approval,
      ...(launchForm.sourcePath.trim() ? { sourcePath: launchForm.sourcePath.trim() } : {}),
      ...(launchForm.baseline.trim() ? { baseline: launchForm.baseline.trim() } : {}),
      ...(launchForm.model.trim() ? { model: launchForm.model.trim() } : {}),
      ...(launchForm.thinking ? { thinking: true } : {}),
      ...(launchForm.variant ? { variant: launchForm.variant } : {}),
      ...(launchForm.agent.trim() ? { agent: launchForm.agent.trim() } : {})
    };
    const res = await postJson<{ sessionId: string; status: string; streamUrl?: string }>(
      '/api/sessions/run',
      body
    );
    launchSuccess.value = `评估已启动！Session: ${res.sessionId}，正在跳转到执行控制台...`;
    ui.setCurrentSession(res.sessionId);
    setTimeout(() => {
      router.push(`/sessions/${res.sessionId}/execution`);
    }, 800);
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

        <div class="advanced">
          <button type="button" class="advanced-toggle" @click="showAdvanced = !showAdvanced">
            <span class="caret" :class="{ open: showAdvanced }">▸</span>
            高级参数（model / thinking / variant / agent）
          </button>
          <div v-if="showAdvanced" class="advanced-body">
            <label class="field">
              <span class="lb">model（provider/model）</span>
              <input
                v-model="launchForm.model"
                placeholder="例如 anthropic/claude-3.7-sonnet，留空用默认"
                :disabled="launching"
              />
            </label>
            <label class="field check">
              <input type="checkbox" v-model="launchForm.thinking" :disabled="launching" />
              <span>显示 thinking 思维块（--thinking）</span>
            </label>
            <div class="field">
              <span class="lb">variant（推理强度）</span>
              <div class="seg">
                <button
                  v-for="v in VARIANT_OPTIONS"
                  :key="v"
                  type="button"
                  :class="{ active: launchForm.variant === v }"
                  @click="launchForm.variant = v"
                  :disabled="launching"
                >
                  {{ v === '' ? '默认' : v }}
                </button>
              </div>
            </div>
            <label class="field">
              <span class="lb">agent</span>
              <input
                v-model="launchForm.agent"
                placeholder="指定 opencode agent 名，留空用默认"
                :disabled="launching"
              />
            </label>
          </div>
        </div>

        <p v-if="launchSuccess" style="color: var(--ac); font-weight: 600; padding: 12px; background: rgba(0,255,136,0.08); border-radius: 8px;">{{ launchSuccess }}</p>

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
.advanced { border-top: 1px dashed var(--bd); padding-top: 10px; margin-top: 4px; }
.advanced-toggle {
  background: transparent;
  border: none;
  padding: 4px 0;
  font-size: 12px;
  color: var(--t3);
  text-align: left;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.advanced-toggle:hover { color: var(--t2); background: transparent; border-color: transparent; }
.advanced-toggle .caret { display: inline-block; transition: transform 0.15s; }
.advanced-toggle .caret.open { transform: rotate(90deg); }
.advanced-body { display: flex; flex-direction: column; gap: 12px; padding-top: 8px; }
.field.check { flex-direction: row; align-items: center; gap: 8px; }
.field.check input[type="checkbox"] { width: auto; }
.field.check span { font-size: 12px; color: var(--t2); }
</style>