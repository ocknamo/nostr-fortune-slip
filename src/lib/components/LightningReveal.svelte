<script lang="ts">
import { onMount } from 'svelte';

interface Props {
  text: string;
  onComplete?: () => void;
}

let { text, onComplete }: Props = $props();

let phase: 'flash' | 'lightning' | 'reveal' | 'done' = $state('flash');

onMount(() => {
  // フェーズ1: 画面フラッシュ (0ms)
  phase = 'flash';

  // フェーズ2: 稲妻 (150ms後)
  setTimeout(() => {
    phase = 'lightning';
  }, 150);

  // フェーズ3: テキスト出現 (600ms後)
  setTimeout(() => {
    phase = 'reveal';
  }, 600);

  // フェーズ4: 完了 (2200ms後)
  setTimeout(() => {
    phase = 'done';
    onComplete?.();
  }, 2200);
});
</script>

<!-- オーバーレイ全体 -->
<div class="fixed inset-0 flex items-center justify-center z-50 overflow-hidden">

  <!-- フラッシュ -->
  {#if phase === 'flash'}
    <div class="absolute inset-0 bg-white animate-flash"></div>
  {/if}

  <!-- 稲妻 + 暗背景 -->
  {#if phase === 'lightning' || phase === 'reveal' || phase === 'done'}
    <div class="absolute inset-0 bg-black/80"></div>

    <!-- 稲妻SVG -->
    {#if phase === 'lightning'}
      <svg class="absolute inset-0 w-full h-full animate-lightning-fade" viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <!-- 左側稲妻 -->
        <polyline
          points="60,0 40,180 80,180 20,400 70,400 0,700"
          fill="none"
          stroke="white"
          stroke-width="3"
          filter="url(#glow)"
        />
        <!-- 右側稲妻 -->
        <polyline
          points="340,0 360,200 320,200 390,420 330,420 400,700"
          fill="none"
          stroke="white"
          stroke-width="3"
          filter="url(#glow)"
        />
        <!-- 中央稲妻 -->
        <polyline
          points="200,0 170,120 220,120 150,300 210,300 160,500"
          fill="none"
          stroke="#facc15"
          stroke-width="4"
          filter="url(#glow-yellow)"
        />
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glow-yellow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
      </svg>
    {/if}

    <!-- テキスト出現 -->
    {#if phase === 'reveal' || phase === 'done'}
      <div class="relative flex flex-col items-center gap-6 animate-text-reveal">
        <p class="text-8xl font-extrabold text-yellow-300 drop-shadow-[0_0_30px_rgba(250,204,21,0.9)] tracking-widest">
          {text}
        </p>
      </div>
    {/if}
  {/if}

</div>

<style>
  @keyframes flash {
    0%   { opacity: 1; }
    40%  { opacity: 1; }
    100% { opacity: 0; }
  }
  .animate-flash {
    animation: flash 0.3s ease-out forwards;
  }

  @keyframes lightning-fade {
    0%   { opacity: 1; }
    60%  { opacity: 1; }
    100% { opacity: 0; }
  }
  .animate-lightning-fade {
    animation: lightning-fade 0.5s ease-out forwards;
  }

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
