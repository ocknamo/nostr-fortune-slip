import { nip19, nip57, finalizeEvent, type EventTemplate } from 'nostr-tools';
import type { NostrEvent, MetadataContent } from './types';
import { getRelays } from './relay';
import { nip07SignEvent } from './nip07';

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

function buildZapRequestTemplate(
  targetEvent: NostrEvent,
  amount: number,
  comment: string,
  recipientPubkey?: string,
): EventTemplate {
  const params = recipientPubkey
    ? { pubkey: recipientPubkey, amount, comment, relays: getRelays() }
    : { event: targetEvent, amount, comment, relays: getRelays() };
  return nip57.makeZapRequest(params);
}

export function createTextEvent(privateKeyHex: Uint8Array, content: string, tags: string[][] = []): NostrEvent {
  const event: EventTemplate = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
  };
  return finalizeEvent(event, privateKeyHex) as NostrEvent;
}

/** recipientPubkey を指定するとProfileZapモード（特定pubkey宛）になる */
export function createZapRequest(
  privateKeyHex: Uint8Array,
  targetEvent: NostrEvent,
  amount?: number,
  comment?: string,
  recipientPubkey?: string,
): NostrEvent {
  const template = buildZapRequestTemplate(targetEvent, amount || 1000, comment || '', recipientPubkey);
  return finalizeEvent(template, privateKeyHex) as NostrEvent;
}

export async function createTextEventNip07(content: string, tags: string[][] = []): Promise<NostrEvent> {
  const event: EventTemplate = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
  };
  return nip07SignEvent(event);
}

/** recipientPubkey を指定するとProfileZapモード（特定pubkey宛）になる */
export async function createZapRequestNip07(
  targetEvent: NostrEvent,
  amount?: number,
  comment?: string,
  recipientPubkey?: string,
): Promise<NostrEvent> {
  const template = buildZapRequestTemplate(targetEvent, amount || 1000, comment || '', recipientPubkey);
  return nip07SignEvent(template);
}

/** Zapエンドポイント取得用の簡易metadataイベント（署名不要） */
export function createMetadataEvent(pubkey: string, lud16?: string): NostrEvent {
  const metadataContent: MetadataContent = {};
  if (lud16) {
    metadataContent.lud16 = lud16;
  }

  return {
    kind: 0,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: JSON.stringify(metadataContent),
    id: 'temp-id',
    sig: 'temp-sig',
  } as NostrEvent;
}
