<template>
  <canvas ref="canvas" class="code-rain"></canvas>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';

const canvas = ref<HTMLCanvasElement | null>(null);
let animId = 0;
const chars = '01アイウエオカキクケコサシスセソタチツテト'.split('');
const fontSize = 14;

onMounted(() => {
  const el = canvas.value; if (!el) return;
  let ctx: CanvasRenderingContext2D | null;
  try { ctx = el.getContext('2d'); } catch { return; }
  if (!ctx) return;

  function resize() { el!.width = window.innerWidth - 232; el!.height = window.innerHeight - 52; }
  resize();
  window.addEventListener('resize', resize);

  let drops: number[] = [];
  function init() { drops = Array(Math.floor(el!.width / fontSize)).fill(0).map(() => Math.random() * el!.height / fontSize); }
  init();

  function draw() {
    const c = ctx!;
    c.fillStyle = 'rgba(13, 19, 24, 0.1)';
    c.fillRect(0, 0, el!.width, el!.height);
    c.fillStyle = '#00FF88';
    c.font = `bold ${fontSize}px JetBrains Mono`;

    for (let i = 0; i < drops.length; i++) {
      const text = chars[Math.floor(Math.random() * chars.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;
      c.globalAlpha = 0.15;
      c.fillText(text, x, y);
      if (y > el!.height && Math.random() > 0.98) drops[i] = 0;
      drops[i]++;
    }
    c.globalAlpha = 1;
    animId = requestAnimationFrame(draw);
  }
  draw();

  onBeforeUnmount(() => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); });
});
</script>

<style scoped>
.code-rain {
  position: fixed; top: 52px; left: 232px; right: 0; bottom: 0;
  pointer-events: none; z-index: 0;
}</style>
