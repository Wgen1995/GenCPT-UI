<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getJson } from '../api/client.js';
import PanelCard from '../components/common/PanelCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const sessionId = computed(() => String(route.params.id ?? ''));

interface CmdRecord {
  command?: string;
  level?: string;
  source?: string;
  stdout?: string;
  stderr?: string;
  evidenceFile?: string;
  exitCode?: number;
  ts?: string;
  [k: string]: unknown;
}
interface AtkCand {
  id?: string;
  attackPattern?: string;
  targetAsset?: string;
  source?: string;
  status?: string;
  confidence?: string;
  [k: string]: unknown;
}
interface DiffProof {
  before?: string;
  after?: string;
  delta?: string;
  file?: string;
  [k: string]: unknown;
}
interface AttacksData {
  cands?: AtkCand[];
  commands?: CmdRecord[];
  diffProofs?: DiffProof[];
  summary?: Record<string, unknown>;
  [k: string]: unknown;
}

const loading = ref(true);
const error = ref<string | null>(null);
const data = ref<AttacksData | null>(null);

async function load(): Promise<void> {
  if (!sessionId.value) return;
  loading.value = true;
  error.value = null;
  data.value = null;
  try {
    const res = await getJson<{ attacks: AttacksData | null }>(
      `/api/sessions/${sessionId.value}/attacks`
    );
    data.value = res.attacks ?? null;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

const cands = computed<AtkCand[]>(() => (data.value?.cands ?? []) as AtkCand[]);
const commands = computed<CmdRecord[]>(() => (data.value?.commands ?? []) as CmdRecord[]);
const proofs = computed<DiffProof[]>(() => (data.value?.diffProofs ?? []) as DiffProof[]);

function tierOf(l: string): 'L0' | 'L1' | 'L2' | 'L3' | undefined {
  const v = String(l ?? '').toUpperCase();
  if (v === 'L0' || v === 'L1' || v === 'L2' || v === 'L3') return v;
  return undefined;
}

function stateOf(s: string): 'pass' | 'warn' | 'fail' | 'na' | 'pending' {
  const v = String(s ?? '').toLowerCase();
  if (v === 'confirmed' || v === 'pass' || v === 'condition_met') return 'pass';
  if (v === 'refuted' || v === 'fail' || v === 'condition_not_met') return 'fail';
  if (v === 'pending' || v === 'running') return 'pending';
  if (v === 'blocked') return 'na';
  return 'pending';
}

function confidenceOf(c: string): 'C1' | 'C2' | 'C3' | undefined {
  const v = String(c ?? '').toUpperCase();
  if (v === 'C1' || v === 'C2' || v === 'C3') return v;
  return undefined;
}

onMounted(load);
</script>

<template>
  <div class="view attack-validation-view">
    <div class="view-head">
      <h1>攻击验证与命令审计</h1>
      <span class="muted">session: {{ sessionId }}</span>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <EmptyState
      v-if="!loading && !error && !data"
      icon="◈"
      title="攻击验证数据未生成"
      description="完成 Phase 4（攻击验证）后在此查看 ATK-CAND、命令审计与差分证明"
    />

    <template v-if="data">
      <PanelCard title="ATK-CAND 列表" accent>
        <EmptyState v-if="cands.length === 0" icon="◇" title="无 ATK-CAND" />
        <table v-else class="cands-table">
          <thead>
            <tr><th>ID</th><th>攻击模式</th><th>目标资产</th><th>来源</th><th>状态</th><th>可信度</th></tr>
          </thead>
          <tbody>
            <tr v-for="(c, i) in cands" :key="c.id ?? i">
              <td class="mono">{{ c.id ?? '-' }}</td>
              <td>{{ c.attackPattern ?? '-' }}</td>
              <td>{{ c.targetAsset ?? '-' }}</td>
              <td>{{ c.source ?? '-' }}</td>
              <td><StatusBadge :state="stateOf(String(c.status ?? ''))" :label="String(c.status ?? 'pending')" /></td>
              <td><StatusBadge v-if="confidenceOf(String(c.confidence ?? ''))" :tier="confidenceOf(String(c.confidence ?? ''))" /></td>
            </tr>
          </tbody>
        </table>
      </PanelCard>

      <PanelCard title="命令审计（L0/L1/L2/L3）" flat>
        <EmptyState v-if="commands.length === 0" icon="◇" title="无命令记录" />
        <div v-else class="cmd-list">
          <div v-for="(cmd, i) in commands" :key="i" class="cmd">
            <div class="cmd-head">
              <StatusBadge v-if="tierOf(String(cmd.level ?? ''))" :tier="tierOf(String(cmd.level ?? ''))" />
              <span v-else class="muted">{{ cmd.level ?? '-' }}</span>
              <span class="muted src">来源：{{ cmd.source ?? '-' }}</span>
              <span class="muted ts">{{ cmd.ts ?? '' }}</span>
              <span v-if="cmd.exitCode !== undefined" class="muted">exit={{ cmd.exitCode }}</span>
            </div>
            <pre class="cmd-text">{{ cmd.command ?? '' }}</pre>
            <details v-if="cmd.stdout || cmd.stderr">
              <summary class="muted">stdout / stderr</summary>
              <pre class="out">{{ cmd.stdout ?? '' }}</pre>
              <pre class="err-text">{{ cmd.stderr ?? '' }}</pre>
            </details>
            <p v-if="cmd.evidenceFile" class="evidence">
              <span class="muted">证据文件：</span><code class="mono">{{ cmd.evidenceFile }}</code>
            </p>
          </div>
        </div>
      </PanelCard>

      <PanelCard title="差分证明" flat>
        <EmptyState v-if="proofs.length === 0" icon="◇" title="无差分证明" />
        <div v-else class="proof-list">
          <div v-for="(p, i) in proofs" :key="i" class="proof">
            <div class="diff-row">
              <div><span class="muted">before</span><pre class="out">{{ p.before ?? '' }}</pre></div>
              <div><span class="muted">after</span><pre class="out">{{ p.after ?? '' }}</pre></div>
              <div><span class="muted">delta</span><pre class="out">{{ p.delta ?? '' }}</pre></div>
            </div>
            <p v-if="p.file" class="muted">证据：{{ p.file }}</p>
          </div>
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
.cands-table { width: 100%; border-collapse: collapse; }
.cands-table th, .cands-table td {
  text-align: left; padding: 5px 8px; border-bottom: 1px dashed var(--bd); font-size: 12px;
}
.cands-table th { color: var(--t3); font-weight: normal; letter-spacing: 0.06em; }
.cmd-list { display: flex; flex-direction: column; gap: 10px; }
.cmd {
  border: 1px solid var(--bd);
  border-radius: var(--radius-sm);
  background: var(--bg1);
  padding: 8px;
}
.cmd-head { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; font-size: 11px; }
.cmd-head .src { margin-left: auto; }
.cmd-text {
  background: var(--bg0); border: 1px solid var(--bd); padding: 6px;
  border-radius: var(--radius-sm); font-size: 12px; white-space: pre-wrap; word-break: break-word;
  margin: 0;
}
.out, .err-text {
  background: var(--bg0); color: var(--t2); padding: 6px; margin: 4px 0;
  font-size: 11px; white-space: pre-wrap; max-height: 220px; overflow: auto;
  border-radius: var(--radius-sm);
}
.err-text { color: var(--rd); }
.evidence { margin: 4px 0 0; font-size: 11px; }
.proof-list { display: flex; flex-direction: column; gap: 10px; }
.proof { border: 1px solid var(--bd); border-radius: var(--radius-sm); padding: 8px; }
.diff-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
</style>