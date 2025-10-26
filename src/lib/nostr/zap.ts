import { SimplePool } from 'nostr-tools';
import type { Event, Filter } from 'nostr-tools';
import type { NostrEvent, ZapReceiptSubscription } from './types.js';
import { RELAYS } from './relay.js';
import { verifyCoinosPayment } from '../coinos.js';

/**
 * Zapインボイスを直接取得（nostter風の実装）
 */
export async function getZapInvoiceFromEndpoint(
  zapEndpoint: string,
  amount: number,
  zapRequest: NostrEvent,
): Promise<{ pr: string }> {
  const encoded = encodeURI(JSON.stringify(zapRequest));
  const url = `${zapEndpoint}?amount=${amount}&nostr=${encoded}`;

  console.debug('[zap url]', url);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Cannot get Zap invoice from endpoint');
    }

    const invoice = await response.json();
    if (invoice.status === 'ERROR') {
      throw new Error(invoice.reason || 'Zap invoice generation failed');
    }

    if (!invoice.pr) {
      throw new Error('No invoice returned from Zap endpoint');
    }

    return invoice;
  } catch (error) {
    console.error('Failed to get Zap invoice:', error);
    throw new Error('Failed to get Zap invoice from endpoint');
  }
}

/**
 * Zap Receiptの妥当性を検証（同期版）
 * NIP-57 Appendix Fの仕様に基づく
 */
export function validateZapReceipt(
  zapReceipt: NostrEvent,
  targetEventId: string,
  zapRequest: NostrEvent,
  allowDirectNostrZap = true,
): boolean {
  try {
    // kind 9735であることを確認
    if (zapReceipt.kind !== 9735) {
      console.warn('Invalid zap receipt kind:', zapReceipt.kind);
      return false;
    }

    // 必要なタグの存在確認
    const bolt11Tag = zapReceipt.tags.find((tag) => tag[0] === 'bolt11');
    const descriptionTag = zapReceipt.tags.find((tag) => tag[0] === 'description');
    const eTag = zapReceipt.tags.find((tag) => tag[0] === 'e');

    if (!bolt11Tag || !descriptionTag) {
      console.warn('Missing required tags in zap receipt');
      return false;
    }

    // eTagが存在し、対象eventIdと一致することを確認
    if (eTag && eTag[1] !== targetEventId) {
      console.warn('Zap receipt event ID mismatch:', eTag[1], 'expected:', targetEventId);
      return false;
    }

    // descriptionがzap requestと一致することを確認
    // allowDirectNostrZapがfalseの場合のみ厳密に検証
    if (!allowDirectNostrZap) {
      try {
        const description = JSON.parse(descriptionTag[1]);
        if (description.id !== zapRequest.id) {
          console.warn('Zap receipt description ID mismatch');
          return false;
        }
      } catch (error) {
        console.warn('Invalid zap receipt description JSON:', error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error validating zap receipt:', error);
    return false;
  }
}

/**
 * Zap Receiptの妥当性を検証（Coinos API検証付き）
 * NIP-57 Appendix Fの仕様に基づく基本検証とCoinos APIによる支払い検証を行う
 */
export async function validateZapReceiptWithCoinos(
  zapReceipt: NostrEvent,
  targetEventId: string,
  zapRequest: NostrEvent,
  allowDirectNostrZap = true,
  coinosApiToken?: string,
): Promise<{ valid: boolean; coinosVerified?: boolean; error?: string }> {
  try {
    // まず基本的なNostr検証を実行
    const basicValid = validateZapReceipt(zapReceipt, targetEventId, zapRequest, allowDirectNostrZap);

    if (!basicValid) {
      return {
        valid: false,
        error: 'Basic zap receipt validation failed',
      };
    }

    // Coinos APIトークンがない場合は基本検証のみで成功
    if (!coinosApiToken || !coinosApiToken.trim()) {
      console.log('[Zap Verification] No Coinos API token provided, skipping API verification');
      return {
        valid: true,
        coinosVerified: false,
      };
    }

    // Coinos API検証を実行
    console.log('[Zap Verification] Starting Coinos API verification');
    const coinosResult = await verifyCoinosPayment(zapReceipt, coinosApiToken);

    if (coinosResult.verified) {
      console.log('[Zap Verification] Both Nostr and Coinos verification passed');
      return {
        valid: true,
        coinosVerified: true,
      };
    } else {
      // Coinos検証に失敗した場合はエラーとして扱う（フィードバックに基づく）
      console.error('[Zap Verification] Coinos verification failed:', coinosResult.error);
      return {
        valid: false,
        coinosVerified: false,
        error: `Coinos verification failed: ${coinosResult.error}`,
      };
    }
  } catch (error) {
    console.error('[Zap Verification] Unexpected error during verification:', error);
    return {
      valid: false,
      error: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 特定のイベントに対するZap Receipt (kind 9735)を監視
 * QRコード表示直後から開始し、zapが検知されたらコールバックを実行
 * Coinos API検証も含む
 */
export function subscribeToZapReceipts(
  targetEventId: string,
  zapRequest: NostrEvent,
  onZapReceived: (zapReceipt: NostrEvent) => void,
  timeoutMs: number = 300000, // 5分のタイムアウト
  allowDirectNostrZap = true, // デフォルトtrue
  coinosApiToken?: string, // Coinos API Token（オプション）
  onZapError?: (error: string) => void, // エラーコールバック（オプション）
): ZapReceiptSubscription {
  const pool = new SimplePool();
  const subscriptionId = `zap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[Zap Monitor] Starting subscription for event: ${targetEventId}`);
  console.log(`[Zap Monitor] Coinos verification enabled:`, !!coinosApiToken);

  // フィルターを正しいFilter型で作成
  const filter: Filter = {
    kinds: [9735],
    since: Math.floor(Date.now() / 1000) - 60,
    '#e': [targetEventId], // Filter型のindex signatureを使用
  };

  console.log(`[Zap Monitor] Filter:`, JSON.stringify(filter, null, 2));

  // サブスクリプション開始 - 正しい型を使用
  const subscription = pool.subscribeMany(
    RELAYS,
    filter, // 単一のFilterオブジェクト
    {
      onevent: async (event: Event) => {
        console.log(`[Zap Monitor] Received zap receipt:`, event);

        const zapReceipt = event as NostrEvent;

        try {
          // Coinos API検証を含む総合的な検証を実行
          const verificationResult = await validateZapReceiptWithCoinos(
            zapReceipt,
            targetEventId,
            zapRequest,
            allowDirectNostrZap,
            coinosApiToken,
          );

          if (verificationResult.valid) {
            console.log(`[Zap Monitor] Valid zap receipt detected for event: ${targetEventId}`);
            if (verificationResult.coinosVerified) {
              console.log(`[Zap Monitor] Coinos verification also passed`);
            }
            onZapReceived(zapReceipt);
          } else {
            console.warn(`[Zap Monitor] Invalid zap receipt for event: ${targetEventId}`, verificationResult.error);
            // Coinos検証失敗の場合、エラーコールバックを呼び出す
            if (
              verificationResult.error &&
              verificationResult.error.includes('Coinos verification failed') &&
              onZapError
            ) {
              onZapError(verificationResult.error);
            }
          }
        } catch (error) {
          console.error(`[Zap Monitor] Error during zap receipt verification:`, error);
          // 検証エラーの場合もエラーコールバックを呼び出す
          if (onZapError) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            onZapError(`Zap verification error: ${errorMessage}`);
          }
        }
      },
      oneose: () => {
        console.log(`[Zap Monitor] End of stored events for subscription: ${subscriptionId}`);
      },
      onclose: (reasons: string[]) => {
        console.log(`[Zap Monitor] Subscription closed:`, reasons);
      },
    },
  );

  // タイムアウト設定
  const timeoutId = setTimeout(() => {
    console.log(`[Zap Monitor] Subscription timeout for event: ${targetEventId}`);
    subscription.close();
    pool.close(RELAYS);
  }, timeoutMs);

  // 停止関数
  const stop = () => {
    console.log(`[Zap Monitor] Stopping subscription for event: ${targetEventId}`);
    clearTimeout(timeoutId);
    subscription.close();
    // 少し待ってからプールを閉じる
    setTimeout(() => {
      pool.close(RELAYS);
    }, 1000);
  };

  return {
    pool,
    subscriptionId,
    eventId: targetEventId,
    onZapReceived,
    stop,
  };
}
