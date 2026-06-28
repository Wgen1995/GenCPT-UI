<script setup lang="ts">
defineProps<{
  icon?: string;
  title?: string;
  description?: string;
}>();
</script>

<template>
  <div class="empty-state">
    <div class="icon">{{ icon ?? '◇' }}</div>
    <div v-if="title" class="title">{{ title }}</div>
    <div v-if="description" class="desc">{{ description }}</div>
    <slot />
  </div>
</template>

<style scoped>
.desc {
  color: var(--t3);
  max-width: 320px;
}
</style>