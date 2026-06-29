<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getJson } from '../api/client.js';
import type {
  AssetIndex,
  ChildSkillEntry,
  HarnessMechanism,
  AttackPatternEntry
} from '../api/types.js';
import PanelCard from '../components/common/PanelCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const loading = ref(true);
const error = ref<string | null>(null);
const assets = ref<AssetIndex | null>(null);

type Tab = 'pipeline' | 'knowledge' | 'harness' | 'evolution';
const queryTab = route.query.tab as string;
const initialTab: Tab = (['pipeline','knowledge','harness','evolution'].includes(queryTab) ? queryTab : 'pipeline') as Tab;
const tab = ref<Tab>(initialTab);

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'pipeline', label: 'Skill Pipeline' },
  { id: 'knowledge', label: 'Security Knowledge' },
  { id: 'harness', label: 'Harness Engineering' },
  { id: 'evolution', label: 'Evolution System' }
];

const childSkills = computed<ChildSkillEntry[]>(() => assets.value?.childSkills ?? []);
const harnessMechanisms = computed<HarnessMechanism[]>(() => assets.value?.harnessMechanisms ?? []);
const attackPatterns = computed<AttackPatternEntry[]>(() => assets.value?.attackPatterns ?? []);
const learnedPatterns = computed(() => assets.value?.learnedPatterns ?? []);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    let data: AssetIndex | null = null;
    try {
      data = await getJson<AssetIndex>('/api/assets');
    } catch {
      try {
        data = (await getJson<{ assets: AssetIndex }>('/api/sessions/_/tool-assets')).assets;
      } catch {
        /* ignore */
      }
    }
    assets.value = data ?? null;
    if (!data) error.value = '未找到 /api/assets 或 session 的 tool-assets 路端';
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
      <h1>工具资产全景</h1>
      <div class="tabs">
        <button
          v-for="t in tabs"
          :key="t.id"
          :class="{ active: tab === t.id }"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </div>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <EmptyState
      v-if="!loading && !assets"
      icon="◈"
      title="未加载资产索引"
      description="请确认 gencptHome 已正确配置，并扫描过 SKILL.md"
    />

    <!-- A · Skill Pipeline -->
    <template v-if="assets && tab === 'pipeline'">
      <PanelCard title="入口 SKILL" accent>
        <dl class="kv">
          <dt>path</dt><dd><code>{{ assets.entrySkill.path }}</code></dd>
          <dt>存在</dt>
          <dd><StatusBadge :state="assets.entrySkill.exists ? 'pass' : 'fail'" /></dd>
        </dl>
      </PanelCard>

      <PanelCard :title="`子 SKILL 列表（${childSkills.length}）`" flat>
        <EmptyState v-if="childSkills.length === 0" icon="◇" title="未扫描到子 SKILL" />
        <table v-else class="grid-table">
          <thead>
            <tr><th>name</th><th>phase</th><th>requiresSsh</th><th>standalone</th><th>MUST 输出</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in childSkills" :key="s.skillMdPath">
              <td class="mono">{{ s.name }}</td>
              <td><code>{{ s.phase }}</code></td>
              <td>
                <StatusBadge :state="s.requiresSsh ? 'warn' : 'na'"
                  :label="s.requiresSsh ? 'SSH' : '-'" />
              </td>
              <td>
                <StatusBadge :state="s.standalone ? 'pass' : 'na'"
                  :label="s.standalone ? '可独立' : '-'"
                />
              </td>
              <td class="muted mono">{{ s.mustOutputs.join(' · ') || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </PanelCard>
    </template>

    <!-- B · Security Knowledge -->
    <template v-if="assets && tab === 'knowledge'">
      <PanelCard title="合规三库（CIS Benchmark）" accent>
        <table class="grid-table">
          <thead>
            <tr><th>scope</th><th>groups</th><th>rules</th></tr>
          </thead>
          <tbody>
            <tr><td>k8s</td><td>{{ assets.compliance.k8s.groups }}</td><td>{{ assets.compliance.k8s.rules }}</td></tr>
            <tr><td>docker</td><td>{{ assets.compliance.docker.groups }}</td><td>{{ assets.compliance.docker.rules }}</td></tr>
            <tr><td>containerd</td><td>{{ assets.compliance.containerd.groups }}</td><td>{{ assets.compliance.containerd.rules }}</td></tr>
            <tr class="total"><td>合计</td><td colspan="2">{{ assets.compliance.totalRules }}</td></tr>
          </tbody>
        </table>
      </PanelCard>

      <div class="grid-2">
        <PanelCard :title="`攻击模式库（${attackPatterns.length}）`">
          <EmptyState v-if="attackPatterns.length === 0" icon="◇" title="无攻击模式" />
          <ul v-else class="pattern-list">
            <li v-for="p in attackPatterns" :key="p.skillMdPath">
              <code>{{ p.attackSurface || '?' }}</code>
              <span class="mono">{{ p.name }}</span>
              <StatusBadge
                :tier="(['C1', 'C2', 'C3'] as const).find((c) => p.confidence.includes(c)) ?? undefined"
                :label="p.confidence"
              />
            </li>
          </ul>
        </PanelCard>

        <PanelCard title="三库（hypothesis-libraries）">
          <dl class="kv">
            <dt>files</dt><dd>{{ assets.hypotheses.files.length }}</dd>
            <dt>CHK-CAND</dt><dd>{{ assets.hypotheses.chkCandCount }}</dd>
            <dt>ATK-HYP</dt><dd>{{ assets.hypotheses.atkHypCount }}</dd>
            <dt>XREF</dt><dd>{{ assets.hypotheses.xrefCount }}</dd>
          </dl>
          <ul v-if="assets.hypotheses.files.length" class="file-list">
            <li v-for="f in assets.hypotheses.files" :key="f" class="mono">{{ f }}</li>
          </ul>
        </PanelCard>
      </div>

      <PanelCard title="攻击面与 shared 规范" flat>
        <div class="grid-2">
          <div>
            <p class="muted">攻击面数量：{{ new Set(attackPatterns.map((p) => p.attackSurface)).size }}</p>
          </div>
          <ul class="file-list">
            <li v-for="s in assets.sharedSpecs" :key="s.name">
              <StatusBadge :state="s.exists ? 'pass' : 'warn'" />
              <code class="mono">{{ s.name }}</code>
            </li>
          </ul>
        </div>
      </PanelCard>
    </template>

    <!-- C · Harness Engineering -->
    <template v-if="assets && tab === 'harness'">
      <PanelCard :title="`Harness 机制列表（${harnessMechanisms.length}）`" accent>
        <table class="grid-table">
          <thead>
            <tr><th>id</th><th>name</th><th>category</th><th>description</th><th>relatedFile</th></tr>
          </thead>
          <tbody>
            <tr v-for="m in harnessMechanisms" :key="m.id">
              <td class="mono">{{ m.id }}</td>
              <td>{{ m.name }}</td>
              <td><code class="cat">{{ m.category }}</code></td>
              <td class="muted">{{ m.description }}</td>
              <td class="mono muted">{{ m.relatedFile }}</td>
            </tr>
          </tbody>
        </table>
      </PanelCard>
    </template>

    <!-- D · Evolution System -->
    <template v-if="assets && tab === 'evolution'">
      <PanelCard :title="`learned 模式（${learnedPatterns.length}）`" accent>
        <EmptyState
          v-if="learnedPatterns.length === 0"
          icon="✶"
          title="尚无 learned 模式"
          description="attack-patterns/_learned/ 目录暂时为空，运行 evolve 后会出现"
        />
        <ul v-else class="file-list">
          <li v-for="p in learnedPatterns" :key="p.path">
            <code class="mono">{{ p.name }}</code>
            <span class="muted">{{ p.path }}</span>
          </li>
        </ul>
      </PanelCard>
    </template>
  </div>
</template>

<style scoped>
.view-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: var(--gap); }
.view-head h1 { font-size: 16px; margin: 0; }
.tabs { display: flex; gap: 4px; }
.tabs button { padding: 4px 12px; }
.tabs button.active { border-color: var(--ac); color: var(--ac); background: rgba(0,255,136,0.08); }
.muted { color: var(--t3); }
.mono { font-family: inherit; }
.err { color: var(--rd); }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); margin-bottom: var(--gap); }
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
.kv dt { color: var(--t3); font-size: 11px; letter-spacing: 0.06em; }
.kv dd { margin: 0; }
.grid-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.grid-table th, .grid-table td { padding: 4px 8px; border-bottom: 1px solid var(--bd); text-align: left; }
.grid-table th { color: var(--t3); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }
.grid-table tr.total td { font-weight: 700; }
.pattern-list, .file-list { list-style: none; padding: 0; margin: 0; }
.pattern-list li { display: flex; gap: 8px; align-items: center; padding: 2px 0; }
.file-list li { display: flex; gap: 8px; align-items: center; padding: 2px 0; }
.cat { color: var(--cy); font-size: 10px; }
</style>