import { nip19, nip57, getPublicKey, finalizeEvent, type EventTemplate } from 'nostr-tools';
import type { NostrEvent, MetadataContent } from './types.js';
import { RELAYS } from './relay.js';

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
export function createTextEvent(privateKeyHex: Uint8Array, content: string, tags: string[][] = []): NostrEvent {
  const publicKey = getPublicKey(privateKeyHex);

  const event: EventTemplate = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags,
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
 * ライブラリを利用してZapリクエストを作成するためだけに使うため実際に署名する必要はない
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
 * NostrEventからnevent1形式のURIを生成
 */
export function createNeventUri(event: NostrEvent): string {
  const eventPointer = {
    id: event.id,
    relays: RELAYS,
    author: event.pubkey,
    kind: event.kind,
  };

  return nip19.neventEncode(eventPointer);
}
