<script lang="ts">
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { onMount, onDestroy } from 'svelte';
import settingsIcon from '$lib/assets/settings.svg';
import nostrIcon from '$lib/assets/nostr-icon.svg';
import lightningIcon from '$lib/assets/lightning-icon.svg';
import OmikujiAnimation from '$lib/components/OmikujiAnimation.svelte';
import {
  decodeNsec,
  createTextEvent,
  createZapRequest,
  publishEvent,
  createMetadataEvent,
  getZapInvoiceFromEndpoint,
  subscribeToZapReceipts,
  createNeventUri,
  handleZapReceived,
  type ZapReceiptSubscription,
  type NostrEvent,
  generateLuckyNumber,
  generateRandomBase64,
  getTargetEventMessage,
} from '$lib/nostr';
import { generateLightningQRCode, generateNostrQRCode } from '$lib/qrcode';
import { nip57 } from 'nostr-tools';
import { startCoinosPolling, type CoinosPollingSubscription } from '$lib/coinos';

import bg from '$lib/assets/background.png';

let backgroundImage = bg;

// QR code display type enum
type QRCodeDisplayType = 'nostr' | 'lightning';

// UI状態
let isLoading = false;
let qrCodeDataUrl = '';
let neventQrCodeDataUrl = '';
let errorMessage = '';
let isWaitingForZap = false;
let zapDetected = false;
let randomNumber: number | null = null;
let publishedToRelay = false;
let selectedQRType: QRCodeDisplayType = 'nostr';
let isAnimationPlaying = false;

// Zap検知用の状態
let zapSubscription: ZapReceiptSubscription | null = null;
let coinosPollingSubscription: CoinosPollingSubscription | null = null;
let currentZapRequest: NostrEvent | null = null;
let currentTargetEventId: string | null = null;
let paymentId: string | null = null;

// 設定データ
let lightningAddress = '';
let nostrPrivateKey = '';
let coinosApiToken = '';
let eventTag = ''; // イベントタグ
let allowDirectNostrZap = true; // デフォルトtrue

// 設定データを読み込み
onMount(() => {
  if (typeof window !== 'undefined') {
    lightningAddress = localStorage.getItem('lightningAddress') || '';
    nostrPrivateKey = localStorage.getItem('nostrPrivateKey') || '';
    coinosApiToken = localStorage.getItem('coinosApiToken') || '';
    eventTag = localStorage.getItem('eventTag') || 'nostrasia2025'; // デフォルト値
    const storedAllowDirectNostrZap = localStorage.getItem('allowDirectNostrZap');
    // デフォルトはtrue、明示的にfalseの場合のみfalse
    allowDirectNostrZap = storedAllowDirectNostrZap === null ? true : storedAllowDirectNostrZap === 'true';
  }
});

// コンポーネント破棄時のクリーンアップ
onDestroy(() => {
  if (zapSubscription) {
    zapSubscription.stop();
  }
  if (coinosPollingSubscription) {
    coinosPollingSubscription.stop();
  }
});

function navigateToSettings() {
  goto(`${base}/settings`);
}

function clearMessages() {
  errorMessage = '';
}

function stopZapMonitoring() {
  if (zapSubscription) {
    zapSubscription.stop();
    zapSubscription = null;
  }
  if (coinosPollingSubscription) {
    coinosPollingSubscription.stop();
    coinosPollingSubscription = null;
  }
  isWaitingForZap = false;
  currentZapRequest = null;
  currentTargetEventId = null;
  paymentId = null;
}

async function onZapDetected(zapReceipt: NostrEvent) {
  if (zapDetected) {
    return;
  }

  console.log('[Fortune Slip] Zap detected!', zapReceipt);

  // coinosへのポーリングを停止
  coinosPollingSubscription?.stop();

  // QRコードを非表示
  qrCodeDataUrl = '';
  neventQrCodeDataUrl = '';
  // 番号生成
  randomNumber = generateLuckyNumber(1, 20);
  // アニメーション表示を開始
  isAnimationPlaying = true;
  // 待機状態を終了
  isWaitingForZap = false;

  try {
    // フォーチュン機能を実行（メンション付きkind1イベントを送信）
    if (currentTargetEventId && nostrPrivateKey) {
      const fortuneResult = await handleZapReceived(
        zapReceipt,
        currentTargetEventId,
        nostrPrivateKey,
        randomNumber,
        eventTag,
      );

      if (fortuneResult) {
        console.log('[Fortune Slip] Fortune message sent successfully!');
      } else {
        console.warn('[Fortune Slip] Failed to send fortune message');
      }
    }

    // サブスクリプション停止
    stopZapMonitoring();
  } catch (error) {
    console.error('[Fortune Slip] Error handling zap:', error);

    // すでに成功している場合はrandomNumberに値が存在するのでそれを使用する
    if (!randomNumber) {
      // エラーが発生してもUI上では成功として表示
      randomNumber = generateLuckyNumber(1, 20);
    }
    isAnimationPlaying = true;
    isWaitingForZap = false;
    stopZapMonitoring();
  }
}

function onZapError(error: string) {
  console.error('[Fortune Slip] Zap verification error:', error);

  // Zapエラーが発生した場合
  errorMessage = `Zap検証エラー: ${error}`;

  // 待機状態を終了
  isWaitingForZap = false;
  qrCodeDataUrl = '';
  neventQrCodeDataUrl = '';

  // サブスクリプション停止
  stopZapMonitoring();
}

async function onCoinosPaymentDetected(payment: any) {
  if (zapDetected) {
    return;
  }
  console.log('[Fortune Slip] Coinos payment detected!', payment);

  // zapの購読を停止
  zapSubscription?.stop();

  // QRコードを非表示
  qrCodeDataUrl = '';
  neventQrCodeDataUrl = '';
  // 番号生成
  randomNumber = generateLuckyNumber(1, 20);
  // アニメーション表示を開始
  isAnimationPlaying = true;
  // 待機状態を終了
  isWaitingForZap = false;

  try {
    // フォーチュン機能を実行（メンション付きkind1イベントを送信）
    // coinosポーリングの場合はzapReceiptがないため、nullを渡す
    if (currentTargetEventId && nostrPrivateKey) {
      const privateKeyBytes = decodeNsec(nostrPrivateKey);
      const fortuneMessage = `Fortune Number is ${randomNumber}`;

      // eventにリプライタグを追加
      const tags = [['e', currentTargetEventId, '', 'reply']];
      const event = createTextEvent(privateKeyBytes, fortuneMessage, tags);

      await publishEvent(event);

      console.log('[Fortune Slip] Fortune message sent successfully via Coinos polling!');
    }

    // サブスクリプション停止
    stopZapMonitoring();
  } catch (error) {
    console.error('[Fortune Slip] Error handling coinos payment:', error);
    // すでに成功している場合はrandomNumberに値が存在するのでそれを使用する
    if (!randomNumber) {
      // エラーが発生してもUI上では成功として表示
      randomNumber = generateLuckyNumber(1, 20);
    }
    isAnimationPlaying = true;
    isWaitingForZap = false;
    stopZapMonitoring();
  }
}

function resetFortuneSlip() {
  qrCodeDataUrl = '';
  neventQrCodeDataUrl = '';
  zapDetected = false;
  randomNumber = null;
  isWaitingForZap = false;
  isAnimationPlaying = false;
  selectedQRType = 'nostr'; // タブをNostrにリセット
  stopZapMonitoring();
  clearMessages();
}

async function generateQRCode() {
  clearMessages();
  resetFortuneSlip();

  // 設定が不完全な場合は設定画面に誘導
  if (!lightningAddress || !nostrPrivateKey) {
    errorMessage = '設定が不完全です。まず設定画面でライトニングアドレスとNostr秘密鍵を入力してください。';
    return;
  }

  isLoading = true;

  try {
    // 1. Nostr秘密鍵をデコード
    const privateKeyBytes = decodeNsec(nostrPrivateKey);

    // 2. Nostr kind 1イベントを作成・送信
    const textEvent = createTextEvent(privateKeyBytes, getTargetEventMessage());
    try {
      await publishEvent(textEvent);
      publishedToRelay = true;
    } catch (error) {
      console.warn('[Fortune Slip] Failed to publish event to relays, but continuing:', error);
      publishedToRelay = false;
      errorMessage = 'Nostrリレーへの接続に失敗しました。Lightning支払いは可能ですが、Nostr Zapは利用できません。';
      // リレーへの接続に失敗してもQRコード生成は続行
    }

    // 3. recipientのmetadata eventを作成（簡易版）
    // 実際のアプリではリレーから取得するが、ここでは設定値から作成
    const recipientPubkey = textEvent.pubkey; // 自分自身にzapする場合
    const metadataEvent = createMetadataEvent(recipientPubkey, lightningAddress);

    // 4. zapUrl取得
    const zapUrl = await await nip57.getZapEndpoint(metadataEvent);
    if (zapUrl === null) {
      throw new Error(`Zapエンドポイントが見つかりません。ライトニングアドレス: ${lightningAddress}`);
    }

    console.debug('[zap endpoint]', zapUrl);

    // 5. ランダムな8byte値を生成
    const randomValue = generateRandomBase64();
    paymentId = randomValue;
    console.log('[Fortune Slip] Generated payment ID:', randomValue);

    // 1 sat = 1000 millisats
    const satsAmount = 100 * 1000; // TODO: デフォルト値を設定できるようにする

    // 6. Zapリクエストを作成（ランダム値をcommentに埋め込む）
    const zapRequest = createZapRequest(
      privateKeyBytes,
      textEvent, // 完全なeventオブジェクト
      satsAmount,
      randomValue, // ランダム値をコメントに埋め込む
    );

    // 6. Zapインボイスを取得
    const invoice = await getZapInvoiceFromEndpoint(zapUrl, satsAmount, zapRequest);

    // 7. QRコードを生成
    const qrCode = await generateLightningQRCode(invoice.pr);
    qrCodeDataUrl = qrCode;

    // 8. nevent URIとQRコードを生成
    const neventUri = createNeventUri(textEvent);
    const neventQrCode = await generateNostrQRCode(neventUri);
    neventQrCodeDataUrl = neventQrCode;

    // 9. Zap検知を開始
    currentZapRequest = zapRequest;
    currentTargetEventId = textEvent.id;

    zapSubscription = subscribeToZapReceipts(
      textEvent.id,
      zapRequest,
      onZapDetected,
      300000, // 5分タイムアウト
      allowDirectNostrZap, // 設定を渡す
      coinosApiToken, // Coinos API Token（オプション）
      onZapError, // エラーコールバック
    );

    // 10. Coinos APIポーリングを開始（トークンが設定されている場合のフォールバック）
    if (coinosApiToken && coinosApiToken.trim()) {
      console.log('[Fortune Slip] Starting Coinos polling as fallback');
      coinosPollingSubscription = startCoinosPolling(
        randomValue,
        coinosApiToken,
        onCoinosPaymentDetected,
        10000, // 10秒間隔
        300000, // 5分タイムアウト
      );
    }

    isWaitingForZap = true;

    // QRコード表示時にタブをNostrにリセット
    selectedQRType = 'nostr';
  } catch (error) {
    console.error('QR code generation failed:', error);
    errorMessage = error instanceof Error ? error.message : 'QRコードの生成に失敗しました。';
  } finally {
    isLoading = false;
  }
}

function showSubmit() {
  return !qrCodeDataUrl && !neventQrCodeDataUrl && !isWaitingForZap && !zapDetected && !isAnimationPlaying;
}

function handleAnimationComplete() {
  // アニメーション完了後に番号表示に切り替え
  isAnimationPlaying = false;
  zapDetected = true;
}
</script>

<div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 bg-cover bg-center relative flex flex-col" style="background-image: url('{backgroundImage}');">
  <!-- 設定アイコン - 右上に配置 -->
  <button 
    on:click={navigateToSettings}
    class="absolute top-14 right-4 w-12 h-12 bg-opacity-70 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 z-10"
    aria-label="設定画面へ"
  >
    <img src={settingsIcon} alt="設定" class="w-10 h-10" />
  </button>

  <div class="max-w-md mx-auto grow flex items-center">
    <div class="text-center">
      {#if !showSubmit() && !zapDetected && !isAnimationPlaying}
      <div class="bg-white shadow rounded-lg p-6 min-w-100">
        <!-- エラーメッセージ -->
        {#if errorMessage}
          <div class="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md">
            {errorMessage}
          </div>
        {/if}

        <!-- Zap待機中のステータス -->
        {#if isWaitingForZap}
          <div class="rounded-md p-3 mb-4">
            <p class="text-m mt-2 font-bold">
              Scan the QR code and send 100 sats
            </p>
          </div>
        {/if}

        {#if qrCodeDataUrl}
          <div class="mb-6">
            <!-- Toggle buttons for QR code selection -->
            {#if neventQrCodeDataUrl && allowDirectNostrZap && publishedToRelay}
              <div class="flex mb-4 justify-center">
                <button
                  on:click={() => selectedQRType = 'nostr'}
                  class="flex-1 py-2 px-4 font-medium transition-all focus:outline-none border-b-2 flex items-center justify-center max-w-25 {selectedQRType === 'nostr' ? 'text-red-600 border-red-600' : 'text-red-400 border-red-200 hover:text-red-500 hover:border-red-300'}"
                >
                  <img src={nostrIcon} alt="" class="w-5 h-5 {selectedQRType === 'nostr' ? 'opacity-100' : 'opacity-60'}" />
                  Nostr
                </button>
                <button
                  on:click={() => selectedQRType = 'lightning'}
                  class="flex-1 py-2 font-medium transition-all focus:outline-none border-b-2 flex items-center justify-center max-w-25 {selectedQRType === 'lightning' ? 'text-red-600 border-red-600' : 'text-red-400 border-red-200 hover:text-red-500 hover:border-red-300'}"
                >
                  <img src={lightningIcon} alt="" class="w-5 h-5 {selectedQRType === 'lightning' ? 'opacity-100' : 'opacity-60'}" />
                  Lightning
                </button>
              </div>
            {/if}

            <!-- Nostr Event QR Code (設定で許可され、リレーにパブリッシュ成功時のみ表示) -->
            {#if neventQrCodeDataUrl && allowDirectNostrZap && publishedToRelay}
              <div class="mb-4" style="display: {selectedQRType === 'nostr' ? 'block' : 'none'};">
                <div class="flex justify-center mb-2">
                  <img src={neventQrCodeDataUrl} alt="Nostr Event QR Code" class="max-w-full h-auto rounded-lg shadow-sm" style="max-width: 200px;" />
                </div>
              </div>
            {/if}

            <!-- Lightning Invoice QR Code -->
            <div class="mb-4" style="display: {(neventQrCodeDataUrl && allowDirectNostrZap && publishedToRelay) ? (selectedQRType === 'lightning' ? 'block' : 'none') : 'block'};">
              <div class="flex justify-center mb-2">
                <img src={qrCodeDataUrl} alt="Lightning Invoice QR Code" class="max-w-full h-auto rounded-lg shadow-sm" style="max-width: 200px;" />
              </div>
            </div>
            
            <!-- キャンセルボタン -->
            {#if isWaitingForZap}
              <button
                on:click={resetFortuneSlip}
                class="font-medium py-2 px-4 transition-colors mt-4 border rounded-full"
              >
                Cancel
              </button>
            {/if}
          </div>
        {/if}

        
      </div>
      {:else if !zapDetected}
      <!-- Fixed button container at the bottom -->
      <div class="fixed bottom-0 left-0 right-0 px-4 pb-18 pt-2 z-10">
        <div class="max-w-md mx-auto">
          <!-- QRコード生成ボタン -->
          <button
            on:click={generateQRCode}
            disabled={isLoading || isWaitingForZap}
            class="h-20 w-80 bg-red-900 disabled:bg-amber-600 disabled:cursor-not-allowed text-white text-3xl font-medium py-4 px-4 transition-colors outline-1 pl-6 pr-6 rounded-full"
          >
            {#if isLoading}
              <div class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </div>
            {:else}
              Pray for 100 sats
            {/if}
          </button>
        </div>
      </div>
      {/if}

      <!-- アニメーション表示 -->
      {#if isAnimationPlaying}
      <div class="p-6 w-full max-w-md">
        <OmikujiAnimation onComplete={handleAnimationComplete} />
      </div>
      {/if}

      <!-- Zap検知後のランダム数字表示 -->
      {#if zapDetected && !isAnimationPlaying}
      <div class="mb-6 bg-white pl-4 pr-4 w-50">
        <div class="flex justify-center mb-4 border-b">
          <div class="h-36 flex items-center justify-center">
            <span class="font-bold text-amber-700 text-7xl mb-4">{randomNumber}</span>
          </div>
        </div>
        <h3 class="text-2xl font-bold">All done!</h3>
        <p class="text-sm text-gray-600 text-center mb-4 mt-4 font-bold">
          Please take your<br/> numbered omikuji.
        </p>
        <!-- もう一度ボタン -->
        <button
          on:click={resetFortuneSlip}
          class="w-full py-2 px-4 mb-18 border text-sm rounded-2xl"
        >
          Try another omikuji
        </button>
      </div>
    {/if}
    </div>
  </div>
</div>
