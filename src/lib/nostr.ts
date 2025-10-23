import { nip19, SimplePool, getPublicKey, finalizeEvent } from 'nostr-tools';
import type { Event } from 'nostr-tools';

const RELAYS = ['wss://relay.damus.io/', 'wss://nos.lol/', 'wss://relay.nostr.band/'];

export interface NostrEvent extends Event {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/**
 * nsec形式の秘密鍵をhex形式に変換
 */
export function decodeNsec(nsec: string): Uint8Array {
  if (!nsec.startsWith('nsec1')) {
    throw new Error('Invalid nsec format. Must start with nsec1');
  }

  const decoded = nip19.decode(nsec);
  if (decoded.type !== 'nsec') {
    throw new Error('Invalid nsec key');
  }

  return decoded.data;
}

/**
 * Nostr kind 1イベントを作成
 */
export function createTextEvent(privateKeyHex: Uint8Array, content: string): NostrEvent {
  const publicKey = getPublicKey(privateKeyHex);

  const event = {
    kind: 1,
    pubkey: publicKey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: content,
  };

  const signedEvent = finalizeEvent(event, privateKeyHex);

  return signedEvent as NostrEvent;
}

/**
 * Zap Request イベント（kind 9734）を作成
 */
export function createZapRequest(
  privateKeyHex: Uint8Array,
  recipientPubkey: string,
  eventId: string,
  lnurl: string,
  amount: number,
): NostrEvent {
  const publicKey = getPublicKey(privateKeyHex);

  const event = {
    kind: 9734,
    pubkey: publicKey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['relays', ...RELAYS],
      ['amount', amount.toString()],
      ['lnurl', lnurl],
      ['p', recipientPubkey],
      ['e', eventId],
      ['k', '1'],
    ],
    content: '',
  };

  const signedEvent = finalizeEvent(event, privateKeyHex);

  return signedEvent as NostrEvent;
}

/**
 * リレーにイベントを送信
 */
export async function publishEvent(event: NostrEvent): Promise<void> {
  const pool = new SimplePool();

  try {
    // タイムアウト設定付きでイベントを送信
    const publishPromises = pool.publish(RELAYS, event);

    // 最低1つのリレーで成功すれば良いので、Promise.allSettledを使用
    const results = await Promise.allSettled(
      publishPromises.map((promise) =>
        Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Publish timeout')), 5000)),
        ]),
      ),
    );

    // 少なくとも1つのリレーで成功しているかチェック
    const successful = results.some((result) => result.status === 'fulfilled');

    if (!successful) {
      const errors = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason?.message || 'Unknown error');
      console.error('All relays failed:', errors);
      throw new Error(`Failed to publish to any relay. Errors: ${errors.join(', ')}`);
    }

    console.log('Event published successfully to at least one relay');
  } catch (error) {
    console.error('Failed to publish event:', error);
    throw new Error(`Failed to publish event to relays: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // 少し待ってからプールを閉じる
    setTimeout(() => {
      pool.close(RELAYS);
    }, 1000);
  }
}
