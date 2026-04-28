<script lang="ts">
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { onMount, onDestroy } from 'svelte';
import settingsIcon from '$lib/assets/settings.svg';
import OmikujiAnimation from '$lib/components/OmikujiAnimation.svelte';
import LightningReveal from '$lib/components/LightningReveal.svelte';
import {
  decodeNsec,
  createTextEvent,
  createZapRequest,
  createMetadataEvent,
  getZapInvoiceFromEndpoint,
  subscribeToZapReceipts,
  type ZapReceiptSubscription,
  type NostrEvent,
  generateLuckyNumber,
  generateRandomBase64,
  getFortuneText,
} from '$lib/nostr';
import { generateLightningQRCode, generateQRCode as buildPlainQRCode } from '$lib/qrcode';
import { nip57 } from 'nostr-tools';
import { startCoinosPolling, type CoinosPollingSubscription } from '$lib/coinos';

import backgroundImage from '$lib/assets/background.jpg';

// UI状態
let isLoading = false;
let qrCodeDataUrl = '';
let errorMessage = '';
let isWaitingForZap = false;
let zapDetected = false;
let randomNumber: number | null = null;
let isAnimationPlaying = false;

// Zap検知用の状態
let zapSubscription: ZapReceiptSubscription | null = null;
let coinosPollingSubscription: CoinosPollingSubscription | null = null;
let currentZapRequest: NostrEvent | null = null;
let currentTargetEventId: string | null = null;
let paymentId: string | null = null;

// 自動リセット用タイマー
let autoResetTimerId: number | null = null;

// 設定データ
let lightningAddress = '';
let nostrPrivateKey = '';
let coinosApiToken = '';
let zapAmount = 100; // Zap金額（sats）デフォルト値
let fortuneMin = 1; // くじの最小値
let fortuneMax = 20; // くじの最大値
let fortuneTexts: string[] = []; // くじの内容配列
let fortuneTextForNumber: string | null = null; // 生成された数字に対応するテキスト
let hideOmikujiMessage = false; // 紙のおみくじを促すメッセージ・番号を隠す
let nostrQrCodeDataUrl = ''; // Nostr 紹介サイトへの QR コード
let testMode = false; // zapを介さずに直接くじを引くテストモード
let animationStyle: 'normal' | 'flashy' = 'normal'; // 演出スタイル
let isLightningPlaying = false; // 派手モード時の稲妻演出再生中フラグ

// 設定データを読み込み
onMount(() => {
  if (typeof window !== 'undefined') {
    lightningAddress = localStorage.getItem('lightningAddress') || '';
    nostrPrivateKey = localStorage.getItem('nostrPrivateKey') || '';
    coinosApiToken = localStorage.getItem('coinosApiToken') || '';
    const storedZapAmount = localStorage.getItem('zapAmount');
    zapAmount = storedZapAmount ? parseInt(storedZapAmount, 10) : 100; // デフォルト100 sats

    // くじ設定を読み込み
    const storedFortuneMin = localStorage.getItem('fortuneMin');
    fortuneMin = storedFortuneMin ? parseInt(storedFortuneMin, 10) : 1;
    const storedFortuneMax = localStorage.getItem('fortuneMax');
    fortuneMax = storedFortuneMax ? parseInt(storedFortuneMax, 10) : 20;
    const storedFortuneTexts = localStorage.getItem('fortuneTexts');
    fortuneTexts = storedFortuneTexts
      ? storedFortuneTexts
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t)
      : [];
    hideOmikujiMessage = localStorage.getItem('hideOmikujiMessage') === 'true';
    testMode = localStorage.getItem('testMode') === 'true';
    const storedAnimationStyle = localStorage.getItem('animationStyle');
    animationStyle = storedAnimationStyle === 'flashy' ? 'flashy' : 'normal';

    buildPlainQRCode('https://welcome.nostr-jp.org/')
      .then((url) => {
        nostrQrCodeDataUrl = url;
      })
      .catch((err) => {
        console.warn('[Fortune Slip] Failed to generate Nostr intro QR:', err);
      });
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
  if (autoResetTimerId !== null) {
    clearTimeout(autoResetTimerId);
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

  // 早期にフラグを立てて二重実行を防ぐ
  zapDetected = true;

  console.log('[Fortune Slip] Zap detected!', zapReceipt);

  // coinosへのポーリングを停止
  coinosPollingSubscription?.stop();

  // QRコードを非表示
  qrCodeDataUrl = '';
  // 番号生成（設定された範囲を使用）
  randomNumber = generateLuckyNumber(fortuneMin, fortuneMax);
  // おみくじテキストを取得
  fortuneTextForNumber = getFortuneText(randomNumber, fortuneTexts);
  // アニメーション表示を開始
  isAnimationPlaying = true;
  stopZapMonitoring();
}

function onZapError(error: string) {
  console.error('[Fortune Slip] Zap verification error:', error);

  // Zapエラーが発生した場合
  errorMessage = `Zap検証エラー: ${error}`;

  // QRコードを非表示
  qrCodeDataUrl = '';
  stopZapMonitoring();
}

async function onCoinosPaymentDetected(payment: any) {
  if (zapDetected) {
    return;
  }

  // 早期にフラグを立てて二重実行を防ぐ
  zapDetected = true;

  console.log('[Fortune Slip] Coinos payment detected!', payment);

  // QRコードを非表示
  qrCodeDataUrl = '';
  // 番号生成（設定された範囲を使用）
  randomNumber = generateLuckyNumber(fortuneMin, fortuneMax);
  // おみくじテキストを取得
  fortuneTextForNumber = getFortuneText(randomNumber, fortuneTexts);
  // アニメーション表示を開始
  isAnimationPlaying = true;
  stopZapMonitoring();
}

function resetFortuneSlip() {
  // 自動リセットタイマーをクリア
  if (autoResetTimerId !== null) {
    clearTimeout(autoResetTimerId);
    autoResetTimerId = null;
  }

  qrCodeDataUrl = '';
  zapDetected = false;
  randomNumber = null;
  isWaitingForZap = false;
  isAnimationPlaying = false;
  isLightningPlaying = false;
  stopZapMonitoring();
  clearMessages();
}

async function generateQRCode() {
  clearMessages();
  resetFortuneSlip();

  // テストモード: zapとQR表示をスキップして即座に当選フローへ
  if (testMode) {
    randomNumber = generateLuckyNumber(fortuneMin, fortuneMax);
    fortuneTextForNumber = getFortuneText(randomNumber, fortuneTexts);
    isAnimationPlaying = true;
    return;
  }

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
    const textEvent = createTextEvent(privateKeyBytes, '');

    // 3. recipientのmetadata eventを作成（簡易版）
    // 実際のアプリではリレーから取得するが、ここでは設定値から作成
    const recipientPubkey = textEvent.pubkey; // 自分自身にzapする場合
    const metadataEvent = createMetadataEvent(recipientPubkey, lightningAddress);

    // 4. zapUrl取得
    const zapUrl = await nip57.getZapEndpoint(metadataEvent);
    if (zapUrl === null) {
      errorMessage = `Zapエンドポイントが見つかりません。ライトニングアドレス: ${lightningAddress}`;
      throw new Error(`Zapエンドポイントが見つかりません。ライトニングアドレス: ${lightningAddress}`);
    }

    console.debug('[zap endpoint]', zapUrl);

    // 5. ランダムな8byte値を生成
    const paymentId = generateRandomBase64();
    console.log('[Fortune Slip] Generated payment ID:', paymentId);

    // 1 sat = 1000 millisats
    const satsAmount = zapAmount * 1000;

    // 6. Zapリクエストを作成（ランダム値をcommentに埋め込む）
    const zapRequest = createZapRequest(
      privateKeyBytes,
      textEvent, // 完全なeventオブジェクト
      satsAmount,
      paymentId, // 識別用IDを埋め込む
    );

    // 6. Zapインボイスを取得
    const invoice = await getZapInvoiceFromEndpoint(zapUrl, satsAmount, zapRequest);

    // 7. QRコードを生成
    qrCodeDataUrl = await generateLightningQRCode(invoice.pr);

    // 9. Zap検知を開始
    currentZapRequest = zapRequest;
    currentTargetEventId = textEvent.id;

    zapSubscription = subscribeToZapReceipts(
      textEvent.id,
      zapRequest,
      onZapDetected,
      300000, // 5分タイムアウト
      coinosApiToken, // Coinos API Token（オプション）
      onZapError, // エラーコールバック
    );

    // 10. Coinos APIポーリングを開始（トークンが設定されている場合のフォールバック）
    if (coinosApiToken.trim()) {
      console.log('[Fortune Slip] Starting Coinos polling as fallback');
      coinosPollingSubscription = startCoinosPolling(
        paymentId,
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
  return !qrCodeDataUrl && !isWaitingForZap && !zapDetected && !isAnimationPlaying && !isLightningPlaying;
}

function startAutoReset() {
  // 5分後に自動リセット（次の利用者が来るまでに結果を片付けつつ、
  // 結果を読む時間を十分に確保する）
  autoResetTimerId = window.setTimeout(() => {
    console.log('[Fortune Slip] Auto-resetting after 5 minutes');
    resetFortuneSlip();
  }, 300000);
}

function handleAnimationComplete() {
  // 通常おみくじアニメーション完了後の遷移先を演出スタイルで分岐
  isAnimationPlaying = false;

  if (animationStyle === 'flashy') {
    // 派手モード: 続けて稲妻演出を再生
    isLightningPlaying = true;
    return;
  }

  zapDetected = true;
  startAutoReset();
}

function handleLightningComplete() {
  isLightningPlaying = false;
  zapDetected = true;
  startAutoReset();
}
</script>

<div class="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-cover bg-center relative flex flex-col" style="background-image: url('{backgroundImage}');">
  <!-- GitHub link - positioned at the bottom left -->
  <a 
    href="https://github.com/ocknamo/nostr-fortune-slip" 
    target="_blank" 
    rel="noopener noreferrer" 
    class="absolute bottom-3 left-3 text-s text-white/70 hover:text-white/90 transition-colors z-100"
    aria-label="GitHub repository"
  >
    GitHub
  </a>
  <!-- 設定アイコン - 右上に配置 -->
  <button 
    on:click={navigateToSettings}
    class="absolute top-14 right-4 w-12 h-12 bg-opacity-70 rounded-4xl flex items-center justify-center hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 z-10"
    aria-label="設定画面へ"
  >
    <img src={settingsIcon} alt="設定" class="w-10 h-10" />
  </button>

  <div class="max-w-md mx-auto grow flex items-center">
    <div class="text-center">
      {#if !showSubmit() && !zapDetected && !isAnimationPlaying && !isLightningPlaying}
      <div class="bg-white shadow rounded-lg p-6 min-w-100">
        <!-- エラーメッセージ -->
        {#if errorMessage}
          <div class="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md">
            {errorMessage}
          </div>
        {/if}

        <!-- Zap待機中のステータス -->
        {#if isWaitingForZap}
          <div class="rounded-md p-3 mb-2">
            <p class="text-m mt-2">
              Scan the QR code and send {zapAmount} sats
            </p>
          </div>
        {/if}

        {#if qrCodeDataUrl}
          <div class="mb-6">
            <!-- Lightning Invoice QR Code -->
            <div class="mb-4">
              <div class="flex justify-center mb-2">
                <img src={qrCodeDataUrl} alt="Lightning Invoice QR Code" class="max-w-full h-auto rounded-lg shadow-sm" style="max-width: 200px;" />
              </div>
            </div>
            
            <!-- キャンセルボタン -->
            {#if isWaitingForZap}
              <button
                on:click={resetFortuneSlip}
                class="font-medium py-2 px-4 transition-colors mt-4 border rounded-4xl"
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
            class="h-16 w-60 bg-red-900 disabled:bg-amber-600 disabled:cursor-not-allowed text-white text-xl font-medium py-4 px-4 outline-1 pl-6 pr-6 rounded-4xl"
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
              Pray for {zapAmount} sats
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

      <!-- 派手モード時の稲妻演出 -->
      {#if isLightningPlaying}
        <LightningReveal
          text={fortuneTextForNumber ?? (randomNumber !== null ? String(randomNumber) : '')}
          onComplete={handleLightningComplete}
        />
      {/if}

      <!-- Zap検知後のランダム数字表示 -->
      {#if zapDetected && !isAnimationPlaying}
      <div class="mb-6 bg-white pl-4 pr-4 {hideOmikujiMessage ? 'w-80' : 'w-50'}">
        <div class="flex flex-col justify-center mb-4 border-b pb-4">
          {#if !hideOmikujiMessage}
            <div class="h-36 flex items-center justify-center">
              <span class="font-bold text-rose-500 text-7xl mb-4">{randomNumber}</span>
            </div>
          {/if}
          {#if fortuneTextForNumber}
            <div class="text-center {hideOmikujiMessage ? 'py-8' : ''}">
              <p class={hideOmikujiMessage
                ? 'text-6xl font-extrabold text-rose-600 tracking-widest'
                : 'text-2xl font-semibold text-gray-800'}>
                {fortuneTextForNumber}
              </p>
            </div>
          {/if}
        </div>
        <h3 class="text-2xl font-bold">All done!</h3>
        {#if !hideOmikujiMessage}
          <p class="text-sm text-gray-600 text-center mb-4 mt-4 font-bold">
            Please take your<br/> numbered omikuji.
          </p>
        {/if}
        <!-- Nostr 紹介 QR コード -->
        {#if nostrQrCodeDataUrl}
          <div class="mt-4 text-center">
            <p class="text-xs text-gray-600 mb-2">Nostr ってなに？</p>
            <img
              src={nostrQrCodeDataUrl}
              alt="Nostr 紹介 (welcome.nostr-jp.org)"
              class="w-32 h-32 mx-auto rounded"
            />
            <p class="text-[10px] text-gray-500 mt-1 break-all">
              welcome.nostr-jp.org
            </p>
          </div>
        {/if}

        <!-- もう一度ボタン -->
        <button
          on:click={resetFortuneSlip}
          class="w-full py-2 px-4 mb-18 mt-4 border text-sm rounded-2xl"
        >
          Try another omikuji
        </button>
      </div>
    {/if}
    </div>
  </div>
</div>
