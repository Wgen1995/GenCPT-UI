<script setup lang="ts">
defineProps<{
  title?: string;
  accent?: boolean;
  flat?: boolean;
}>();
</script>

<template>
  <section class="panel" :class="{ flat }">
    <header v-if="title || $slots.header" class="panel-header">
      <slot name="header">
        <p class="panel-title">
          <span :class="{ accent }">{{ title }}</span>
        </p>
      </slot>
    </header>
    <div class="panel-body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="panel-footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped>
.panel-header {
  margin-bottom: 8px;
}
.panel-footer {
  margin-top: 8px;
  border-top: 1px dashed var(--bd);
  padding-top: 8px;
}
</style>