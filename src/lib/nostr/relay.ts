import { SimplePool } from 'nostr-tools';
import type { Event, Filter } from 'nostr-tools';

// デフォルトリレー
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io/',
  'wss://r.kojira.io/',
  'wss://yabu.me',
  'wss://relay.snort.social',
  'wss://nostr.bitcoiner.social',
];

/** 改行区切りテキストをリレーURL配列に変換（空行除去・トリム・重複除去） */
export function parseRelays(text: string): string[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return [...new Set(lines)];
}

/** リレーURL配列を改行区切りテキストに変換 */
export function serializeRelays(relays: string[]): string {
  return relays.join('\n');
}

/** リレーテキストのバリデーション。正常ならnull、エラーならメッセージを返す */
export function validateRelayText(text: string): string | null {
  const relays = parseRelays(text);
  if (relays.length === 0) {
    return 'リレーを1つ以上入力してください';
  }
  const invalid = relays.filter((r) => !r.startsWith('wss://'));
  if (invalid.length > 0) {
    return `wss://で始まるURLを入力してください: ${invalid.join(', ')}`;
  }
  return null;
}

/** localStorageからリレー設定を取得。未設定またはSSR環境ではデフォルトを返す */
export function getRelays(): string[] {
  if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
    return DEFAULT_RELAYS;
  }
  const stored = localStorage.getItem('relays');
  if (!stored || !stored.trim()) {
    return DEFAULT_RELAYS;
  }
  return parseRelays(stored);
}

/** リレーからフィルターに一致するイベントを1件取得。タイムアウト/エラー時はnull */
export async function fetchEventFromRelays(filter: Filter, timeoutMs = 10000): Promise<Event | null> {
  const pool = new SimplePool();
  const relays = getRelays();

  try {
    return await Promise.race([
      pool.get(relays, filter),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch {
    return null;
  } finally {
    pool.close(relays);
  }
}
