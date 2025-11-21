<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import lottie, { type AnimationItem } from 'lottie-web';
import omikujiAnimeData from '$lib/assets/omikuji-anime-data.json';

interface Props {
  onComplete?: () => void;
}

let { onComplete }: Props = $props();

let animationContainer: HTMLDivElement;
let animation: AnimationItem | null = null;

onMount(() => {
  if (animationContainer) {
    // Load and play the animation
    animation = lottie.loadAnimation({
      container: animationContainer,
      renderer: 'svg',
      loop: false, // Play only once
      autoplay: true,
      animationData: omikujiAnimeData,
    });

    // Listen for completion event
    animation.addEventListener('complete', () => {
      if (onComplete) {
        onComplete();
      }
    });
  }
});

onDestroy(() => {
  if (animation) {
    animation.destroy();
  }
});
</script>

<div class="flex justify-center items-center">
  <div bind:this={animationContainer} class="w-64 h-64"></div>
</div>
