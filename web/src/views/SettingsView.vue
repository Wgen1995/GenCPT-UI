<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getJson, postJson } from '../api/client.js';
import type { AssetIndex } from '../api/types.js';
import PanelCard from '../components/common/PanelCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import EmptyState from '../components/common/EmptyState.vue';

interface EnvironmentResult {
  opencode?: { available?: boolean; command?: string; error?: string };
  gencpt?: {
    available?: boolean;
    home?: string;
    requiredAssets?: Array<{ name: string; path: string; exists: boolean }>;
  };
  artifactDir?: { path?: string; writable?: boolean };
  sessionRoot?: { path?: string; readable?: boolean };
}

const loading = ref(true);
const error = ref<string | null>(null);
const env = ref<EnvironmentResult | null>(null);
const assets = ref<AssetIndex | null>(null);
const rescanningEnv = ref(false);
const rescanningAssets = ref(false);
const manualPath = ref('');
const savingPath = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const [e, a] = await Promise.all([
      getJson<EnvironmentResult>('/api/environment'),
      getJson<AssetIndex>('/api/assets')
    ]);
    env.value = e;
    assets.value = a;
  } catch (e2) {
    error.value = (e2 as Error).message;
  } finally {
    loading.value = false;
  }
}

async function rescanEnv(): Promise<void> {
  rescanningEnv.value = true;
  try {
    env.value = await postJson<EnvironmentResult>('/api/environment/rescan', {});
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    rescanningEnv.value = false;
  }
}

async function rescanAssets(): Promise<void> {
  rescanningAssets.value = true;
  try {
    assets.value = await postJson<AssetIndex>('/api/assets/rescan', {});
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    rescanningAssets.value = false;
  }
}

async function saveGenCptPath(): Promise<void> {
  if (!manualPath.value.trim()) return;
  savingPath.value = true;
  try {
    env.value = await postJson<EnvironmentResult>('/api/environment', { gencptHome: manualPath.value.trim() });
    assets.value = await postJson<AssetIndex>('/api/assets/rescan', {});
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    savingPath.value = false;
  }
}

const opencodeOk = computed(() => env.value?.opencode?.available ?? false);
const gencptOk = computed(() => env.value?.gencpt?.available ?? false);
const requiredAssets = computed(() => env.value?.gencpt?.requiredAssets ?? []);

const skillCount = computed(() => assets.value?.childSkills.length ?? 0);
const ruleCount = computed(() => assets.value?.compliance.totalRules ?? 0);
const patternCount = computed(() => assets.value?.attackPatterns.length ?? 0);
const surfaceCount = computed(() => new Set((assets.value?.attackPatterns ?? []).map((p) => p.attackSurface)).size);

onMounted(load);
</script>

<template>
  <div class="view settings-view">
    <div class="view-head">
      <h1>设置与环境检查</h1>
      <button class="primary" @click="load" :disabled="loading">⟳ 刷新</button>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <EmptyState
      v-if="!loading && !error && !env"
      icon="◈"
      title="环境信息未就绪"
      description="检查后端 /api/environment 是否可用"
    />

    <template v-if="env">
      <PanelCard title="opencode 状态" accent>
        <dl class="kv">
          <dt>命令</dt><dd class="mono">{{ env.opencode?.command ?? '-' }}</dd>
          <dt>可用</dt>
          <dd><StatusBadge :state="opencodeOk ? 'pass' : 'fail'" :label="opencodeOk ? '可用' : '不可用'" /></dd>
          <dt v-if="env.opencode?.error">错误</dt>
          <dd v-if="env.opencode?.error" class="err">{{ env.opencode.error }}</dd>
        </dl>
      </PanelCard>

      <PanelCard title="GenCPT 自动识别状态" flat>
        <dl class="kv">
          <dt>Home</dt><dd class="mono">{{ env.gencpt?.home ?? '-' }}</dd>
          <dt>整体可用</dt>
          <dd><StatusBadge :state="gencptOk ? 'pass' : 'fail'" :label="gencptOk ? '齐全' : '缺失'" /></dd>
          <dt>手动配置路径</dt>
          <dd>
            <div class="path-row">
              <input v-model="manualPath" :placeholder="env.gencpt?.home || '/path/to/gencpt'" class="gi" />
              <button @click="saveGenCptPath" :disabled="savingPath" class="primary">
                {{ savingPath ? '保存中…' : '保存并检测' }}
              </button>
            </div>
          </dd>
          <dt>Artifact 目录</dt>
          <dd>
            <code class="mono">{{ env.artifactDir?.path ?? '-' }}</code>
            <StatusBadge
              v-if="env.artifactDir"
              :state="env.artifactDir.writable ? 'pass' : 'fail'"
              :label="env.artifactDir.writable ? '可写' : '不可写'"
            />
          </dd>
          <dt>Session Root</dt>
          <dd>
            <code class="mono">{{ env.sessionRoot?.path ?? '-' }}</code>
            <StatusBadge
              v-if="env.sessionRoot"
              :state="env.sessionRoot.readable ? 'pass' : 'warn'"
              :label="env.sessionRoot.readable ? '可读' : '不可读'"
            />
          </dd>
        </dl>
        <div class="req-assets">
          <p class="muted required-title">必需资产检查：</p>
          <ul class="req-list">
            <li v-for="a in requiredAssets" :key="a.name">
              <StatusBadge :state="a.exists ? 'pass' : 'fail'" :label="a.exists ? '✓' : '✗'" />
              <code class="mono">{{ a.name }}</code>
              <span class="muted path">{{ a.path }}</span>
            </li>
          </ul>
        </div>
        <div class="row">
          <button class="primary" :disabled="rescanningEnv" @click="rescanEnv">
            {{ rescanningEnv ? '检测中…' : '重新检测环境' }}
          </button>
        </div>
      </PanelCard>

      <PanelCard title="资产统计" flat>
        <dl class="kv inline">
          <dt>SKILL</dt><dd>{{ skillCount }}</dd>
          <dt>规则</dt><dd>{{ ruleCount }}</dd>
          <dt>攻击模式</dt><dd>{{ patternCount }}</dd>
          <dt>攻击面</dt><dd>{{ surfaceCount }}</dd>
        </dl>
        <p v-if="assets" class="muted">扫描于 {{ assets.scannedAt }}</p>
        <div class="row">
          <button class="primary" :disabled="rescanningAssets" @click="rescanAssets">
            {{ rescanningAssets ? '扫描中…' : '重新扫描资产' }}
          </button>
        </div>
      </PanelCard>
    </template>
  </div>
</template>

<style scoped>
.view-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.view-head h1 { font-size: 16px; margin: 0; }
.muted { color: var(--t3); }
.err { color: var(--rd); }
.mono { font-family: inherit; }
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0 0 8px; }
.kv.inline { display: grid; grid-template-columns: repeat(4, max-content 1fr); gap: 4px 16px; margin: 0 0 8px; }
.kv dt { color: var(--t3); font-size: 11px; letter-spacing: 0.06em; }
.kv dd { margin: 0; display: flex; align-items: center; gap: 8px; }
.req-assets { margin: 8px 0; }
.required-title { margin: 4px 0; }
.req-list { list-style: none; padding: 0; margin: 0; }
.req-list li { display: grid; grid-template-columns: 40px 140px 1fr; gap: 8px; align-items: center; padding: 3px 0; border-bottom: 1px dashed var(--bd); font-size: 12px; }
.req-list .path { font-size: 10px; }
.row { display: flex; gap: 8px; margin-top: 10px; }
</style>.path-row { display: flex; gap: 8px; align-items: center; }
