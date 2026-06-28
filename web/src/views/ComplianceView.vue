<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getJson } from '../api/client.js';
import PanelCard from '../components/common/PanelCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const sessionId = computed(() => String(route.params.id ?? ''));

interface ComplianceRule {
  id?: string;
  title?: string;
  status?: string;
  group?: string;
  attackSurface?: string;
  xref?: string;
  text?: string;
  sshVerified?: boolean;
  reason?: string;
  [k: string]: unknown;
}
interface ComplianceData {
  k8s?: { rules?: number; groups?: number };
  docker?: { rules?: number; groups?: number };
  containerd?: { rules?: number; groups?: number };
  totalRules?: number;
  pass?: number;
  fail?: number;
  warn?: number;
  na?: number;
  rules?: ComplianceRule[];
  platforms?: Record<string, number>;
  [k: string]: unknown;
}

const loading = ref(true);
const error = ref<string | null>(null);
const data = ref<ComplianceData | null>(null);

async function load(): Promise<void> {
  if (!sessionId.value) return;
  loading.value = true;
  error.value = null;
  data.value = null;
  try {
    const res = await getJson<{ compliance: ComplianceData | null }>(
      `/api/sessions/${sessionId.value}/compliance`
    );
    data.value = res.compliance ?? null;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

const k8sRules = computed(() => data.value?.k8s?.rules ?? 0);
const dockerRules = computed(() => data.value?.docker?.rules ?? 0);
const containerdRules = computed(() => data.value?.containerd?.rules ?? 0);
const totalRules = computed(() => data.value?.totalRules ?? (k8sRules.value + dockerRules.value + containerdRules.value));

const counts = computed(() => ({
  pass: Number(data.value?.pass ?? 0),
  fail: Number(data.value?.fail ?? 0),
  warn: Number(data.value?.warn ?? 0),
  na: Number(data.value?.na ?? 0)
}));

const rules = computed<ComplianceRule[]>(() => (data.value?.rules ?? []) as ComplianceRule[]);

function stateOf(s: string): 'pass' | 'warn' | 'fail' | 'na' | 'pending' {
  if (typeof s !== 'string') return 'pending';
  const v = s.toLowerCase();
  if (v === 'pass') return 'pass';
  if (v === 'fail') return 'fail';
  if (v === 'warn') return 'warn';
  if (v === 'na' || v === 'n/a' || v === 'not_applicable') return 'na';
  return 'pending';
}

onMounted(load);
</script>

<template>
  <div class="view compliance-view">
    <div class="view-head">
      <h1>合规检测与检查点</h1>
      <span class="muted">session: {{ sessionId }}</span>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <EmptyState
      v-if="!loading && !error && !data"
      icon="◈"
      title="合规数据未生成"
      description="请在 session 完成合规检测（Phase 2）后查看"
    />

    <template v-if="data">
      <div class="grid-2">
        <PanelCard title="三平台规则概览" accent>
          <dl class="kv">
            <dt>K8s</dt><dd>{{ k8sRules }} 规则</dd>
            <dt>Docker</dt><dd>{{ dockerRules }} 规则</dd>
            <dt>Containerd</dt><dd>{{ containerdRules }} 规则</dd>
            <dt>合计</dt><dd>{{ totalRules }}</dd>
          </dl>
        </PanelCard>

        <PanelCard title="pass / fail / warn / na 分布">
          <div class="dist-row">
            <div class="cell pass"><StatusBadge state="pass" /><span class="big">{{ counts.pass }}</span></div>
            <div class="cell fail"><StatusBadge state="fail" /><span class="big">{{ counts.fail }}</span></div>
            <div class="cell warn"><StatusBadge state="warn" /><span class="big">{{ counts.warn }}</span></div>
            <div class="cell na"><StatusBadge state="na" /><span class="big">{{ counts.na }}</span></div>
          </div>
        </PanelCard>
      </div>

      <PanelCard title="规则检查列表" flat>
        <EmptyState v-if="rules.length === 0" icon="◇" title="无规则记录" />
        <table v-else class="rules-table">
          <thead>
            <tr><th>ID</th><th>标题</th><th>状态</th><th>攻击面关联</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rules" :key="r.id ?? i">
              <td class="mono">{{ r.id ?? '-' }}</td>
              <td>{{ r.title ?? r.group ?? '-' }}</td>
              <td><StatusBadge :state="stateOf(String(r.status ?? ''))" :label="String(r.status ?? 'pending')" /></td>
              <td>{{ r.attackSurface ?? r.xref ?? '-' }}</td>
            </tr>
          </tbody>
        </table>
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
.dist-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--gap);
}
.dist-row .cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--bd);
  border-radius: var(--radius-sm);
  background: var(--bg1);
}
.dist-row .big { font-size: 22px; font-weight: 700; }
.dist-row .pass .big { color: var(--ac); }
.dist-row .fail .big { color: var(--rd); }
.dist-row .warn .big { color: var(--am); }
.dist-row .na .big { color: var(--t3); }
.rules-table { width: 100%; border-collapse: collapse; }
.rules-table th, .rules-table td {
  text-align: left;
  padding: 5px 8px;
  border-bottom: 1px dashed var(--bd);
  font-size: 12px;
}
.rules-table th { color: var(--t3); font-weight: normal; letter-spacing: 0.06em; }
.mono { font-family: inherit; }
</style>