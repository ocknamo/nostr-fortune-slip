import { nip19, nip57, finalizeEvent, type EventTemplate } from 'nostr-tools';
import type { NostrEvent, MetadataContent } from './types.js';
import { getRelays } from './relay.js';
import { nip07SignEvent } from './nip07.js';

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
 * recipientPubkey を指定するとProfileZapモード（特定pubkey宛）になる
 */
export function createZapRequest(
  privateKeyHex: Uint8Array,
  targetEvent: NostrEvent,
  amount?: number,
  comment?: string,
  recipientPubkey?: string,
): NostrEvent {
  const zapParams = recipientPubkey
    ? { pubkey: recipientPubkey, amount: amount || 1000, comment: comment || '', relays: getRelays() }
    : { event: targetEvent, amount: amount || 1000, comment: comment || '', relays: getRelays() };

  const zapRequestTemplate = nip57.makeZapRequest(zapParams);

  // テンプレートに署名してEventに変換
  const signedEvent = finalizeEvent(zapRequestTemplate, privateKeyHex);
  return signedEvent as NostrEvent;
}

/**
 * NIP-07でNostr kind 1イベントを作成・署名
 */
export async function createTextEventNip07(content: string, tags: string[][] = []): Promise<NostrEvent> {
  const event: EventTemplate = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
  };

  return nip07SignEvent(event);
}

/**
 * NIP-07でZap Requestイベント（kind 9734）を作成・署名
 * recipientPubkey を指定するとProfileZapモード（特定pubkey宛）になる
 */
export async function createZapRequestNip07(
  targetEvent: NostrEvent,
  amount?: number,
  comment?: string,
  recipientPubkey?: string,
): Promise<NostrEvent> {
  const zapParams = recipientPubkey
    ? { pubkey: recipientPubkey, amount: amount || 1000, comment: comment || '', relays: getRelays() }
    : { event: targetEvent, amount: amount || 1000, comment: comment || '', relays: getRelays() };

  const zapRequestTemplate = nip57.makeZapRequest(zapParams);

  return nip07SignEvent(zapRequestTemplate);
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
