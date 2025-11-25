import { describe, expect, it, vi } from 'vitest';
import { generateLuckyNumber, extractZapperPubkey } from './fortune.js';
import type { NostrEvent } from './types.js';

// Mock nostr-tools
vi.mock('nostr-tools', () => ({
  getPublicKey: vi.fn(),
  finalizeEvent: vi.fn(),
  nip19: {
    npubEncode: vi.fn(),
  },
}));

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
