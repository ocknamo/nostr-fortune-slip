<script lang="ts">
import { goto } from '$app/navigation';
import { onMount } from 'svelte';
import { decodeNsec, createTextEvent, createZapRequest, publishEvent } from '$lib/nostr';
import { LightningAddress } from '$lib/lightning';
import { generateLightningQRCode } from '$lib/qrcode';

// UI状態
let isLoading = false;
let qrCodeDataUrl = '';
let errorMessage = '';
let successMessage = '';

// 設定データ
let lightningAddress = '';
let nostrPrivateKey = '';

// 設定データを読み込み
onMount(() => {
  if (typeof window !== 'undefined') {
    lightningAddress = localStorage.getItem('lightningAddress') || '';
    nostrPrivateKey = localStorage.getItem('nostrPrivateKey') || '';
  }
});

function navigateToSettings() {
  goto('/settings');
}

function clearMessages() {
  errorMessage = '';
  successMessage = '';
}

async function generateQRCode() {
  clearMessages();

  // 設定が不完全な場合は設定画面に誘導
  if (!lightningAddress || !nostrPrivateKey) {
    errorMessage = '設定が不完全です。まず設定画面でライトニングアドレスとNostr秘密鍵を入力してください。';
    return;
  }

  isLoading = true;
  qrCodeDataUrl = '';

  try {
    // 1. Nostr秘密鍵をデコード
    const privateKeyBytes = decodeNsec(nostrPrivateKey);

    // 2. Nostr kind 1イベントを作成・送信
    const textEvent = createTextEvent(privateKeyBytes, 'test');
    await publishEvent(textEvent);

    // 3. ライトニングアドレスからLNURL-payデータを取得
    const address = new LightningAddress(lightningAddress);
    await address.fetchAddressData();

    // 4. LNURL形式に変換
    const lnurl = address.toLnurl();

    // 5. Zapリクエストを作成
    const zapRequest = createZapRequest(
      privateKeyBytes,
      textEvent.pubkey, // recipient is the same as sender for this use case
      textEvent.id,
      lnurl,
      1000, // 1 sat = 1000 millisats
    );

    // 6. インボイスを取得
    const invoice = await address.getInvoice(1000);

    // 7. QRコードを生成
    const qrCode = await generateLightningQRCode(invoice.pr);
    qrCodeDataUrl = qrCode;

    successMessage = 'QRコードが正常に生成されました！';
  } catch (error) {
    console.error('QR code generation failed:', error);
    errorMessage = error instanceof Error ? error.message : 'QRコードの生成に失敗しました。';
  } finally {
    isLoading = false;
  }
}
</script>

<div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md mx-auto">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">
        Nostr Fortune Slip
      </h1>
      
      <div class="bg-white shadow rounded-lg p-6">
        <!-- エラーメッセージ -->
        {#if errorMessage}
          <div class="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md">
            {errorMessage}
          </div>
        {/if}

        <!-- 成功メッセージ -->
        {#if successMessage}
          <div class="mb-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded-md">
            {successMessage}
          </div>
        {/if}

        <!-- QRコード表示エリア -->
        {#if qrCodeDataUrl}
          <div class="mb-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Lightning Invoice QR Code</h3>
            <div class="flex justify-center mb-4">
              <img src={qrCodeDataUrl} alt="Lightning Invoice QR Code" class="max-w-full h-auto rounded-lg shadow-sm" />
            </div>
            <p class="text-sm text-gray-600">
              このQRコードは1 satのLightning支払い用です。
            </p>
          </div>
        {:else if !isLoading}
          <div class="mb-6">
            <p class="text-gray-600 mb-4">
              ボタンを押すとLightning支払い用のQRコードが生成されます。
            </p>
          </div>
        {/if}

        <!-- QRコード生成ボタン -->
        <button
          on:click={generateQRCode}
          disabled={isLoading}
          class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mb-4"
        >
          {#if isLoading}
            <div class="flex items-center justify-center">
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              生成中...
            </div>
          {:else}
            QRコードを生成
          {/if}
        </button>

        <!-- 設定画面への遷移ボタン -->
        <button
          on:click={navigateToSettings}
          class="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          設定画面へ
        </button>
      </div>
    </div>
  </div>
</div>
