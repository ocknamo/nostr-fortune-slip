<script lang="ts">
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { onMount } from 'svelte';

// フォームデータ
let lightningAddress = '';
let nostrPrivateKey = '';
let coinosApiToken = '';
let showApiToken = false;
let showPin = false; // PIN表示切り替え
let allowDirectNostrZap = true; // デフォルトtrue
let pinCode = ''; // PIN設定用

// UI状態
let showSuccessMessage = false;
let showDeleteMessage = false;
let errors: Record<string, string> = {};
let isAuthenticated = false; // PIN認証状態

// ローカルストレージからデータを読み込み
onMount(() => {
  if (typeof window !== 'undefined') {
    // PIN認証チェック
    const storedPin = localStorage.getItem('settingsPin') || '1122'; // デフォルトPIN
    const inputPin = prompt('設定画面にアクセスするには4桁のPINを入力してください:');

    if(inputPin === null) {
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
    lightningAddress = localStorage.getItem('lightningAddress') || '';
    nostrPrivateKey = localStorage.getItem('nostrPrivateKey') || '';
    coinosApiToken = localStorage.getItem('coinosApiToken') || '';
    pinCode = storedPin;
    const storedAllowDirectNostrZap = localStorage.getItem('allowDirectNostrZap');
    // デフォルトはtrue、明示的にfalseの場合のみfalse
    allowDirectNostrZap = storedAllowDirectNostrZap === null ? true : storedAllowDirectNostrZap === 'true';
  }
});

// バリデーション関数
function validateForm(): boolean {
  errors = {};

  // ライトニングアドレスのバリデーション
  if (!lightningAddress.trim()) {
    errors.lightningAddress = 'ライトニングアドレスは必須です';
  } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lightningAddress)) {
    errors.lightningAddress = '正しいメールアドレス形式で入力してください（例：user@domain.com）';
  }

  // Nostr秘密鍵のバリデーション
  if (!nostrPrivateKey.trim()) {
    errors.nostrPrivateKey = 'Nostr秘密鍵は必須です';
  } else if (!nostrPrivateKey.startsWith('nsec1')) {
    errors.nostrPrivateKey = 'nsec1で始まる有効な秘密鍵を入力してください';
  }

  // PIN検証
  if (!pinCode.trim()) {
    errors.pinCode = 'PINは必須です';
  } else if (!/^\d{4}$/.test(pinCode)) {
    errors.pinCode = '4桁の数字を入力してください';
  }

  // Coinos API Token（オプショナル）はバリデーションなし

  return Object.keys(errors).length === 0;
}

// 保存処理
function handleSave() {
  if (validateForm()) {
    localStorage.setItem('lightningAddress', lightningAddress);
    localStorage.setItem('nostrPrivateKey', nostrPrivateKey);
    localStorage.setItem('coinosApiToken', coinosApiToken);
    localStorage.setItem('allowDirectNostrZap', allowDirectNostrZap.toString());
    localStorage.setItem('settingsPin', pinCode);

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
    localStorage.removeItem('allowDirectNostrZap');
    localStorage.removeItem('settingsPin');
    // 旧データも削除（後方互換性のため）
    localStorage.removeItem('coinosId');
    localStorage.removeItem('coinosPassword');

    // フォームをクリア
    lightningAddress = '';
    nostrPrivateKey = '';
    coinosApiToken = '';
    allowDirectNostrZap = true; // デフォルト値にリセット
    pinCode = '1128'; // デフォルトPINにリセット

    showDeleteMessage = true;
    setTimeout(() => {
      showDeleteMessage = false;
    }, 3000);
  }
}
</script>

{#if isAuthenticated}
<div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
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

        <!-- ライトニングアドレス -->
        <div>
          <label for="lightning-address" class="block text-sm font-medium text-gray-700 mb-2">
            ライトニングアドレス
          </label>
          <input
            id="lightning-address"
            type="email"
            bind:value={lightningAddress}
            placeholder="user@domain.com"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            class:border-red-500={errors.lightningAddress}
          />
          {#if errors.lightningAddress}
            <p class="mt-1 text-sm text-red-600">{errors.lightningAddress}</p>
          {/if}
        </div>

        <!-- Nostr秘密鍵 -->
        <div>
          <label for="nostr-private-key" class="block text-sm font-medium text-gray-700 mb-2">
            Nostr秘密鍵 (nsec形式)
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

        <!-- Nostrへの直接のzapを許可 -->
        <div class="border-t border-gray-200 pt-6">
          <div class="flex items-start">
            <div class="flex items-center h-5">
              <input
                id="allow-direct-nostr-zap"
                type="checkbox"
                bind:checked={allowDirectNostrZap}
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div class="ml-3 text-sm">
              <label for="allow-direct-nostr-zap" class="font-medium text-gray-700">
                Nostrへの直接のzapを許可
              </label>
              <p class="text-gray-500 mt-1">
                有効にすると、Nostrイベントへの直接zap用のQRコードも表示されます。無効にすると、Lightningインボイスのみが表示され、より厳密なzap検証が行われます。
              </p>
            </div>
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
