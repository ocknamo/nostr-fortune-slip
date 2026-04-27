<script lang="ts">
import { onMount } from 'svelte';
import confetti from 'canvas-confetti';

interface Props {
  text: string;
  showConfetti?: boolean;
  onComplete?: () => void;
}

let { text, showConfetti = true, onComplete }: Props = $props();

let phase: 'lightning' | 'reveal' | 'done' = $state('lightning');
let canvasEl: HTMLCanvasElement | undefined = $state();

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
}

// branchRate: 枝分かれ確率, branchDepthPenalty: 枝の深度ペナルティ
function buildSegs(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  depth: number,
  width: number,
  out: Seg[],
  branchRate: number,
  branchDepthPenalty: number,
) {
  if (depth === 0 || Math.hypot(x2 - x1, y2 - y1) < 6) {
    out.push({ x1, y1, x2, y2, w: width });
    return;
  }
  const len = Math.hypot(x2 - x1, y2 - y1);
  const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * len * 0.4;
  const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * len * 0.15;

  buildSegs(x1, y1, midX, midY, depth - 1, width, out, branchRate, branchDepthPenalty);
  buildSegs(midX, midY, x2, y2, depth - 1, width, out, branchRate, branchDepthPenalty);

  // 枝分かれ: 「血管のように這う」
  if (depth > 1 && Math.random() < branchRate) {
    const angle = (Math.random() - 0.5) * 1.4; // ±40度くらい
    const branchLen = len * (0.3 + Math.random() * 0.3);
    const bx = midX + Math.sin(angle) * branchLen;
    const by = midY + Math.cos(angle) * branchLen * 0.7 + branchLen * 0.3;
    buildSegs(midX, midY, bx, by, depth - branchDepthPenalty, width * 0.5, out, branchRate * 0.7, branchDepthPenalty);
  }
}

interface BoltData {
  segs: Seg[];
  color: string;
  glowColor: string;
  glowWidth: number;
}

function generateBolts(w: number, h: number): BoltData[] {
  const bolts: BoltData[] = [];

  // ── 中央の黄金の雷（太い・枝分かれ密・黄→オレンジグラデ） ──
  // オレンジの外殻
  const mainOuter: Seg[] = [];
  buildSegs(w * 0.5 + (Math.random() - 0.5) * 10, 0, w * 0.5 + (Math.random() - 0.5) * 30, h, 7, 5, mainOuter, 0.55, 2);
  bolts.push({ segs: mainOuter, color: '#f97316', glowColor: '#f97316', glowWidth: 7 });

  // 黄色のコア（同じパスを少し細く）
  bolts.push({ segs: mainOuter, color: '#facc15', glowColor: '#facc15', glowWidth: 4 });

  // 白い芯
  bolts.push({ segs: mainOuter, color: '#ffffff', glowColor: '#fffbe6', glowWidth: 1.5 });

  // ── 中央脇の黄金サブ ──
  for (const xr of [0.38, 0.46, 0.54, 0.62]) {
    const segs: Seg[] = [];
    buildSegs(w * xr, 0, w * xr + (Math.random() - 0.5) * 50, h * (0.75 + Math.random() * 0.2), 6, 2, segs, 0.45, 2);
    bolts.push({ segs, color: '#facc15', glowColor: '#f59e0b', glowWidth: 3 });
  }

  // ── 左右の紫の雷（細く鋭い） ──
  const purpleDefs: [number, number, number][] = [
    [0.22, 0.12, 0.95],
    [0.78, 0.88, 0.95],
    [0.14, 0.05, 0.9],
    [0.86, 0.95, 0.9],
    [0.06, 0.0, 0.8],
    [0.94, 1.0, 0.8],
    [0.3, 0.2, 0.75],
    [0.7, 0.8, 0.75],
    [0.18, 0.25, 0.7],
    [0.82, 0.75, 0.7],
    [0.26, 0.15, 0.65],
    [0.74, 0.85, 0.65],
  ];

  for (const [sxr, exr, endH] of purpleDefs) {
    const segs: Seg[] = [];
    buildSegs(w * sxr, 0, w * exr, h * endH, 6, 1.5, segs, 0.4, 2);
    bolts.push({ segs, color: '#c4b5fd', glowColor: '#a855f7', glowWidth: 2.5 });
  }

  return bolts;
}

function drawBolts(ctx: CanvasRenderingContext2D, bolts: BoltData[], alpha: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';

  // パス1: グロー（太い半透明）
  ctx.globalAlpha = Math.min(alpha * 0.35, 1);
  for (const bolt of bolts) {
    ctx.beginPath();
    ctx.strokeStyle = bolt.glowColor;
    ctx.lineWidth = bolt.glowWidth * 4;
    for (const s of bolt.segs) {
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.stroke();
  }

  // パス2: コア
  ctx.globalAlpha = Math.min(alpha, 1);
  for (const bolt of bolts) {
    ctx.beginPath();
    ctx.strokeStyle = bolt.color;
    for (const s of bolt.segs) {
      ctx.lineWidth = s.w;
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.stroke();
  }

  ctx.restore();
}

// 1ストライク: フェードイン → 維持 → フェードアウト
function animateStrike(ctx: CanvasRenderingContext2D, w: number, h: number, bolts: BoltData[], onDone: () => void) {
  const FADE_IN = 150;
  const HOLD = 400;
  const FADE_OUT = 450;
  const start = performance.now();
  let rafId: number;

  function frame(now: number) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, w, h);

    if (elapsed < FADE_IN) {
      // スムーズにフェードイン
      const t = elapsed / FADE_IN;
      const eased = 1 - (1 - t) ** 2; // ease-out
      drawBolts(ctx, bolts, eased);
      rafId = requestAnimationFrame(frame);
    } else if (elapsed < FADE_IN + HOLD) {
      // 維持
      drawBolts(ctx, bolts, 1);
      rafId = requestAnimationFrame(frame);
    } else if (elapsed < FADE_IN + HOLD + FADE_OUT) {
      // スムーズにフェードアウト
      const ft = (elapsed - FADE_IN - HOLD) / FADE_OUT;
      const eased = 1 - (1 - ft) ** 3; // ease-out cubic
      drawBolts(ctx, bolts, 1 - eased);
      rafId = requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, w, h);
      onDone();
      return;
    }
  }

  rafId = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(rafId);
}

function startLightningAnimation(canvas: HTMLCanvasElement): number {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;

  const STRIKE_MS = 150 + 400 + 450;
  const GAP = 150;

  const bolts1 = generateBolts(w, h);
  animateStrike(ctx, w, h, bolts1, () => {
    setTimeout(() => {
      const bolts2 = generateBolts(w, h);
      animateStrike(ctx, w, h, bolts2, () => {});
    }, GAP);
  });

  return STRIKE_MS + GAP + STRIKE_MS;
}

function fireConfetti() {
  const colors = ['#facc15', '#fbbf24', '#f59e0b', '#ffffff', '#a855f7', '#38bdf8'];

  // バースト1: 中央から大爆発
  confetti({ particleCount: 350, spread: 160, startVelocity: 65, gravity: 0.7, origin: { x: 0.5, y: 0.0 }, colors });

  // バースト2: 左右から
  setTimeout(() => {
    confetti({
      particleCount: 200,
      spread: 100,
      startVelocity: 55,
      gravity: 0.75,
      angle: 55,
      origin: { x: 0.0, y: 0.1 },
      colors,
    });
    confetti({
      particleCount: 200,
      spread: 100,
      startVelocity: 55,
      gravity: 0.75,
      angle: 125,
      origin: { x: 1.0, y: 0.1 },
      colors,
    });
  }, 120);

  // バースト3: 中央上段から再噴射
  setTimeout(() => {
    confetti({
      particleCount: 150,
      spread: 120,
      startVelocity: 50,
      gravity: 0.8,
      origin: { x: 0.35, y: 0.05 },
      colors,
    });
    confetti({
      particleCount: 150,
      spread: 120,
      startVelocity: 50,
      gravity: 0.8,
      origin: { x: 0.65, y: 0.05 },
      colors,
    });
  }, 300);

  // バースト4: 四隅から追い打ち
  setTimeout(() => {
    confetti({
      particleCount: 120,
      spread: 80,
      startVelocity: 50,
      gravity: 0.85,
      angle: 45,
      origin: { x: 0.0, y: 0.0 },
      colors,
    });
    confetti({
      particleCount: 120,
      spread: 80,
      startVelocity: 50,
      gravity: 0.85,
      angle: 135,
      origin: { x: 1.0, y: 0.0 },
      colors,
    });
  }, 500);

  // バースト5: 最後にもう一発
  setTimeout(() => {
    confetti({
      particleCount: 250,
      spread: 170,
      startVelocity: 60,
      gravity: 0.65,
      origin: { x: 0.5, y: 0.05 },
      colors,
    });
  }, 700);
}

onMount(() => {
  if (!canvasEl) return;

  canvasEl.width = window.innerWidth;
  canvasEl.height = window.innerHeight;

  const totalMs = startLightningAnimation(canvasEl);

  const revealTimer = setTimeout(() => {
    phase = 'reveal';
    if (showConfetti) fireConfetti();
  }, totalMs);

  const doneTimer = setTimeout(() => {
    phase = 'done';
    onComplete?.();
  }, totalMs + 2500);

  return () => {
    clearTimeout(revealTimer);
    clearTimeout(doneTimer);
  };
});
</script>

<!-- オーバーレイ全体 -->
<div class="fixed inset-0 flex items-center justify-center z-50 overflow-hidden">

  <!-- 暗背景 -->
  <div class="absolute inset-0 bg-black/88"></div>

  <!-- 稲妻 Canvas -->
  <canvas
    bind:this={canvasEl}
    class="absolute inset-0 w-full h-full pointer-events-none"
  ></canvas>

  <!-- テキスト出現 -->
  {#if phase === 'reveal' || phase === 'done'}
    <div class="relative flex flex-col items-center gap-6 animate-text-reveal">
      <p class="text-8xl font-extrabold text-yellow-300 drop-shadow-[0_0_40px_rgba(250,204,21,1.0)] tracking-widest">
        {text}
      </p>
    </div>
  {/if}

</div>

<style>
  @keyframes text-reveal {
    0%   { opacity: 0; transform: scale(2.5); filter: blur(12px); }
    50%  { opacity: 1; transform: scale(1.05); filter: blur(0); }
    70%  { transform: scale(0.97); }
    100% { opacity: 1; transform: scale(1); }
  }
  .animate-text-reveal {
    animation: text-reveal 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
</style>
