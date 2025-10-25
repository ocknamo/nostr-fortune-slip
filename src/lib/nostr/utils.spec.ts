import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { publishEvent } from './utils.js';
import type { NostrEvent } from './types.js';
import { SimplePool } from 'nostr-tools';

// Mock nostr-tools
vi.mock('nostr-tools', () => ({
  SimplePool: vi.fn(),
}));

describe('publishEvent', () => {
  let mockPoolInstance: any;

  beforeEach(() => {
    mockPoolInstance = {
      publish: vi.fn(),
      close: vi.fn(),
    };
    vi.mocked(SimplePool).mockImplementation(() => mockPoolInstance);
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should publish event successfully', async () => {
    const mockEvent: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'test content',
      sig: 'test-sig',
    };

    // Mock successful publish
    const mockPromise = Promise.resolve('success');
    mockPoolInstance.publish.mockReturnValue([mockPromise]);

    const publishPromise = publishEvent(mockEvent);

    await publishPromise;

    // Fast forward timers for cleanup
    vi.advanceTimersByTime(1000);

    expect(mockPoolInstance.publish).toHaveBeenCalledWith(expect.any(Array), mockEvent);
    expect(mockPoolInstance.close).toHaveBeenCalled();
  });

  it('should handle all relays failing', async () => {
    const mockEvent: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'test content',
      sig: 'test-sig',
    };

    // Mock all promises failing
    const mockPromise = Promise.reject(new Error('Relay connection failed'));
    mockPoolInstance.publish.mockReturnValue([mockPromise]);

    await expect(publishEvent(mockEvent)).rejects.toThrow('Failed to publish to any relay');
  });

  it('should succeed if at least one relay succeeds', async () => {
    const mockEvent: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'test content',
      sig: 'test-sig',
    };

    // Mock mixed results - one success, one failure
    const successPromise = Promise.resolve('success');
    const failPromise = Promise.reject(new Error('Failed'));
    mockPoolInstance.publish.mockReturnValue([successPromise, failPromise]);

    // Should not throw
    await expect(publishEvent(mockEvent)).resolves.toBeUndefined();

    expect(mockPoolInstance.publish).toHaveBeenCalledWith(expect.any(Array), mockEvent);

    // Fast forward timers for cleanup
    vi.advanceTimersByTime(1000);
    expect(mockPoolInstance.close).toHaveBeenCalled();
  });
});
