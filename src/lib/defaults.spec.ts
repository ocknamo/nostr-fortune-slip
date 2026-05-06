import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FORTUNE_TEXTS_CSV,
  DEFAULT_NO_CONFETTI_TEXTS_CSV,
  isValidRelayUrl,
  parseCsv,
} from './defaults.js';

describe('parseCsv', () => {
  it('returns trimmed non-empty entries from a CSV string', () => {
    expect(parseCsv('大吉, 中吉 ,小吉')).toEqual(['大吉', '中吉', '小吉']);
  });

  it('drops empty and whitespace-only entries', () => {
    expect(parseCsv('a,, ,b')).toEqual(['a', 'b']);
  });

  it('returns an empty array for an empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('parses the default fortune CSV into seven entries', () => {
    expect(parseCsv(DEFAULT_FORTUNE_TEXTS_CSV)).toHaveLength(7);
  });

  it('parses the default no-confetti CSV into 凶 and 大凶', () => {
    expect(parseCsv(DEFAULT_NO_CONFETTI_TEXTS_CSV)).toEqual(['凶', '大凶']);
  });
});

describe('isValidRelayUrl', () => {
  it('accepts wss:// URLs', () => {
    expect(isValidRelayUrl('wss://relay.damus.io/')).toBe(true);
  });

  it('accepts ws:// URLs', () => {
    expect(isValidRelayUrl('ws://localhost:8080')).toBe(true);
  });

  it('rejects http:// URLs', () => {
    expect(isValidRelayUrl('http://relay.damus.io/')).toBe(false);
  });

  it('rejects https:// URLs', () => {
    expect(isValidRelayUrl('https://relay.damus.io/')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isValidRelayUrl('')).toBe(false);
  });

  it('rejects bare URLs without scheme', () => {
    expect(isValidRelayUrl('relay.damus.io')).toBe(false);
  });
});
