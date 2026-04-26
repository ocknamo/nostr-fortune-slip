<script lang="ts">
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { onMount } from 'svelte';

import backgroundImage from '$lib/assets/background.jpg';
import {
  OPENSATS_ADDRESS,
  DEFAULT_FORTUNE_TEXTS,
  validateForm as _validateForm,
  applyDefaultFortuneTexts,
  applyDonateToOpenSats,
} from './settings.js';

// フォームデータ
let lightningAddress = '';
let nostrPrivateKey = '';
let coinosApiToken = '';
let zapAmount = 100; // Zap金額（sats）
let showApiToken = false;
let showPin = false; // PIN表示切り替え
let pinCode = ''; // PIN設定用
let fortuneMin = 1; // くじの最小値
let fortuneMax = 20; // くじの最大値
let fortuneTexts = ''; // くじの内容（カンマ区切り）
let useDefaultFortuneTexts = false; // デフォルトおみくじ内容を使用するフラグ
let savedFortuneTexts = ''; // useDefaultFortuneTexts切り替え前の内容を保持
let hideOmikujiMessage = false; // 紙のおみくじを促すメッセージを非表示にするフラグ
let testMode = false; // テストモード（zapなしでくじを引ける）
let donateToOpenSats = false; // OpenSatsに寄付するフラグ
let savedLightningAddress = ''; // donateToOpenSats切り替え前のアドレスを保持

function handleUseDefaultFortuneTextsChange() {
  const result = applyDefaultFortuneTexts(useDefaultFortuneTexts, fortuneTexts, savedFortuneTexts);
  fortuneTexts = result.fortuneTexts;
  savedFortuneTexts = result.savedFortuneTexts;
}

function handleDonateToOpenSatsChange() {
  const result = applyDonateToOpenSats(donateToOpenSats, lightningAddress, savedLightningAddress);
  lightningAddress = result.lightningAddress;
  savedLightningAddress = result.savedLightningAddress;
}

// UI状態
let showSuccessMessage = false;
let showDeleteMessage = false;
let errors: Record<string, string> = {};
let isAuthenticated = false; // PIN認証状態

// ローカルストレージからデータを読み込み
onMount(() => {
  if (typeof window !== 'undefined') {
    // PIN認証チェック
    const storedPin = localStorage.getItem('settingsPin') || '0000'; // デフォルトPIN
    const inputPin = prompt('設定画面にアクセスするには4桁のPINを入力してください:');

    if (inputPin === null) {
      goto(base || '/');
      return;
    }

    if (inputPin !== storedPin) {
      alert('PINが正しくありません。');
      goto(base || '/');
      return;
    }

    isAuthenticated = true;

    // 設定データを読み込み
    const storedLightningAddress = localStorage.getItem('lightningAddress') || '';
    donateToOpenSats = localStorage.getItem('donateToOpenSats') === 'true';
    if (donateToOpenSats) {
      savedLightningAddress = storedLightningAddress;
      lightningAddress = OPENSATS_ADDRESS;
    } else {
      lightningAddress = storedLightningAddress;
    }
    nostrPrivateKey = localStorage.getItem('nostrPrivateKey') || '';
    coinosApiToken = localStorage.getItem('coinosApiToken') || '';
    const storedZapAmount = localStorage.getItem('zapAmount');
    zapAmount = storedZapAmount ? parseInt(storedZapAmount, 10) : 100; // デフォルト100 sats
    pinCode = storedPin;

    // くじ設定を読み込み
    const storedFortuneMin = localStorage.getItem('fortuneMin');
    fortuneMin = storedFortuneMin ? parseInt(storedFortuneMin, 10) : 1;
    const storedFortuneMax = localStorage.getItem('fortuneMax');
    fortuneMax = storedFortuneMax ? parseInt(storedFortuneMax, 10) : 20;
    const storedFortuneTexts = localStorage.getItem('fortuneTexts') || '';
    useDefaultFortuneTexts = localStorage.getItem('useDefaultFortuneTexts') === 'true';
    hideOmikujiMessage = localStorage.getItem('hideOmikujiMessage') === 'true';
    testMode = localStorage.getItem('testMode') === 'true';
    if (useDefaultFortuneTexts) {
      savedFortuneTexts = storedFortuneTexts;
      fortuneTexts = DEFAULT_FORTUNE_TEXTS;
    } else {
      fortuneTexts = storedFortuneTexts;
    }
  }
});

// バリデーション関数
function validateForm(): boolean {
  errors = _validateForm({ lightningAddress, nostrPrivateKey, pinCode, zapAmount, fortuneMin, fortuneMax }, testMode);
  return Object.keys(errors).length === 0;
}

// 保存処理
function handleSave() {
  if (validateForm()) {
    localStorage.setItem('donateToOpenSats', donateToOpenSats.toString());
    localStorage.setItem('lightningAddress', donateToOpenSats ? savedLightningAddress : lightningAddress);
    localStorage.setItem('nostrPrivateKey', nostrPrivateKey);
    localStorage.setItem('coinosApiToken', coinosApiToken);
    localStorage.setItem('zapAmount', zapAmount.toString());
    localStorage.setItem('settingsPin', pinCode);
    localStorage.setItem('fortuneMin', fortuneMin.toString());
    localStorage.setItem('fortuneMax', fortuneMax.toString());
    localStorage.setItem('useDefaultFortuneTexts', useDefaultFortuneTexts.toString());
    localStorage.setItem('fortuneTexts', useDefaultFortuneTexts ? savedFortuneTexts : fortuneTexts);
    localStorage.setItem('hideOmikujiMessage', hideOmikujiMessage.toString());
    localStorage.setItem('testMode', testMode.toString());

    showSuccessMessage = true;
    setTimeout(() => {
      showSuccessMessage = false;
    }, 3000);
  }
}

// メイン画面に戻る
function goBack() {
  goto(base || '/');
}

// API Token表示切り替え
function toggleApiTokenVisibility() {
  showApiToken = !showApiToken;
}

// PIN表示切り替え
function togglePinVisibility() {
  showPin = !showPin;
}

// データ削除処理
function handleClearData() {
  if (confirm('保存されているすべての設定データを削除しますか？この操作は取り消せません。')) {
    localStorage.removeItem('lightningAddress');
    localStorage.removeItem('nostrPrivateKey');
    localStorage.removeItem('coinosApiToken');
    localStorage.removeItem('zapAmount');
    localStorage.removeItem('settingsPin');
    localStorage.removeItem('fortuneMin');
    localStorage.removeItem('fortuneMax');
    localStorage.removeItem('fortuneTexts');
    localStorage.removeItem('useDefaultFortuneTexts');
    localStorage.removeItem('hideOmikujiMessage');
    localStorage.removeItem('testMode');
    localStorage.removeItem('donateToOpenSats');
    // 旧データも削除（後方互換性のため）
    localStorage.removeItem('coinosId');
    localStorage.removeItem('coinosPassword');

    // フォームをクリア
    lightningAddress = '';
    nostrPrivateKey = '';
    coinosApiToken = '';
    zapAmount = 100; // デフォルト値にリセット
    pinCode = '0000'; // デフォルトPINにリセット
    fortuneMin = 1;
    fortuneMax = 20;
    fortuneTexts = '';
    useDefaultFortuneTexts = false;
    hideOmikujiMessage = false;
    testMode = false;
    donateToOpenSats = false;

    showDeleteMessage = true;
    setTimeout(() => {
      showDeleteMessage = false;
    }, 3000);
  }
}
</script>

{#if isAuthenticated}
<div class="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-cover bg-center" style="background-image: url('{backgroundImage}');">
  <div class="max-w-md mx-auto">
    <div class="bg-white shadow rounded-lg p-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">設定</h1>
        <button
          on:click={goBack}
          class="text-gray-500 hover:text-gray-700 transition-colors"
          title="戻る"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 成功メッセージ -->
      {#if showSuccessMessage}
        <div class="mb-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded-md">
          設定が正常に保存されました。
        </div>
      {/if}

      <!-- 削除完了メッセージ -->
      {#if showDeleteMessage}
        <div class="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md">
          すべての設定データが削除されました。
        </div>
      {/if}

      <!-- セキュリティ警告 -->
      <div class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-yellow-800">セキュリティについて</h3>
            <div class="mt-2 text-sm text-yellow-700">
              <p>設定データはブラウザのLocalStorageに保存されます。他の人がこのデバイスにアクセスできる場合や、悪意のあるスクリプトがある場合、データが読み取られる可能性があります。機密性の低い環境では使用を避けてください。</p>
              <p>また利用後はデータを削除してください。</p>
            </div>
          </div>
        </div>
      </div>

      <form on:submit|preventDefault={handleSave} class="space-y-6">
        <!-- PIN設定 -->
        <div>
          <label for="pin-code" class="block text-sm font-medium text-gray-700 mb-2">
            PIN（4桁の数字）
          </label>
          <div class="relative">
            <input
              id="pin-code"
              type={showPin ? 'text' : 'password'}
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="4"
              bind:value={pinCode}
              placeholder="1122"
              class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              class:border-red-500={errors.pinCode}
            />
            <button
              type="button"
              on:click={togglePinVisibility}
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              {#if showPin}
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              {:else}
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              {/if}
            </button>
          </div>
          {#if errors.pinCode}
            <p class="mt-1 text-sm text-red-600">{errors.pinCode}</p>
          {:else}
            <p class="mt-1 text-sm text-gray-500">設定画面へのアクセスを保護するための4桁の数字</p>
          {/if}
        </div>

        <!-- OpenSatsに寄付する -->
        <div class="flex items-center">
          <input
            id="donate-opensats"
            type="checkbox"
            bind:checked={donateToOpenSats}
            on:change={handleDonateToOpenSatsChange}
            class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label for="donate-opensats" class="ml-2 block text-sm font-medium text-gray-700">
            OpenSatsに寄付する
          </label>
        </div>

        <!-- ライトニングアドレス -->
        <div>
          <label for="lightning-address" class="block text-sm font-medium text-gray-700 mb-2">
            ライトニングアドレス
            {#if testMode}<span class="ml-1 text-xs font-normal text-gray-400">（テストモード時は任意）</span>{/if}
          </label>
          <input
            id="lightning-address"
            type="email"
            bind:value={lightningAddress}
            placeholder="user@domain.com"
            disabled={donateToOpenSats}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            class:border-red-500={errors.lightningAddress}
            class:bg-gray-100={donateToOpenSats}
            class:cursor-not-allowed={donateToOpenSats}
          />
          {#if errors.lightningAddress}
            <p class="mt-1 text-sm text-red-600">{errors.lightningAddress}</p>
          {/if}
        </div>

        <!-- Nostr秘密鍵 -->
        <div>
          <label for="nostr-private-key" class="block text-sm font-medium text-gray-700 mb-2">
            Nostr秘密鍵 (nsec形式)
            {#if testMode}<span class="ml-1 text-xs font-normal text-gray-400">（テストモード時は任意）</span>{/if}
          </label>
          <input
            id="nostr-private-key"
            type="password"
            bind:value={nostrPrivateKey}
            placeholder="nsec1..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            class:border-red-500={errors.nostrPrivateKey}
          />
          {#if errors.nostrPrivateKey}
            <p class="mt-1 text-sm text-red-600">{errors.nostrPrivateKey}</p>
          {/if}
        </div>

        <!-- Coinos API Token（オプショナル） -->
        <div>
          <label for="coinos-api-token" class="block text-sm font-medium text-gray-700 mb-2">
            Coinos Read-Only API Token（オプショナル）
          </label>
          <div class="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">重要な注意事項</h3>
                <div class="mt-2 text-sm text-red-700">
                  <ul class="list-disc pl-5 space-y-1">
                    <li><strong>Read-Only（読み取り専用）トークンのみを入力してください</strong></li>
                    <li>書き込み権限のあるトークンは絶対に使用しないでください</li>
                    <li>トークンは安全に管理し、他人と共有しないでください</li>
                    <li>このフィールドが空欄の場合支払いの厳密な検証がスキップされます</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div class="relative">
            <input
              id="coinos-api-token"
              type={showApiToken ? 'text' : 'password'}
              bind:value={coinosApiToken}
              placeholder="Read-Only API Tokenを入力（オプション）"
              class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              class:border-red-500={errors.coinosApiToken}
            />
            <button
              type="button"
              on:click={toggleApiTokenVisibility}
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              {#if showApiToken}
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              {:else}
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              {/if}
            </button>
          </div>
          {#if errors.coinosApiToken}
            <p class="mt-1 text-sm text-red-600">{errors.coinosApiToken}</p>
          {/if}
        </div>

        <!-- Zap金額 -->
        <div>
          <label for="zap-amount" class="block text-sm font-medium text-gray-700 mb-2">
            Zap金額（sats）
          </label>
          <input
            id="zap-amount"
            type="number"
            min="1"
            max="1000"
            step="1"
            bind:value={zapAmount}
            placeholder="100"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            class:border-red-500={errors.zapAmount}
          />
          {#if errors.zapAmount}
            <p class="mt-1 text-sm text-red-600">{errors.zapAmount}</p>
          {:else}
            <p class="mt-1 text-sm text-gray-500">おみくじを引くために必要なZap金額（1〜1000 sats）</p>
          {/if}
        </div>

        <!-- くじの範囲設定 -->
        <div class="border-t pt-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">おみくじ設定</h2>
          
          <div class="grid grid-cols-2 gap-4 mb-4">
            <!-- 最小値 -->
            <div>
              <label for="fortune-min" class="block text-sm font-medium text-gray-700 mb-2">
                最小値
              </label>
              <input
                id="fortune-min"
                type="number"
                min="1"
                step="1"
                bind:value={fortuneMin}
                placeholder="1"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                class:border-red-500={errors.fortuneMin}
              />
              {#if errors.fortuneMin}
                <p class="mt-1 text-sm text-red-600">{errors.fortuneMin}</p>
              {/if}
            </div>

            <!-- 最大値 -->
            <div>
              <label for="fortune-max" class="block text-sm font-medium text-gray-700 mb-2">
                最大値
              </label>
              <input
                id="fortune-max"
                type="number"
                min="1"
                step="1"
                bind:value={fortuneMax}
                placeholder="20"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                class:border-red-500={errors.fortuneMax}
              />
              {#if errors.fortuneMax}
                <p class="mt-1 text-sm text-red-600">{errors.fortuneMax}</p>
              {/if}
            </div>
          </div>
          <p class="text-sm text-gray-500 mb-4">くじの数字の範囲を設定します（例：1〜20）</p>

          <!-- おみくじ内容 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label for="fortune-texts" class="block text-sm font-medium text-gray-700">
                おみくじの内容（オプション）
              </label>
              <div class="flex items-center">
                <input
                  id="use-default-fortune-texts"
                  type="checkbox"
                  bind:checked={useDefaultFortuneTexts}
                  on:change={handleUseDefaultFortuneTextsChange}
                  class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label for="use-default-fortune-texts" class="ml-2 text-sm text-gray-700">
                  デフォルト設定
                </label>
              </div>
            </div>
            <textarea
              id="fortune-texts"
              bind:value={fortuneTexts}
              placeholder="大吉,中吉,小吉,吉,末吉,凶,大凶"
              rows="3"
              disabled={useDefaultFortuneTexts}
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              class:bg-gray-100={useDefaultFortuneTexts}
              class:cursor-not-allowed={useDefaultFortuneTexts}
            ></textarea>
            <p class="mt-1 text-sm text-gray-500">
              カンマ区切りでおみくじの内容を入力します。空欄の場合は数字のみ表示されます。<br/>
              数字が配列の長さを超える場合は、循環して表示されます。
            </p>
          </div>

          <!-- おみくじメッセージ非表示設定 -->
          <div class="flex items-center mt-4">
            <input
              id="hide-omikuji-message"
              type="checkbox"
              bind:checked={hideOmikujiMessage}
              class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label for="hide-omikuji-message" class="ml-2 text-sm text-gray-700">
              紙のおみくじを促すメッセージを表示しない
            </label>
          </div>

          <!-- テストモード -->
          <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div class="flex items-center">
              <input
                id="test-mode"
                type="checkbox"
                bind:checked={testMode}
                class="h-4 w-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
              />
              <label for="test-mode" class="ml-2 text-sm font-medium text-yellow-800">
                テストモード（外部通信なしでくじを引ける）
              </label>
            </div>
            {#if testMode}
              <p class="mt-2 text-xs text-yellow-700">
                ライトニングアドレス・Nostr秘密鍵の設定なしで動作します。Zapや外部APIへの通信は行いません。
              </p>
            {/if}
          </div>
        </div>

        <!-- 保存ボタン -->
        <div class="pt-4">
          <button
            type="submit"
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            保存
          </button>
        </div>

        <!-- データ削除ボタン -->
        <div class="pt-3">
          <button
            type="button"
            on:click={handleClearData}
            class="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            すべてのデータを削除
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
{/if}
