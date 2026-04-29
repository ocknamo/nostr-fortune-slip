import { describe, expect, it, vi } from 'vitest';
import { generateLuckyNumber, extractZapperPubkey, getFortuneText } from './fortune.js';
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

describe('getFortuneText', () => {
  it('should return the corresponding text for a lucky number', () => {
    const fortuneTexts = ['大吉', '中吉', '小吉', '凶'];

    expect(getFortuneText(1, fortuneTexts)).toBe('大吉');
    expect(getFortuneText(2, fortuneTexts)).toBe('中吉');
    expect(getFortuneText(3, fortuneTexts)).toBe('小吉');
    expect(getFortuneText(4, fortuneTexts)).toBe('凶');
  });

  it('should cycle through texts when number exceeds array length', () => {
    const fortuneTexts = ['大吉', '中吉', '凶'];

    // 4 should map to index 0 (4-1) % 3 = 0
    expect(getFortuneText(4, fortuneTexts)).toBe('大吉');
    // 5 should map to index 1 (5-1) % 3 = 1
    expect(getFortuneText(5, fortuneTexts)).toBe('中吉');
    // 6 should map to index 2 (6-1) % 3 = 2
    expect(getFortuneText(6, fortuneTexts)).toBe('凶');
    // 7 should map to index 0 (7-1) % 3 = 0
    expect(getFortuneText(7, fortuneTexts)).toBe('大吉');
  });

  it('should return null when fortune texts array is empty', () => {
    expect(getFortuneText(1, [])).toBe(null);
    expect(getFortuneText(5, [])).toBe(null);
  });

  it('should handle large numbers correctly', () => {
    const fortuneTexts = ['A', 'B', 'C'];

    expect(getFortuneText(100, fortuneTexts)).toBe('A'); // (100-1) % 3 = 0
    expect(getFortuneText(101, fortuneTexts)).toBe('B'); // (101-1) % 3 = 1
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
