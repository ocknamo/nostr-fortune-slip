import { nip19 } from 'nostr-tools';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getResultEventMessage } from './message-text';

// Mock nostr-tools
vi.mock('nostr-tools', () => ({
  SimplePool: vi.fn(),
  getPublicKey: vi.fn(),
  finalizeEvent: vi.fn(),
  nip19: {
    npubEncode: vi.fn(),
  },
}));

describe('getResultEventMessage', () => {
  beforeEach(() => {
    vi.mocked(nip19.npubEncode).mockReturnValue('npub1testencoded');
  });

  it('should create correctly formatted message', () => {
    const zapperPubkey = 'test-pubkey';
    const luckyNumber = 42;

    const message = getResultEventMessage(zapperPubkey, luckyNumber);

    expect(nip19.npubEncode).toHaveBeenCalledWith(zapperPubkey);
    expect(message).toContain('nostr:npub1testencoded');
    expect(message).toContain(`Your omikuji number is “${luckyNumber}”!`);
  });

  it('should handle different lucky numbers', () => {
    const zapperPubkey = 'test-pubkey';

    const message1 = getResultEventMessage(zapperPubkey, 1);
    const message100 = getResultEventMessage(zapperPubkey, 100);

    expect(message1).toContain('Your omikuji number is “1”!');
    expect(message100).toContain('Your omikuji number is “100”!');
  });
});
