<template>
  <canvas ref="canvas" class="code-rain"></canvas>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';

const canvas = ref<HTMLCanvasElement | null>(null);
let animId = 0;

const chars = '0123456789ABCDEF'.split('');
const fontSize = 13;

interface Sword {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  trail: { x: number; y: number; char: string }[];
  maxTrail: number;
}

onMounted(() => {
  const el = canvas.value; if (!el) return;
  let ctx: CanvasRenderingContext2D | null;
  try { ctx = el.getContext('2d'); } catch { return; }
  if (!ctx) return;

  const greenHue = '#00FF88';
  const cyanHue  = '#00D4FF';
  const goldHue  = '#F0C040';
  const redHue   = '#FF5050';

  function resize() {
    el!.width = window.innerWidth - 232;
    el!.height = window.innerHeight - 52;
  }
  resize();
  window.addEventListener('resize', resize);

  const swords: Sword[] = [];

  function spawn(): Sword {
    const r = Math.random();
    let color: string;
    if (r < 0.50) color = greenHue;
    else if (r < 0.80) color = cyanHue;
    else if (r < 0.95) color = goldHue;
    else color = redHue;

    const dx = (Math.random() - 0.5) * 1.6;
    const dy = Math.random() * 0.8 + 0.6;
    const len = Math.sqrt(dx * dx + dy * dy);
    const speed = Math.random() * 0.9 + 0.5;

    return {
      x: Math.random() * el!.width,
      y: Math.random() * el!.height,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      color,
      trail: [],
      maxTrail: Math.floor(Math.random() * 16 + 10),
    };
  }

  for (let i = 0; i < 30; i++) swords.push(spawn());

  function draw() {
    const c = ctx!;
    const w = el!.width;
    const h = el!.height;

    c.fillStyle = 'rgba(13, 19, 24, 0.04)';
    c.fillRect(0, 0, w, h);

    for (const s of swords) {
      s.x += s.vx;
      s.y += s.vy;

      s.trail.push({
        x: s.x,
        y: s.y,
        char: chars[Math.floor(Math.random() * chars.length)],
      });
      if (s.trail.length > s.maxTrail) s.trail.shift();

      const len = s.trail.length;
      for (let i = 0; i < len; i++) {
        const progress = i / len;
        const alpha = progress * 0.35;
        c.globalAlpha = alpha;
        c.fillStyle = s.color;
        const sz = fontSize - 3 + progress * 5;
        c.font = `bold ${sz}px JetBrains Mono`;
        c.fillText(s.trail[i].char, s.trail[i].x, s.trail[i].y);
      }

      // tip: brightest
      c.globalAlpha = 0.75;
      c.font = `bold ${fontSize}px JetBrains Mono`;
      c.fillStyle = s.color;
      const tip = chars[Math.floor(Math.random() * chars.length)];
      c.fillText(tip, s.x, s.y);

      // glow around tip
      c.globalAlpha = 0.12;
      c.font = `bold ${fontSize + 4}px JetBrains Mono`;
      c.fillText(tip, s.x, s.y);

      // respawn
      if (s.y > h + 30 || s.x < -30 || s.x > w + 30) {
        const fresh = spawn();
        s.x = fresh.x;
        s.y = -Math.random() * 60;
        s.vx = fresh.vx;
        s.vy = fresh.vy;
        s.color = fresh.color;
        s.trail = [];
      }
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
