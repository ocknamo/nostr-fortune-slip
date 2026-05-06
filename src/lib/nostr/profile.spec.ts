import { describe, expect, it, vi } from 'vitest';
import { npubToHex, getLud16FromKind0, getDisplayNameFromKind0 } from './profile.js';
import type { NostrEvent } from './types.js';

vi.mock('nostr-tools', () => ({
  SimplePool: vi.fn(),
  verifyEvent: vi.fn(),
  nip19: {
    decode: vi.fn((input: string) => {
      if (input === 'npub1valid') return { type: 'npub', data: 'abcdef1234567890' };
      if (input === 'nsec1invalid') return { type: 'nsec', data: 'secret' };
      throw new Error('Invalid bech32');
    }),
  },
}));

vi.mock('./relay.js', () => ({ RELAYS: [], DEFAULT_RELAYS: [], getRelays: () => [] }));

function makeKind0(content: object): NostrEvent {
  return {
    kind: 0,
    id: 'test-id',
    pubkey: 'test-pubkey',
    created_at: 1000000,
    tags: [],
    content: JSON.stringify(content),
    sig: 'test-sig',
  };
}

describe('npubToHex', () => {
  it('valid npub を hex に変換する', () => {
    expect(npubToHex('npub1valid')).toBe('abcdef1234567890');
  });

  it('nsec など npub 以外の形式で throw する', () => {
    expect(() => npubToHex('nsec1invalid')).toThrow('Invalid npub');
  });

  it('不正な文字列で throw する', () => {
    expect(() => npubToHex('notbech32')).toThrow();
  });
});

describe('getLud16FromKind0', () => {
  it('lud16 を持つ kind 0 から値を返す', () => {
    const kind0 = makeKind0({ lud16: 'user@example.com' });
    expect(getLud16FromKind0(kind0)).toBe('user@example.com');
  });

  it('lud16 がない kind 0 で null を返す', () => {
    const kind0 = makeKind0({ name: 'Alice' });
    expect(getLud16FromKind0(kind0)).toBeNull();
  });

  it('content が invalid JSON で null を返す', () => {
    const kind0 = { ...makeKind0({}), content: 'not json' };
    expect(getLud16FromKind0(kind0)).toBeNull();
  });
});

describe('getDisplayNameFromKind0', () => {
  it('display_name を優先して返す', () => {
    const kind0 = makeKind0({ display_name: 'Alice Display', name: 'alice' });
    expect(getDisplayNameFromKind0(kind0)).toBe('Alice Display');
  });

  it('display_name がない場合は name を返す', () => {
    const kind0 = makeKind0({ name: 'alice' });
    expect(getDisplayNameFromKind0(kind0)).toBe('alice');
  });

  it('どちらもない場合は空文字を返す', () => {
    const kind0 = makeKind0({ about: 'no name here' });
    expect(getDisplayNameFromKind0(kind0)).toBe('');
  });

  it('content が invalid JSON で空文字を返す', () => {
    const kind0 = { ...makeKind0({}), content: '{broken' };
    expect(getDisplayNameFromKind0(kind0)).toBe('');
  });
});
