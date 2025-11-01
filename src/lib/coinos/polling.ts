import { getCoinosPayments } from './api.js';

/**
 * Coinosポーリングのサブスクリプション
 */
export interface CoinosPollingSubscription {
  stop: () => void;
}

/**
 * Coinos APIをポーリングして、指定されたランダム値を含む支払いを検知する
 * @param randomValue 検知対象のランダム値（base64エンコード済み）
 * @param coinosApiToken Coinos APIトークン
 * @param onPaymentDetected 支払い検知時のコールバック
 * @param intervalMs ポーリング間隔（ミリ秒）
 * @param timeoutMs タイムアウト時間（ミリ秒）
 * @returns CoinosPollingSubscription
 */
export function startCoinosPolling(
  randomValue: string,
  coinosApiToken: string,
  onPaymentDetected: (payment: any) => void,
  intervalMs: number = 10000, // 10秒間隔
  timeoutMs: number = 300000, // 5分
): CoinosPollingSubscription {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const startTime = Date.now();

  console.log('[Coinos Polling] Starting polling for random value:', randomValue);

  const poll = async () => {
    if (stopped) {
      return;
    }

    try {
      // 支払い履歴を取得
      const paymentsData = await getCoinosPayments(coinosApiToken, 100);

      // 時間窓を設定（ポーリング開始時刻の前後10分）
      const windowStart = startTime - 600000; // 10分前
      const windowEnd = Date.now() + 60000; // 1分後まで

      console.debug('[Coinos Polling] Checking payments, count:', paymentsData.payments.length);

      // ランダム値が一致する支払いを検索
      const matchedPayment = paymentsData.payments.find((payment) => {
        // 確認済みの支払いかチェック
        if (!payment.confirmed) {
          return false;
        }

        // 時間窓内の支払いかチェック
        const paymentTime = payment.created;
        if (paymentTime < windowStart || paymentTime > windowEnd) {
          return false;
        }

        // memoにランダム値が含まれているかチェック
        if (!payment.memo) {
          return false;
        }

        try {
          // memoをJSONとしてパース
          const memoData = JSON.parse(payment.memo);

          // contentフィールドにランダム値が含まれているかチェック（完全一致）
          if (memoData.content === randomValue) {
            console.log('[Coinos Polling] Found matching payment with content:', memoData.content);
            return true;
          }
        } catch (error) {
          // JSONパースに失敗した場合は無視
          console.debug('[Coinos Polling] Failed to parse memo as JSON:', error);
        }

        return false;
      });

      if (matchedPayment) {
        console.log('[Coinos Polling] Payment detected!', matchedPayment.id);
        stop();
        onPaymentDetected(matchedPayment);
      }
    } catch (error) {
      console.error('[Coinos Polling] Error during polling:', error);
      // エラーが発生してもポーリングは継続
    }
  };

  const stop = () => {
    if (stopped) {
      return;
    }

    stopped = true;

    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    console.log('[Coinos Polling] Polling stopped');
  };

  // 初回ポーリングを即座に実行
  poll();

  // 定期的にポーリング
  intervalId = setInterval(poll, intervalMs);

  // タイムアウト設定
  timeoutId = setTimeout(() => {
    console.log('[Coinos Polling] Polling timeout');
    stop();
  }, timeoutMs);

  return {
    stop,
  };
}
