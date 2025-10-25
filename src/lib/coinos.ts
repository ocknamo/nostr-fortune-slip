import type { CoinosPaymentResponse, CoinosVerificationResult } from './coinos-types.js';
import type { NostrEvent } from './nostr/types.js';

const COINOS_API_BASE_URL = 'https://coinos.io/api';

/**
 * Coinos APIエラークラス
 */
export class CoinosApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public originalError?: any,
  ) {
    super(message);
    this.name = 'CoinosApiError';
  }
}

/**
 * Coinos APIから支払い履歴を取得
 * @param token Read-Only APIトークン
 * @param limit 取得件数（デフォルト: 50）
 * @returns Promise<CoinosPaymentResponse>
 * @throws CoinosApiError APIエラー、ネットワークエラーの場合
 */
export async function getCoinosPayments(token: string, limit: number = 50): Promise<CoinosPaymentResponse> {
  if (!token.trim()) {
    throw new CoinosApiError('API token is required');
  }

  const url = `${COINOS_API_BASE_URL}/payments?limit=${limit}`;

  try {
    console.debug('[Coinos API] Requesting payments:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      // ネットワークタイムアウトを設定
      signal: AbortSignal.timeout(10000), // 10秒
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new CoinosApiError(
        `Coinos API error: ${response.status} ${response.statusText}`,
        response.status,
        errorText,
      );
    }

    const data = await response.json();
    console.debug('[Coinos API] Response received:', data);

    return data as CoinosPaymentResponse;
  } catch (error) {
    if (error instanceof CoinosApiError) {
      throw error;
    }

    // ネットワークエラーやタイムアウトエラーをCoinosApiErrorに変換
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new CoinosApiError('Network error: Unable to connect to Coinos API', undefined, error);
    }

    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new CoinosApiError('Coinos API request timeout', undefined, error);
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new CoinosApiError('Coinos API request aborted', undefined, error);
    }

    throw new CoinosApiError(
      `Unexpected error while calling Coinos API: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error,
    );
  }
}

/**
 * ZapレシートからpreimageとHashを抽出
 * @param zapReceipt Zapレシートイベント
 * @returns { preimage: string, paymentHash?: string } | null
 */
export function extractZapReceiptData(zapReceipt: NostrEvent): { preimage: string; paymentHash?: string } | null {
  try {
    // preimageタグを探す
    const preimageTag = zapReceipt.tags.find((tag) => tag[0] === 'preimage');
    if (!preimageTag || !preimageTag[1]) {
      console.warn('[Coinos Verification] No preimage tag found in zap receipt');
      return null;
    }

    const preimage = preimageTag[1];

    // bolt11タグからpayment_hashを抽出することも可能だが、
    // ここではpreimageのみを使用
    return { preimage };
  } catch (error) {
    console.error('[Coinos Verification] Error extracting zap receipt data:', error);
    return null;
  }
}

/**
 * Coinos APIでZap支払いを検証
 * @param zapReceipt Zapレシートイベント
 * @param token Coinos Read-Only APIトークン
 * @param timeWindowMs 検証対象の時間窓（デフォルト: 10分）
 * @returns Promise<CoinosVerificationResult>
 */
export async function verifyCoinosPayment(
  zapReceipt: NostrEvent,
  token: string,
  timeWindowMs: number = 600000, // 10分
): Promise<CoinosVerificationResult> {
  try {
    // Zapレシートからpreimageを抽出
    const zapData = extractZapReceiptData(zapReceipt);
    if (!zapData) {
      return {
        verified: false,
        error: 'Unable to extract preimage from zap receipt',
      };
    }

    // Coinos APIから支払い履歴を取得
    const paymentsData = await getCoinosPayments(token, 100); // 最大100件取得

    // Zapレシートの作成時刻を基準にした時間窓を設定
    const zapTimestamp = zapReceipt.created_at * 1000; // ミリ秒に変換
    const windowStart = zapTimestamp - timeWindowMs;
    const windowEnd = zapTimestamp + timeWindowMs;

    console.debug('[Coinos Verification] Looking for payment with preimage:', zapData.preimage);
    console.debug('[Coinos Verification] Time window:', new Date(windowStart), 'to', new Date(windowEnd));

    // preimageが一致する支払いを検索
    const matchedPayment = paymentsData.payments.find((payment) => {
      // preimage(ref)の一致確認
      if (payment.ref !== zapData.preimage) {
        return false;
      }

      // 時間窓内の支払いかチェック
      const paymentTime = payment.created;
      if (paymentTime < windowStart || paymentTime > windowEnd) {
        console.debug('[Coinos Verification] Payment time outside window:', new Date(paymentTime));
        return false;
      }

      // 確認済みの支払いかチェック
      if (!payment.confirmed) {
        console.debug('[Coinos Verification] Payment not confirmed yet');
        return false;
      }

      return true;
    });

    if (!matchedPayment) {
      return {
        verified: false,
        error: 'No matching confirmed payment found in Coinos API',
      };
    }

    console.log('[Coinos Verification] Matched payment found:', matchedPayment.id);

    // 追加検証: memoにzap requestの情報が含まれているかチェック（オプション）
    if (matchedPayment.memo) {
      try {
        const memoData = JSON.parse(matchedPayment.memo);
        if (memoData.id) {
          // descriptionタグからzap requestのIDを取得
          const descriptionTag = zapReceipt.tags.find((tag) => tag[0] === 'description');
          if (descriptionTag) {
            const zapRequestData = JSON.parse(descriptionTag[1]);
            if (zapRequestData.id !== memoData.id) {
              console.warn('[Coinos Verification] Zap request ID mismatch in memo');
              // 警告を出すが、検証は成功とする（preimageの一致が最重要）
            }
          }
        }
      } catch (error) {
        // memoのパースに失敗してもエラーにはしない
        console.debug('[Coinos Verification] Unable to parse memo JSON:', error);
      }
    }

    return {
      verified: true,
      matchedPayment,
    };
  } catch (error) {
    if (error instanceof CoinosApiError) {
      return {
        verified: false,
        error: error.message,
      };
    }

    return {
      verified: false,
      error: `Unexpected error during Coinos verification: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
