<template>
  <canvas ref="canvas" class="code-rain"></canvas>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';

const canvas = ref<HTMLCanvasElement | null>(null);
let animId = 0;
const chars = '01'.split('');
const fontSize = 14;

onMounted(() => {
  const el = canvas.value; if (!el) return;
  let ctx: CanvasRenderingContext2D | null;
  try { ctx = el.getContext('2d'); } catch { return; }
  if (!ctx) return;

  function resize() {
    el!.width = window.innerWidth - 232;
    el!.height = window.innerHeight - 52;
  }
  resize();
  window.addEventListener('resize', resize);

  let columns = 0;
  let drops: number[] = [];

  function init() {
    columns = Math.floor(el!.width / fontSize);
    drops = Array(columns).fill(0).map(() => Math.random() * -el!.height / fontSize);
  }
  init();

  function draw() {
    const c = ctx!;
    const w = el!.width;
    const h = el!.height;

    c.fillStyle = 'rgba(13, 19, 24, 0.08)';
    c.fillRect(0, 0, w, h);
    c.font = `bold ${fontSize}px JetBrains Mono`;

    for (let i = 0; i < drops.length; i++) {
      const x = i * fontSize;
      const y = drops[i] * fontSize;

      // head — brightest
      c.fillStyle = '#CCFFE0';
      c.globalAlpha = 0.55;
      c.fillText(chars[Math.floor(Math.random() * chars.length)], x, y);

      if (y > h && Math.random() > 0.975) {
        drops[i] = -Math.random() * 5;
      }
      drops[i] += Math.random() * 0.4 + 0.15;
    }

    c.globalAlpha = 1;
    animId = requestAnimationFrame(draw);
  }

  draw();

  onBeforeUnmount(() => {
    cancelAnimationFrame(animId);
    window.removeEventListener('resize', resize);
  });
});
</script>

<style scoped>
.code-rain {
  position: fixed; top: 52px; left: 232px; right: 0; bottom: 0;
  pointer-events: none; z-index: 0;
}
</style>
