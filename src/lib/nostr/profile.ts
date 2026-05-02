import { SimplePool } from 'nostr-tools';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from './types.js';
import { RELAYS } from './relay.js';

const KIND0_CACHE_KEY = 'nostrKind0';

export function npubToHex(npub: string): string {
  const decoded = nip19.decode(npub.trim());
  if (decoded.type !== 'npub') throw new Error('Invalid npub');
  return decoded.data as string;
}

export async function fetchKind0(pubkeyHex: string): Promise<NostrEvent | null> {
  const pool = new SimplePool();
  try {
    const event = await pool.get(RELAYS, { kinds: [0], authors: [pubkeyHex] });
    if (event) {
      localStorage.setItem(KIND0_CACHE_KEY, JSON.stringify(event));
      return event as NostrEvent;
    }
    return null;
  } finally {
    pool.close(RELAYS);
  }
}

export function getCachedKind0(): NostrEvent | null {
  const stored = localStorage.getItem(KIND0_CACHE_KEY);
  return stored ? (JSON.parse(stored) as NostrEvent) : null;
}

export function clearCachedKind0(): void {
  localStorage.removeItem(KIND0_CACHE_KEY);
}

export function getLud16FromKind0(kind0: NostrEvent): string | null {
  try {
    return (JSON.parse(kind0.content).lud16 as string) ?? null;
  } catch {
    return null;
  }
}

export function getDisplayNameFromKind0(kind0: NostrEvent): string {
  try {
    const c = JSON.parse(kind0.content);
    return (c.display_name as string) || (c.name as string) || '';
  } catch {
    return '';
  }
}
