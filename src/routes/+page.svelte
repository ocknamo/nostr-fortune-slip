<script lang="ts">
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { onMount, onDestroy } from 'svelte';
import settingsIcon from '$lib/assets/settings.svg';
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
let successMessage = '';
let isWaitingForZap = false;
let zapDetected = false;
let randomNumber: number | null = null;
let publishedToRelay = false;
let selectedQRType: QRCodeDisplayType = 'nostr';

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
  successMessage = '';
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
  // 状態を更新
  zapDetected = true;
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
    zapDetected = true;
    isWaitingForZap = false;
    stopZapMonitoring();

    successMessage = 'Zapを受信しました！';
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
  // 状態を更新
  zapDetected = true;
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
      successMessage = '支払いを検知しました！フォーチュンメッセージを送信しました🎉';
    } else {
      successMessage = '支払いを検知しました！';
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
    zapDetected = true;
    isWaitingForZap = false;
    stopZapMonitoring();

    successMessage = '支払いを検知しました！';
  }
}

function resetFortuneSlip() {
  qrCodeDataUrl = '';
  neventQrCodeDataUrl = '';
  zapDetected = false;
  randomNumber = null;
  isWaitingForZap = false;
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
  } catch (error) {
    console.error('QR code generation failed:', error);
    errorMessage = error instanceof Error ? error.message : 'QRコードの生成に失敗しました。';
  } finally {
    isLoading = false;
  }
}

function showSubmit() {
  return !qrCodeDataUrl && !neventQrCodeDataUrl && !isWaitingForZap && !zapDetected;
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
      {#if !showSubmit()}
      <div class="bg-white shadow rounded-lg p-6 min-w-100">
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

        <!-- Zap待機中のステータス -->
        {#if isWaitingForZap}
          <div class="rounded-md p-3 mb-4">
            <p class="text-sm mt-2">
              Scan the QR code and send 100 sats
            </p>
          </div>
        {/if}

        <!-- Zap検知後のランダム数字表示 -->
        {#if zapDetected && randomNumber}
          <div class="mb-6">
            <h3 class="text-2xl font-bold text-center text-green-600 mb-4">Fortune Number</h3>
            <div class="flex justify-center mb-4">
              <div class="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full w-24 h-24 flex items-center justify-center shadow-lg">
                <span class="text-3xl font-bold text-white">{randomNumber}</span>
              </div>
            </div>
            <p class="text-sm text-gray-600 text-center mb-4">
              あなたのラッキーナンバーです！
            </p>
            <!-- もう一度ボタン -->
            <button
              on:click={resetFortuneSlip}
              class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 mb-4"
            >
              もう一度おみくじを引く
            </button>
          </div>
        {:else if qrCodeDataUrl}
          <div class="mb-6">
            <!-- Toggle buttons for QR code selection -->
            {#if neventQrCodeDataUrl && allowDirectNostrZap && publishedToRelay}
              <div class="flex gap-2 mb-4">
                <button
                  on:click={() => selectedQRType = 'nostr'}
                  class="flex-1 py-2 px-4 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 {selectedQRType === 'nostr' ? 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400'}"
                >
                  Nostr
                </button>
                <button
                  on:click={() => selectedQRType = 'lightning'}
                  class="flex-1 py-2 px-4 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 {selectedQRType === 'lightning' ? 'bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400'}"
                >
                  Lightning
                </button>
              </div>
            {/if}

            <!-- Nostr Event QR Code (設定で許可され、リレーにパブリッシュ成功時のみ表示) -->
            {#if neventQrCodeDataUrl && allowDirectNostrZap && publishedToRelay}
              <div class="mb-4" style="display: {selectedQRType === 'nostr' ? 'block' : 'none'};">
                <h4 class="text-sm font-medium text-gray-700 mb-2 text-center">Zap to Nostr Event</h4>
                <div class="flex justify-center mb-2">
                  <img src={neventQrCodeDataUrl} alt="Nostr Event QR Code" class="max-w-full h-auto rounded-lg shadow-sm" style="max-width: 200px;" />
                </div>
                <p class="text-sm text-gray-600 text-center">
                  このQRコードはNostr Zap用です。
                </p>
              </div>
            {/if}

            <!-- Lightning Invoice QR Code -->
            <div class="mb-4" style="display: {(neventQrCodeDataUrl && allowDirectNostrZap && publishedToRelay) ? (selectedQRType === 'lightning' ? 'block' : 'none') : 'block'};">
              <h4 class="text-sm font-medium text-gray-700 mb-2 text-center">Lightning Invoice (1 sat)</h4>
              <div class="flex justify-center mb-2">
                <img src={qrCodeDataUrl} alt="Lightning Invoice QR Code" class="max-w-full h-auto rounded-lg shadow-sm" style="max-width: 200px;" />
              </div>
              <p class="text-sm text-gray-600 text-center">
                このQRコードは1 satのLightning支払い用です。
              </p>
            </div>
            
            <!-- キャンセルボタン -->
            {#if isWaitingForZap}
              <button
                on:click={resetFortuneSlip}
                class="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 mt-4"
              >
                キャンセル
              </button>
            {/if}
          </div>
        {/if}

        
      </div>
      {:else}
      <!-- Fixed button container at the bottom -->
      <div class="fixed bottom-0 left-0 right-0 px-4 pb-18 pt-2 z-10">
        <div class="max-w-md mx-auto">
          <!-- QRコード生成ボタン -->
          <button
            on:click={generateQRCode}
            disabled={isLoading || isWaitingForZap}
            class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium py-4 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg"
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
    </div>
  </div>
</div>
