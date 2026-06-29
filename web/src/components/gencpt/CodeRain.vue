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
  const ctx = el!.getContext('2d')!;

  function resize() { el!.width = el!.parentElement!.clientWidth; el!.height = el!.parentElement!.clientHeight; }
  resize();
  window.addEventListener('resize', resize);

  let drops: number[] = [];
  function init() { drops = Array(Math.floor(el!.width / fontSize)).fill(0).map(() => Math.random() * el!.height / fontSize); }
  init();

  function draw() {
    ctx.fillStyle = 'rgba(13, 19, 24, 0.05)';
    ctx.fillRect(0, 0, el!.width, el!.height);
    ctx.fillStyle = '#00FF88';
    ctx.font = `${fontSize}px JetBrains Mono`;

    for (let i = 0; i < drops.length; i++) {
      const text = chars[Math.floor(Math.random() * chars.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;
      ctx.globalAlpha = 0.06;
      ctx.fillText(text, x, y);
      if (y > el!.height && Math.random() > 0.99) drops[i] = 0;
      drops[i]++;
    }
    ctx.globalAlpha = 1;
    animId = requestAnimationFrame(draw);
  }
  draw();

  onBeforeUnmount(() => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); });
});
</script>

<style scoped>
.code-rain {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: -1;
}
</style>