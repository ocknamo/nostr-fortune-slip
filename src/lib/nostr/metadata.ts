import { nip19, SimplePool } from 'nostr-tools';
import type { MetadataContent } from './types.js';
import { getRelays } from './relay.js';

/** npub形式のバリデーション。正常ならnull、エラーならメッセージを返す。空文字は任意なのでOK */
export function validateNpub(npub: string): string | null {
  const trimmed = npub.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith('npub1')) {
    return 'npub1で始まる公開鍵を入力してください';
  }

  try {
    const decoded = nip19.decode(trimmed);
    if (decoded.type !== 'npub') {
      return 'npub1で始まる有効な公開鍵を入力してください';
    }
  } catch {
    return '公開鍵のデコードに失敗しました。正しいnpub形式か確認してください';
  }

  return null;
}

/** npub形式をhex公開鍵に変換 */
export function decodeNpub(npub: string): string {
  if (!npub.startsWith('npub1')) {
    throw new Error('npub1で始まる公開鍵を入力してください');
  }

  const decoded = nip19.decode(npub);
  if (decoded.type !== 'npub') {
    throw new Error('npub1で始まる有効な公開鍵を入力してください');
  }

  return decoded.data;
}

/** リレーからkind:0メタデータを取得。見つからない/タイムアウトならnullを返す */
export async function fetchMetadataFromRelays(pubkeyHex: string, timeoutMs = 10000): Promise<MetadataContent | null> {
  const pool = new SimplePool();
  const relays = getRelays();

  try {
    const event = await Promise.race([
      pool.get(relays, { kinds: [0], authors: [pubkeyHex] }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (!event) return null;

    try {
      return JSON.parse(event.content) as MetadataContent;
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    pool.close(relays);
  }
}
