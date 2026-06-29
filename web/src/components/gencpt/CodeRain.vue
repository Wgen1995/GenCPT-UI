<template>
  <canvas ref="canvas" class="code-rain"></canvas>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';

const canvas = ref<HTMLCanvasElement | null>(null);
let animId = 0;
const chars = '01アイウエオカキクケコサシスセソタチツテト01'.split('');
const fontSize = 14;

onMounted(() => {
  const c = canvas.value; if (!c) return;
  const ctx = c.getContext('2d'); if (!ctx) return;

  function resize() {
    c!.width = c!.parentElement!.clientWidth;
    c!.height = c!.parentElement!.clientHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const cols = () => Math.floor((c as HTMLCanvasElement).width / fontSize);
  let drops: number[] = [];

  function init() { drops = Array(cols()).fill(0).map(() => Math.random() * (c as HTMLCanvasElement).height / fontSize); }
  init();

  function draw() {
    ctx!.fillStyle = 'rgba(6, 10, 16, 0.08)';
    ctx!.fillRect(0, 0, (c as HTMLCanvasElement).width, (c as HTMLCanvasElement).height);
    ctx!.fillStyle = '#00FF88';
    ctx!.font = `${fontSize}px JetBrains Mono`;

    for (let i = 0; i < drops.length; i++) {
      const text = chars[Math.floor(Math.random() * chars.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;
      ctx!.globalAlpha = 0.15;
      ctx!.fillText(text, x, y);
      if (y > (c as HTMLCanvasElement).height && Math.random() > 0.98) drops[i] = 0;
      drops[i]++;
    }
    ctx!.globalAlpha = 1;
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
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none; z-index: 0;
  opacity: 0.5;
}
</style>