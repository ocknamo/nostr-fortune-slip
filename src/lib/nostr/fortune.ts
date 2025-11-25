import type { NostrEvent } from './types.js';

/**
 * ラッキーナンバーを生成（min-maxの範囲）
 */
export function generateLuckyNumber(min: number, max: number): number {
  return Math.floor(Math.random() * max) + min;
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
