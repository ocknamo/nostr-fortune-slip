import type { NostrEvent } from './types.js';

/**
 * ラッキーナンバーを生成（min-maxの範囲）
 */
export function generateLuckyNumber(min: number, max: number): number {
  return Math.floor(Math.random() * max) + min;
}

/**
 * Get fortune text for a lucky number from the fortune texts array
 * If the array is empty, returns null
 * If the number exceeds array length, it cycles through using modulo
 */
export function getFortuneText(luckyNumber: number, fortuneTexts: string[]): string | null {
  if (fortuneTexts.length === 0) {
    return null;
  }

  // Convert to 0-based index and cycle through array using modulo
  const index = (luckyNumber - 1) % fortuneTexts.length;
  return fortuneTexts[index];
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
