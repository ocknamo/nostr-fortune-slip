import { SimplePool } from 'nostr-tools';
import type { Event, Filter } from 'nostr-tools';
import type { NostrEvent, ZapReceiptSubscription } from './types.js';

const RELAYS = ['wss://relay.damus.io/', 'wss://nos.lol/', 'wss://relay.nostr.band/'];

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
 * Zap Receiptの妥当性を検証
 * NIP-57 Appendix Fの仕様に基づく
 */
export function validateZapReceipt(zapReceipt: NostrEvent, targetEventId: string, zapRequest: NostrEvent): boolean {
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

    return true;
  } catch (error) {
    console.error('Error validating zap receipt:', error);
    return false;
  }
}

/**
 * 特定のイベントに対するZap Receipt (kind 9735)を監視
 * QRコード表示直後から開始し、zapが検知されたらコールバックを実行
 */
export function subscribeToZapReceipts(
  targetEventId: string,
  zapRequest: NostrEvent,
  onZapReceived: (zapReceipt: NostrEvent) => void,
  timeoutMs: number = 300000, // 5分のタイムアウト
): ZapReceiptSubscription {
  const pool = new SimplePool();
  const subscriptionId = `zap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[Zap Monitor] Starting subscription for event: ${targetEventId}`);

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
      onevent: (event: Event) => {
        console.log(`[Zap Monitor] Received zap receipt:`, event);

        const zapReceipt = event as NostrEvent;

        // Zap Receiptの妥当性を検証
        if (validateZapReceipt(zapReceipt, targetEventId, zapRequest)) {
          console.log(`[Zap Monitor] Valid zap receipt detected for event: ${targetEventId}`);
          onZapReceived(zapReceipt);
        } else {
          console.warn(`[Zap Monitor] Invalid zap receipt for event: ${targetEventId}`);
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
