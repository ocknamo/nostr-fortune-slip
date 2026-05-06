export const DEFAULT_FORTUNE_TEXTS_CSV = '大吉,中吉,小吉,吉,末吉,凶,大凶';
export const DEFAULT_NO_CONFETTI_TEXTS_CSV = '凶,大凶';

export function parseCsv(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function isValidRelayUrl(url: string): boolean {
  return /^wss?:\/\/.+/.test(url);
}
