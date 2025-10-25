import type { Event } from 'nostr-tools';

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
 * Zap Receipt検知用のサブスクリプション管理
 */
export interface ZapReceiptSubscription {
  pool: any;
  subscriptionId: string;
  eventId: string;
  onZapReceived: (zapReceipt: NostrEvent) => void;
  stop: () => void;
}
