import { nip19, nip57, SimplePool, getPublicKey, finalizeEvent } from 'nostr-tools';
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
 * Metadata content interface
 */
export interface MetadataContent {
  name?: string;
  display_name?: string;
  nip05?: string;
  picture?: string;
  about?: string;
  lud06?: string;
  lud16?: string;
}

/**
 * Metadata class (nostterのMetadataクラスを参考)
 */
export class Metadata {
  public readonly content: MetadataContent | undefined;
  private _zapUrl: string | null | undefined;

  constructor(public readonly event: NostrEvent) {
    try {
      this.content = JSON.parse(event.content) as MetadataContent;
    } catch (error) {
      console.warn('[invalid metadata]', error, event);
      this.content = undefined;
    }
  }

  /**
   * zapUrl生成
   */
  public async zapUrl(): Promise<string | null> {
    if (this._zapUrl !== undefined) {
      return this._zapUrl;
    }

    // 独自実装しないでnip57.getZapEndpointを使用
    const url = await nip57.getZapEndpoint(this.event);
    if (url !== null) {
      this._zapUrl = url;
    } else {
      this._zapUrl = null;
    }

    return this._zapUrl;
  }

  get canZap(): boolean {
    return !!(this.content?.lud16 || this.content?.lud06);
  }
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
 * Zap Request イベント（kind 9734）を作成 (nostr-toolsのnip57.makeZapRequestを使用)
 */
export function createZapRequest(
  privateKeyHex: Uint8Array,
  targetEvent: NostrEvent,
  amount?: number,
  comment?: string,
): NostrEvent {
  const zapRequestTemplate = nip57.makeZapRequest({
    event: targetEvent,
    amount: amount || 1000,
    comment: comment || '',
    relays: RELAYS,
  });

  // テンプレートに署名してEventに変換
  const signedEvent = finalizeEvent(zapRequestTemplate, privateKeyHex);
  return signedEvent as NostrEvent;
}

/**
 * ユーザーのmetadata eventを作成（簡易実装）
 */
export function createMetadataEvent(pubkey: string, lud16?: string): NostrEvent {
  const metadataContent: MetadataContent = {};
  if (lud16) {
    metadataContent.lud16 = lud16;
  }

  const event = {
    kind: 0,
    pubkey: pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: JSON.stringify(metadataContent),
    id: 'temp-id', // 一時的なID
    sig: 'temp-sig', // 一時的な署名
  };

  return event as NostrEvent;
}

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
