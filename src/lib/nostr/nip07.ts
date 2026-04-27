import type { EventTemplate } from 'nostr-tools';
import type { NostrEvent } from './types';
import { fetchEventFromRelays, serializeRelays } from './relay';

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: EventTemplate): Promise<NostrEvent>;
    };
  }
}

/** NIP-07拡張（window.nostr）が利用可能かどうか */
export function isNip07Available(): boolean {
  return typeof window !== 'undefined' && !!window?.nostr;
}

/** NIP-07で公開鍵を取得 */
export async function nip07GetPublicKey(): Promise<string> {
  if (!isNip07Available()) {
    throw new Error('NIP-07拡張が見つかりません。Nostrブラウザ拡張をインストールしてください。');
  }
  return window.nostr!.getPublicKey();
}

/** NIP-07でイベントに署名 */
export async function nip07SignEvent(event: EventTemplate): Promise<NostrEvent> {
  if (!isNip07Available()) {
    throw new Error('NIP-07拡張が見つかりません。Nostrブラウザ拡張をインストールしてください。');
  }
  return window.nostr!.signEvent(event);
}

/** リレーからkind:10002 (NIP-65) を取得してリレーURL一覧を返す */
export async function fetchRelayListFromRelays(pubkeyHex: string, timeoutMs = 10000): Promise<string[] | null> {
  const event = await fetchEventFromRelays({ kinds: [10002], authors: [pubkeyHex] }, timeoutMs);
  if (!event) return null;

  const relayUrls = event.tags.filter((tag) => tag[0] === 'r' && tag[1]).map((tag) => tag[1]);
  return relayUrls.length > 0 ? relayUrls : null;
}

/** kind:10002からリレーを取得し、改行区切り文字列として返す。見つからなければnull */
export async function syncRelaysFromNip65(pubkeyHex: string, timeoutMs = 10000): Promise<string | null> {
  const relayList = await fetchRelayListFromRelays(pubkeyHex, timeoutMs);
  if (!relayList) return null;
  return serializeRelays(relayList);
}
