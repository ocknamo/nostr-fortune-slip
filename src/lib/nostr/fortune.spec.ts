import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  generateLuckyNumber,
  extractZapperPubkey,
  createFortuneMessage,
  createMentionEvent,
  handleZapReceived,
} from './fortune.js';
import type { NostrEvent } from './types.js';

// Mock nostr-tools
vi.mock('nostr-tools', () => ({
  SimplePool: vi.fn(),
  getPublicKey: vi.fn(),
  finalizeEvent: vi.fn(),
  nip19: {
    npubEncode: vi.fn(),
  },
}));

// Mock events module
vi.mock('./events.js', () => ({
  decodeNsec: vi.fn(),
}));

// Mock utils module
vi.mock('./utils.js', () => ({
  publishEvent: vi.fn(),
}));

import { SimplePool, getPublicKey, finalizeEvent, nip19 } from 'nostr-tools';
import { decodeNsec } from './events.js';
import { publishEvent } from './utils.js';

describe('generateLuckyNumber', () => {
  it('should generate number between 1 and 100', () => {
    // Test multiple times to ensure range
    for (let i = 0; i < 10; i++) {
      const number = generateLuckyNumber(1, 100);
      expect(number).toBeGreaterThanOrEqual(1);
      expect(number).toBeLessThanOrEqual(100);
      expect(Number.isInteger(number)).toBe(true);
    }
  });
});

describe('extractZapperPubkey', () => {
  const createMockZapReceipt = (description?: string): NostrEvent => ({
    id: 'receipt-id',
    pubkey: 'lightning-service-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    kind: 9735,
    tags: description ? [['description', description]] : [],
    content: '',
    sig: 'receipt-sig',
  });

  it('should extract pubkey from valid zap receipt', () => {
    const zapperPubkey = 'zapper-pubkey-123';
    const zapRequest = {
      id: 'zap-request-id',
      pubkey: zapperPubkey,
      kind: 9734,
    };

    const zapReceipt = createMockZapReceipt(JSON.stringify(zapRequest));

    const result = extractZapperPubkey(zapReceipt);
    expect(result).toBe(zapperPubkey);
  });

  it('should return null when no description tag', () => {
    const zapReceipt = createMockZapReceipt();

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = extractZapperPubkey(zapReceipt);

    expect(result).toBe(null);
    expect(consoleSpy).toHaveBeenCalledWith('No description tag found in zap receipt');

    consoleSpy.mockRestore();
  });

  it('should return null when description is invalid JSON', () => {
    const zapReceipt = createMockZapReceipt('invalid json');

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = extractZapperPubkey(zapReceipt);

    expect(result).toBe(null);
    expect(consoleSpy).toHaveBeenCalledWith('Failed to parse zap request from description:', expect.any(Error));

    consoleSpy.mockRestore();
  });
});

describe('createFortuneMessage', () => {
  beforeEach(() => {
    vi.mocked(nip19.npubEncode).mockReturnValue('npub1testencoded');
  });

  it('should create correctly formatted message', () => {
    const zapperPubkey = 'test-pubkey';
    const luckyNumber = 42;

    const message = createFortuneMessage(zapperPubkey, luckyNumber);

    expect(nip19.npubEncode).toHaveBeenCalledWith(zapperPubkey);
    expect(message).toContain('nostr:npub1testencoded');
    expect(message).toContain(`ラッキーナンバーは ${luckyNumber} です`);
  });

  it('should handle different lucky numbers', () => {
    const zapperPubkey = 'test-pubkey';

    const message1 = createFortuneMessage(zapperPubkey, 1);
    const message100 = createFortuneMessage(zapperPubkey, 100);

    expect(message1).toContain('ラッキーナンバーは 1 です');
    expect(message100).toContain('ラッキーナンバーは 100 です');
  });
});

describe('createMentionEvent', () => {
  beforeEach(() => {
    vi.mocked(getPublicKey).mockReturnValue('derived-public-key');
    vi.mocked(finalizeEvent).mockReturnValue({
      id: 'signed-event-id',
      pubkey: 'derived-public-key',
      created_at: 1234567890,
      kind: 1,
      tags: [
        ['p', 'zapper-pubkey'],
        ['e', 'original-event-id', '', 'reply'],
      ],
      content: 'test content',
      sig: 'signature',
    } as any);
  });

  it('should create mention event with correct structure', () => {
    const privateKeyHex = new Uint8Array([1, 2, 3]);
    const zapperPubkey = 'zapper-pubkey';
    const originalEventId = 'original-event-id';
    const luckyNumber = 77;

    const event = createMentionEvent(privateKeyHex, zapperPubkey, originalEventId, luckyNumber);

    expect(getPublicKey).toHaveBeenCalledWith(privateKeyHex);
    expect(finalizeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 1,
        pubkey: 'derived-public-key',
        tags: [
          ['p', zapperPubkey],
          ['e', originalEventId, '', 'reply'],
        ],
        content: expect.stringContaining(`ラッキーナンバーは ${luckyNumber} です`),
      }),
      privateKeyHex,
    );

    expect(event.kind).toBe(1);
    expect(event.pubkey).toBe('derived-public-key');
  });
});

describe('handleZapReceived', () => {
  beforeEach(() => {
    vi.mocked(decodeNsec).mockReturnValue(new Uint8Array([1, 2, 3]));
    vi.mocked(getPublicKey).mockReturnValue('derived-public-key');
    vi.mocked(finalizeEvent).mockReturnValue({
      id: 'signed-event-id',
      pubkey: 'derived-public-key',
      created_at: 1234567890,
      kind: 1,
      tags: [],
      content: 'test',
      sig: 'signature',
    } as any);

    // Mock publishEvent to resolve successfully
    vi.mocked(publishEvent).mockResolvedValue(undefined);
  });

  it('should handle zap receipt successfully', async () => {
    const zapReceipt: NostrEvent = {
      id: 'receipt-id',
      pubkey: 'lightning-service-pubkey',
      created_at: 1234567890,
      kind: 9735,
      tags: [
        ['description', JSON.stringify({ pubkey: 'zapper-pubkey' })],
        ['bolt11', 'invoice'],
      ],
      content: '',
      sig: 'receipt-sig',
    };

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await handleZapReceived(zapReceipt, 'original-event-id', 'nsec1test', 10);

    expect(result).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Generating fortune for zapper: zapper-pubkey'));

    consoleSpy.mockRestore();
  });

  it('should handle invalid zap receipt', async () => {
    const zapReceipt: NostrEvent = {
      id: 'receipt-id',
      pubkey: 'lightning-service-pubkey',
      created_at: 1234567890,
      kind: 9735,
      tags: [], // No description tag
      content: '',
      sig: 'receipt-sig',
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await handleZapReceived(zapReceipt, 'original-event-id', 'nsec1test', 10);

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('Could not extract zapper pubkey from zap receipt');

    consoleSpy.mockRestore();
  });

  it('should handle publishing failure', async () => {
    const zapReceipt: NostrEvent = {
      id: 'receipt-id',
      pubkey: 'lightning-service-pubkey',
      created_at: 1234567890,
      kind: 9735,
      tags: [
        ['description', JSON.stringify({ pubkey: 'zapper-pubkey' })],
        ['bolt11', 'invoice'],
      ],
      content: '',
      sig: 'receipt-sig',
    };

    // Mock publishing failure
    vi.mocked(publishEvent).mockRejectedValue(new Error('Publish failed'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await handleZapReceived(zapReceipt, 'original-event-id', 'nsec1test', 10);

    expect(result).toBe(false);

    consoleSpy.mockRestore();
  });
});
