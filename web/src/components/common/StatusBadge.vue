<script setup lang="ts">
import { computed } from 'vue';

type State = 'pending' | 'running' | 'pass' | 'warn' | 'fail' | 'na';
type Tier = 'C1' | 'C2' | 'C3' | 'L0' | 'L1' | 'L2' | 'L3';

const props = defineProps<{
  state?: State;
  tier?: Tier;
  label?: string;
}>();

const cls = computed(() => {
  if (props.tier) {
    const k = props.tier.toLowerCase();
    return `badge ${k}`;
  }
  return `badge ${props.state ? 's-' + props.state : ''}`;
});

const text = computed(() => props.label ?? props.tier ?? props.state ?? '');
</script>

<template>
  <span :class="cls">
    <span class="dot" aria-hidden="true" />
    <slot>{{ text }}</slot>
  </span>
</template>