<script lang="ts">
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { onMount, onDestroy } from 'svelte';
import settingsIcon from '$lib/assets/settings.svg';
import OmikujiAnimation from '$lib/components/OmikujiAnimation.svelte';
import LightningReveal from '$lib/components/LightningReveal.svelte';
import {
  decodeNsec,
  decodeNpub,
  fetchMetadataFromRelays,
  createTextEvent,
  createTextEventNip07,
  createZapRequest,
  createZapRequestNip07,
  createMetadataEvent,
  getZapInvoiceFromEndpoint,
  subscribeToZapReceipts,
  isNip07Available,
  type ZapReceiptSubscription,
  type NostrEvent,
  generateLuckyNumber,
  generateRandomBase64,
  getFortuneText,
  shouldShowConfetti,
} from '$lib/nostr';
import { generateLightningQRCode } from '$lib/qrcode';
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
let isLightningPlaying = false; // 稲妻演出中フラグ

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
let confettiTexts: string[] = []; // 紙吹雪を表示するテキスト配列
let fortuneTextForNumber: string | null = null; // 生成された数字に対応するテキスト
let showConfettiForResult = true; // 結果に紙吹雪を表示するか
let hideOmikujiMessage = false; // 紙のおみくじを促すメッセージを非表示にするフラグ
let testMode = false; // zapせずにくじを引けるテストモード
let zapRecipientNpub = ''; // Zap先の公開鍵（npub形式、任意）
let nip07LoggedIn = false; // NIP-07ログイン状態

// 設定データを読み込み
onMount(() => {
  if (typeof window !== 'undefined') {
    const storedLightningAddress = localStorage.getItem('lightningAddress') || '';
    const donateToOpenSats = localStorage.getItem('donateToOpenSats') === 'true';
    lightningAddress = donateToOpenSats ? 'opensats@npub.cash' : storedLightningAddress;
    nostrPrivateKey = localStorage.getItem('nostrPrivateKey') || '';
    coinosApiToken = localStorage.getItem('coinosApiToken') || '';
    const storedZapAmount = localStorage.getItem('zapAmount');
    zapAmount = storedZapAmount ? parseInt(storedZapAmount, 10) : 100; // デフォルト100 sats

    // くじ設定を読み込み
    const storedFortuneMin = localStorage.getItem('fortuneMin');
    fortuneMin = storedFortuneMin ? parseInt(storedFortuneMin, 10) : 1;
    const storedFortuneMax = localStorage.getItem('fortuneMax');
    fortuneMax = storedFortuneMax ? parseInt(storedFortuneMax, 10) : 20;
    const useDefaultFortuneTexts = localStorage.getItem('useDefaultFortuneTexts') === 'true';
    const confettiSrc = useDefaultFortuneTexts
      ? '大吉,中吉,小吉,吉,末吉'
      : localStorage.getItem('confettiFortuneTexts') || '大吉,中吉,小吉,吉,末吉';
    const noConfettiSrc = useDefaultFortuneTexts
      ? '凶,大凶'
      : localStorage.getItem('noConfettiFortuneTexts') || '凶,大凶';
    confettiTexts = confettiSrc
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t);
    const noConfettiTexts = noConfettiSrc
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t);
    fortuneTexts = [...confettiTexts, ...noConfettiTexts];
    hideOmikujiMessage = localStorage.getItem('hideOmikujiMessage') === 'true';
    testMode = localStorage.getItem('testMode') === 'true';
    zapRecipientNpub = localStorage.getItem('zapRecipientNpub') || '';
    nip07LoggedIn = !!localStorage.getItem('nip07Pubkey') && isNip07Available();
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

// 支払い検知時の共通処理
function handlePaymentDetected() {
  if (zapDetected) return;

  qrCodeDataUrl = '';
  randomNumber = generateLuckyNumber(fortuneMin, fortuneMax);
  fortuneTextForNumber = getFortuneText(randomNumber, fortuneTexts);
  showConfettiForResult = shouldShowConfetti(fortuneTextForNumber, confettiTexts);
  // isAnimationPlayingを先にセット（zapDetected=trueだけだと結果画面が先に表示されるため）
  isAnimationPlaying = true;
  zapDetected = true;
  stopZapMonitoring();
}

async function onZapDetected(zapReceipt: NostrEvent) {
  console.log('[Fortune Slip] Zap detected!', zapReceipt);
  handlePaymentDetected();
}

function onZapError(error: string) {
  console.error('[Fortune Slip] Zap verification error:', error);
  errorMessage = `Zap検証エラー: ${error}`;
  qrCodeDataUrl = '';
  stopZapMonitoring();
}

async function onCoinosPaymentDetected(payment: unknown) {
  console.log('[Fortune Slip] Coinos payment detected!', payment);
  handlePaymentDetected();
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

  // テストモード: zapをスキップして直接くじを引く
  if (testMode) {
    randomNumber = generateLuckyNumber(fortuneMin, fortuneMax);
    fortuneTextForNumber = getFortuneText(randomNumber, fortuneTexts);
    showConfettiForResult = shouldShowConfetti(fortuneTextForNumber, confettiTexts);
    isAnimationPlaying = true;
    return;
  }

  // 設定が不完全な場合は設定画面に誘導
  if (!nip07LoggedIn && !zapRecipientNpub && (!lightningAddress || !nostrPrivateKey)) {
    errorMessage =
      '設定が不完全です。NIP-07ログイン、Zap先の公開鍵、またはライトニングアドレスとNostr秘密鍵を設定してください。';
    return;
  }

  if (!nip07LoggedIn && !nostrPrivateKey) {
    errorMessage = '設定が不完全です。NIP-07でログインするか、Nostr秘密鍵を設定してください。';
    return;
  }

  isLoading = true;

  try {
    // 1. イベント作成（NIP-07 or 秘密鍵）
    let textEvent: NostrEvent;
    if (nip07LoggedIn) {
      textEvent = await createTextEventNip07('');
    } else {
      const privateKeyBytes = decodeNsec(nostrPrivateKey);
      textEvent = createTextEvent(privateKeyBytes, '');
    }

    // 3. Zap先のmetadata eventを取得・作成
    let metadataEvent: NostrEvent;

    if (zapRecipientNpub.trim()) {
      // npub設定がある場合: リレーからkind:0を取得してlud16を使う
      const recipientPubkeyHex = decodeNpub(zapRecipientNpub.trim());
      console.log('[Fortune Slip] Fetching metadata for npub:', zapRecipientNpub);
      const metadata = await fetchMetadataFromRelays(recipientPubkeyHex);
      if (!metadata || !metadata.lud16) {
        errorMessage = 'Zap先のメタデータからlud16（ライトニングアドレス）が見つかりませんでした。';
        isLoading = false;
        return;
      }
      console.log('[Fortune Slip] Found lud16:', metadata.lud16);
      metadataEvent = createMetadataEvent(recipientPubkeyHex, metadata.lud16);
    } else {
      // 従来の方式: 自分のライトニングアドレスを使う
      const recipientPubkey = textEvent.pubkey;
      metadataEvent = createMetadataEvent(recipientPubkey, lightningAddress);
    }

    // 4. zapUrl取得
    const zapUrl = await nip57.getZapEndpoint(metadataEvent);
    if (zapUrl === null) {
      errorMessage = 'Zapエンドポイントが見つかりません。';
      throw new Error('Zapエンドポイントが見つかりません。');
    }

    console.debug('[zap endpoint]', zapUrl);

    // 5. ランダムな8byte値を生成
    const paymentId = generateRandomBase64();
    console.log('[Fortune Slip] Generated payment ID:', paymentId);

    // 1 sat = 1000 millisats
    const satsAmount = zapAmount * 1000;

    // 6. Zapリクエストを作成（ランダム値をcommentに埋め込む）
    // zapRecipientNpub が設定されている場合は ProfileZap（recipient公開鍵宛）
    const recipientPubkey = zapRecipientNpub.trim() ? decodeNpub(zapRecipientNpub.trim()) : undefined;
    let zapRequest: NostrEvent;
    if (nip07LoggedIn) {
      zapRequest = await createZapRequestNip07(textEvent, satsAmount, paymentId, recipientPubkey);
    } else {
      const privateKeyBytes = decodeNsec(nostrPrivateKey);
      zapRequest = createZapRequest(privateKeyBytes, textEvent, satsAmount, paymentId, recipientPubkey);
    }

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
      recipientPubkey, // ProfileZap時のrecipient公開鍵
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

function handleAnimationComplete() {
  // アニメーション完了後、常に稲妻演出を開始
  isAnimationPlaying = false;
  isLightningPlaying = true;
}

function handleLightningComplete() {
  isLightningPlaying = false;
  zapDetected = true;
  startAutoReset();
}

function startAutoReset() {
  // 20秒後に自動リセット
  autoResetTimerId = window.setTimeout(() => {
    console.log('[Fortune Slip] Auto-resetting after 20 seconds');
    resetFortuneSlip();
  }, 20000);
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

      <!-- 稲妻演出 -->
      {#if isLightningPlaying}
        <LightningReveal text={fortuneTextForNumber ?? ''} showConfetti={showConfettiForResult} onComplete={handleLightningComplete} />
      {/if}

      <!-- Zap検知後のランダム数字表示 -->
      {#if zapDetected && !isAnimationPlaying && !isLightningPlaying}
      <div class="mb-6 bg-white pl-4 pr-4 w-50 animate-fade-in">
        <div class="flex flex-col justify-center mb-4 border-b pb-4">
          {#if !hideOmikujiMessage}
          <div class="h-36 flex items-center justify-center">
            <span class="font-bold text-rose-500 text-7xl mb-4">{randomNumber}</span>
          </div>
          {/if}
          {#if fortuneTextForNumber}
            <div class="text-center {hideOmikujiMessage ? 'h-36 flex items-center justify-center' : ''}">
              <p class="{hideOmikujiMessage ? 'text-6xl font-extrabold text-rose-500' : 'text-2xl font-semibold text-gray-800'}">{fortuneTextForNumber}</p>
            </div>
          {/if}
        </div>
        <h3 class="text-2xl font-bold">All done!</h3>
        {#if !hideOmikujiMessage}
        <p class="text-sm text-gray-600 text-center mb-4 mt-4 font-bold">
          Please take your<br/> numbered omikuji.
        </p>
        {/if}
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

<style>
  @keyframes fade-in {
    0%   { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.6s ease-out forwards;
  }
</style>
