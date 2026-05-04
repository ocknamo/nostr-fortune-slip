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
 * Zap 検知ターゲット
 * - event: 通常モード (ephemeral kind 1) — `e` タグでフィルタ
 * - profile: useKind0 モード — `p` タグでフィルタ (NIP-57 Appendix E に準拠し、
 *   LN サービスが `e` タグを伝搬しなくても確実に検知するため)
 */
export type ZapTarget = { type: 'event'; eventId: string } | { type: 'profile'; pubkey: string };

/**
 * Zap Receipt検知用のサブスクリプション管理
 */
export interface ZapReceiptSubscription {
  pool: any;
  subscriptionId: string;
  target: ZapTarget;
  onZapReceived: (zapReceipt: NostrEvent) => void;
  stop: () => void;
}
