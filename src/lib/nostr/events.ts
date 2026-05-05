import { nip57, finalizeEvent, type EventTemplate } from 'nostr-tools';
import type { NostrEvent, MetadataContent } from './types.js';
import { RELAYS } from './relay.js';

/**
 * Nostr kind 1イベントを作成
 */
export function createTextEvent(privateKeyBytes: Uint8Array, content: string, tags: string[][] = []): NostrEvent {
  const event: EventTemplate = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: content,
  };

  const signedEvent = finalizeEvent(event, privateKeyBytes);

  return signedEvent as NostrEvent;
}

/**
 * Zap Request イベント（kind 9734）を作成 (nostr-toolsのnip57.makeZapRequestを使用)
 *
 * recipientPubkey を指定するとプロフィール zap モードになり、
 * `nip57.makeZapRequest` を `pubkey:` 引数で呼ぶ。これにより request の
 * tags は p のみ (NIP-57 Appendix E 準拠) となり、kind 0 を指す e/k/a タグが
 * 付かなくなる。指定しない場合は従来どおり `event:` で呼ぶ event zap。
 */
export function createZapRequest(
  privateKeyBytes: Uint8Array,
  targetEvent: NostrEvent,
  amount?: number,
  comment?: string,
  recipientPubkey?: string,
): NostrEvent {
  const params = recipientPubkey
    ? { pubkey: recipientPubkey, amount: amount ?? 1000, comment: comment ?? '', relays: RELAYS }
    : { event: targetEvent, amount: amount ?? 1000, comment: comment ?? '', relays: RELAYS };
  const zapRequestTemplate = nip57.makeZapRequest(params);

  // テンプレートに署名してEventに変換
  const signedEvent = finalizeEvent(zapRequestTemplate, privateKeyBytes);
  return signedEvent as NostrEvent;
}

/**
 * 簡易 metadata event を組み立てる。
 * nip57.getZapEndpoint() に lud16 を渡すためのキャリアとしてのみ使い、
 * リレーには publish しないので署名は不要。
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
