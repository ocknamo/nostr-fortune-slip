import { getPublicKey, finalizeEvent, nip19 } from 'nostr-tools';
import type { NostrEvent } from './types.js';
import { decodeNsec } from './events.js';
import { publishEvent } from './utils.js';

/**
 * ラッキーナンバーを生成（1-20の範囲）
 */
export function generateLuckyNumber(): number {
  return Math.floor(Math.random() * 20) + 1;
}

/**
 * ZapレシートからZapした人の公開鍵を取得
 */
export function extractZapperPubkey(zapReceipt: NostrEvent): string | null {
  // Zap receiptのdescriptionタグからzap requestを取得
  const descriptionTag = zapReceipt.tags.find((tag) => tag[0] === 'description');
  if (!descriptionTag || !descriptionTag[1]) {
    console.warn('No description tag found in zap receipt');
    return null;
  }

  try {
    const zapRequest = JSON.parse(descriptionTag[1]);
    return zapRequest.pubkey;
  } catch (error) {
    console.error('Failed to parse zap request from description:', error);
    return null;
  }
}

/**
 * メンション付きのフォーチュンメッセージを作成
 */
export function createFortuneMessage(zapperPubkey: string, luckyNumber: number): string {
  const npub = nip19.npubEncode(zapperPubkey);
  const mention = `nostr:${npub}`;
  return `おみくじがひかれました🎉\n\nラッキーナンバーは ${luckyNumber} です✨\n\n素敵な一日をお過ごしください! ${mention} `;
}

/**
 * メンション付きkind1イベントを作成
 */
export function createMentionEvent(
  privateKeyHex: Uint8Array,
  zapperPubkey: string,
  originalEventId: string,
  luckyNumber: number,
): NostrEvent {
  const content = createFortuneMessage(zapperPubkey, luckyNumber);
  const publicKey = getPublicKey(privateKeyHex);

  const event = {
    kind: 1,
    pubkey: publicKey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['p', zapperPubkey], // メンション対象
      ['e', originalEventId, '', 'reply'], // 元のイベントへのリプライ
    ],
    content: content,
  };

  const signedEvent = finalizeEvent(event, privateKeyHex);
  return signedEvent as NostrEvent;
}

/**
 * Zap検知後の処理を統合した主要機能
 */
export async function handleZapReceived(
  zapReceipt: NostrEvent,
  originalEventId: string,
  privateKeyNsec: string,
): Promise<{ success: boolean; luckyNumber?: number }> {
  try {
    // Zapした人の公開鍵を取得
    const zapperPubkey = extractZapperPubkey(zapReceipt);
    if (!zapperPubkey) {
      console.error('Could not extract zapper pubkey from zap receipt');
      return { success: false };
    }

    // ラッキーナンバーを生成
    const luckyNumber = generateLuckyNumber();

    console.log(`Generating fortune for zapper: ${zapperPubkey}, lucky number: ${luckyNumber}`);

    // 秘密鍵をデコード
    const privateKeyHex = decodeNsec(privateKeyNsec);

    // メンション付きイベントを作成
    const mentionEvent = createMentionEvent(privateKeyHex, zapperPubkey, originalEventId, luckyNumber);

    // イベントを送信
    await publishEvent(mentionEvent);

    return { success: true, luckyNumber };
  } catch (error) {
    console.error('Error handling zap receipt:', error);
    return { success: false };
  }
}
