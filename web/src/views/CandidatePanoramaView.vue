<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getJson } from '../api/client.js';
import type { AssetIndex, CandidateChannel, CandidatePanoramaViewModel } from '../api/types.js';
import PanelCard from '../components/common/PanelCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const sessionId = computed(() => String(route.params.id ?? ''));

const loading = ref(true);
const error = ref<string | null>(null);
const assets = ref<AssetIndex | null>(null);

const channels = ref<CandidateChannel[]>([]);

const A = computed<CandidateChannel | null>(() => channels.value.find((c) => c.id === 'static') ?? null);
const B = computed<CandidateChannel | null>(() => channels.value.find((c) => c.id === 'recon') ?? null);
const C = computed<CandidateChannel | null>(() => channels.value.find((c) => c.id === 'llm') ?? null);

const map = computed(() => ({ A: A.value, B: B.value, C: C.value }));

async function load(): Promise<void> {
  if (!sessionId.value) return;
  loading.value = true;
  error.value = null;
  try {
    const data = await getJson<Partial<CandidatePanoramaViewModel>>(
      `/api/sessions/${sessionId.value}/candidate-panorama`
    );
    assets.value = (data.assets as AssetIndex) ?? null;
    channels.value = buildChannels(data);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

function buildChannels(data: Partial<CandidatePanoramaViewModel>): CandidateChannel[] {
  const assets = (data.assets as AssetIndex | undefined) ?? null;
  const summary = ((data as { summary?: Record<string, unknown> }).summary) ?? null;

  // A — 静态知识库驱动
  const chkCand = Number(summary?.chkCandCount ?? assets?.hypotheses.chkCandCount ?? 0);
  const xref = Number(summary?.xrefCount ?? assets?.hypotheses.xrefCount ?? 0);
  const atkHyp = Number(summary?.atkHypCount ?? assets?.hypotheses.atkHypCount ?? 0);
  const aInputs = chkCand + xref + atkHyp;
  const aCandidates = Number(summary?.staticCandidates ?? aInputs);
  const aItems: CandidateChannel['items'] = [];
  if (chkCand) aItems.push({ id: 'chk-cand', label: 'CHK-CAND 三库', signal: `${chkCand}` });
  if (xref) aItems.push({ id: 'xref', label: 'XREF 叠加', signal: `${xref}` });
  if (atkHyp) aItems.push({ id: 'atk-hyp', label: '模式反推 ATK-HYP', signal: `${atkHyp}` });

  // B — 侦察信号驱动
  const reconSig = Number(summary?.reconSignalCount ?? summary?.reconInputs ?? 0);
  const reconCand = Number(summary?.reconCandidates ?? 0);
  const bItems: CandidateChannel['items'] = [];
  if (summary?.reconSources && Array.isArray(summary.reconSources)) {
    for (const src of summary.reconSources as unknown[]) {
      bItems.push({ label: String(src) });
    }
  }

  // C — LLM 推理补盲与进化
  const llmSig = Number(summary?.llmSignalCount ?? 0);
  const llmCand = Number(summary?.llmCandidates ?? 0);
  const llmKeys = ['unmatched', 'stacked', 'exhausted', 'variant', 'bypass', 'learned'];
  const cItems: CandidateChannel['items'] = [];
  for (const k of llmKeys) {
    const v = (summary as Record<string, unknown>)?.[k];
    if (typeof v === 'number' && v > 0) cItems.push({ id: k, label: k, signal: String(v) });
  }

  const aChannel: CandidateChannel = {
    id: 'static',
    label: 'A · 静态知识库驱动',
    description: '合规三库联动、XREF 叠加、模式反推（hypothesis-libraries）',
    sourceChannels: ['compliance-rules', 'hypothesis-libraries', 'attack-patterns'],
    inputSignalCount: aInputs,
    candidateCount: aCandidates,
    items: aItems
  };
  const bChannel: CandidateChannel = {
    id: 'recon',
    label: 'B · 侦察信号驱动',
    description: '环境 SSH 侦察 + 源码侦察引入的开放信号',
    sourceChannels: ['recon (SSH)', 'recon-source'],
    inputSignalCount: reconSig,
    candidateCount: reconCand,
    items: bItems
  };
  const cChannel: CandidateChannel = {
    id: 'llm',
    label: 'C · LLM 推理补盲与进化',
    description: '未匹配、叠加、穷举、变体、绕过、learned',
    sourceChannels: ['LLM 语义推理', 'attack-reasoning', 'evolve'],
    inputSignalCount: llmSig,
    candidateCount: llmCand,
    items: cItems
  };

  return [aChannel, bChannel, cChannel];
}

function ver(channel: CandidateChannel | null): 'pass' | 'warn' | 'fail' {
  if (!channel) return 'fail';
  if (channel.candidateCount > 0) return 'pass';
  return 'warn';
}

onMounted(load);
</script>

<template>
  <div class="view">
    <div class="view-head">
      <h1>攻击候选来源全景</h1>
      <span class="muted">session: {{ sessionId }}</span>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <PanelCard v-if="assets" title="资产快照" flat>
      <dl class="kv inline">
        <dt>SKILL</dt><dd>{{ assets.childSkills.length }}</dd>
        <dt>规则</dt><dd>{{ assets.compliance.totalRules }}</dd>
        <dt>攻击模式</dt><dd>{{ assets.attackPatterns.length }}</dd>
        <dt>三库文件</dt><dd>{{ assets.hypotheses.files.length }}</dd>
      </dl>
    </PanelCard>

    <div class="panorama" v-if="!loading">
      <PanelCard
        v-for="(ch, key) in map"
        :key="key"
        :title="ch?.label"
        :accent="ver(ch) === 'pass'"
      >
        <dl class="kv">
          <dt>来源通道</dt>
          <dd>{{ ch?.sourceChannels.join(' · ') }}</dd>
          <dt>输入信号数</dt>
          <dd>{{ ch?.inputSignalCount ?? 0 }}</dd>
          <dt>候选数</dt>
          <dd>
            <StatusBadge
              :state="ver(ch)"
              :label="`${ch?.candidateCount ?? 0} 候选`"
            />
          </dd>
        </dl>
        <p class="desc">{{ ch?.description }}</p>
        <ul class="ch-items" v-if="ch && ch.items.length > 0">
          <li v-for="(it, i) in ch.items" :key="i">
            <span class="muted">{{ it.id ?? it.label }}</span>
            <span v-if="it.signal" class="sig">{{ it.signal }}</span>
          </li>
        </ul>
        <EmptyState
          v-else
          icon="◇"
          title="无来源信号"
          description="该通道暂无 candidate 输入，session 完成后再看"
        />
      </PanelCard>
    </div>

    <EmptyState
      v-if="!loading && !error && channels.every((c) => c.candidateCount === 0)"
      icon="◈"
      title="暂无 candidate"
      description="可能 session 仍在运行或未生成攻击候选"
    />
  </div>
</template>

<style scoped>
.view-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.view-head h1 { font-size: 16px; margin: 0; }
.muted { color: var(--t3); }
.err { color: var(--rd); }
.panorama {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--gap);
}
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
.kv.inline { display: grid; grid-template-columns: repeat(4, max-content 1fr); gap: 4px 16px; margin: 0; }
.kv dt { color: var(--t3); font-size: 11px; letter-spacing: 0.06em; }
.kv dd { margin: 0; }
.desc { color: var(--t2); font-size: 12px; margin: 8px 0; }
.ch-items { list-style: none; padding: 0; margin: 8px 0 0; }
.ch-items li { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dashed var(--bd); }
.sig { color: var(--cy); }
</style>