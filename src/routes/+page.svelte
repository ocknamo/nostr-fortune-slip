<script lang="ts">
import { goto } from '$app/navigation';

function navigateToSettings() {
  goto('/settings');
}
</script>

<div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md mx-auto">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">
        Nostr Fortune Slip
      </h1>
      
      <div class="bg-white shadow rounded-lg p-6">
        <p class="text-gray-600 mb-6">
          メイン機能は開発中です。まずは設定を行ってください。
        </p>
        
        <button
          on:click={navigateToSettings}
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          設定画面へ
        </button>
      </div>
    </div>
  </div>
</div>
