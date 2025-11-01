import { describe, it, expect } from 'vitest';
import { generateRandomBase64 } from './random';

describe('generateRandomBase64', () => {
  it('should generate a base64 encoded string with correct length', () => {
    const result = generateRandomBase64();

    // 8byteをbase64エンコードすると12文字になる（8 * 8 / 6 = 10.67 -> 12文字）
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThanOrEqual(11); // base64パディングを考慮
    expect(result.length).toBeLessThanOrEqual(12);
  });
});
