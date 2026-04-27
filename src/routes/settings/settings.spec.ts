import { describe, expect, it } from 'vitest';
import { OPENSATS_ADDRESS, validateForm } from './settings.js';

const validState = {
  lightningAddress: 'user@domain.com',
  nostrPrivateKey: 'nsec1validkey',
  pinCode: '1234',
  zapAmount: 100,
  fortuneMin: 1,
  fortuneMax: 20,
};

describe('validateForm', () => {
  describe('lightningAddress', () => {
    it('空の場合エラー', () => {
      const errors = validateForm({ ...validState, lightningAddress: '' });
      expect(errors.lightningAddress).toBe('ライトニングアドレスは必須です');
    });

    it('スペースのみの場合エラー', () => {
      const errors = validateForm({ ...validState, lightningAddress: '   ' });
      expect(errors.lightningAddress).toBe('ライトニングアドレスは必須です');
    });

    it('メール形式でない場合エラー', () => {
      const errors = validateForm({ ...validState, lightningAddress: 'notanemail' });
      expect(errors.lightningAddress).toBeDefined();
    });

    it('@がない場合エラー', () => {
      const errors = validateForm({ ...validState, lightningAddress: 'userdomain.com' });
      expect(errors.lightningAddress).toBeDefined();
    });

    it('正しいメール形式はエラーなし', () => {
      const errors = validateForm({ ...validState, lightningAddress: 'user@domain.com' });
      expect(errors.lightningAddress).toBeUndefined();
    });

    it('OpenSatsアドレスはエラーなし', () => {
      const errors = validateForm({ ...validState, lightningAddress: OPENSATS_ADDRESS });
      expect(errors.lightningAddress).toBeUndefined();
    });
  });

  describe('nostrPrivateKey', () => {
    it('空の場合エラー', () => {
      const errors = validateForm({ ...validState, nostrPrivateKey: '' });
      expect(errors.nostrPrivateKey).toBe('Nostr秘密鍵は必須です');
    });

    it('nsec1で始まらない場合エラー', () => {
      const errors = validateForm({ ...validState, nostrPrivateKey: 'npub1somekey' });
      expect(errors.nostrPrivateKey).toBe('nsec1で始まる有効な秘密鍵を入力してください');
    });

    it('nsec1で始まる場合エラーなし', () => {
      const errors = validateForm({ ...validState, nostrPrivateKey: 'nsec1validkey' });
      expect(errors.nostrPrivateKey).toBeUndefined();
    });
  });

  describe('pinCode', () => {
    it('空の場合エラー', () => {
      const errors = validateForm({ ...validState, pinCode: '' });
      expect(errors.pinCode).toBe('PINは必須です');
    });

    it('3桁の場合エラー', () => {
      const errors = validateForm({ ...validState, pinCode: '123' });
      expect(errors.pinCode).toBe('4桁の数字を入力してください');
    });

    it('5桁の場合エラー', () => {
      const errors = validateForm({ ...validState, pinCode: '12345' });
      expect(errors.pinCode).toBe('4桁の数字を入力してください');
    });

    it('数字以外を含む場合エラー', () => {
      const errors = validateForm({ ...validState, pinCode: '12ab' });
      expect(errors.pinCode).toBe('4桁の数字を入力してください');
    });

    it('4桁の数字はエラーなし', () => {
      const errors = validateForm({ ...validState, pinCode: '0000' });
      expect(errors.pinCode).toBeUndefined();
    });
  });

  describe('zapAmount', () => {
    it('0の場合エラー', () => {
      const errors = validateForm({ ...validState, zapAmount: 0 });
      expect(errors.zapAmount).toBeDefined();
    });

    it('1001の場合エラー', () => {
      const errors = validateForm({ ...validState, zapAmount: 1001 });
      expect(errors.zapAmount).toBeDefined();
    });

    it('1はエラーなし', () => {
      const errors = validateForm({ ...validState, zapAmount: 1 });
      expect(errors.zapAmount).toBeUndefined();
    });

    it('1000はエラーなし', () => {
      const errors = validateForm({ ...validState, zapAmount: 1000 });
      expect(errors.zapAmount).toBeUndefined();
    });
  });

  describe('fortuneMin / fortuneMax', () => {
    it('fortuneMinが0の場合エラー', () => {
      const errors = validateForm({ ...validState, fortuneMin: 0 });
      expect(errors.fortuneMin).toBeDefined();
    });

    it('fortuneMaxが0の場合エラー', () => {
      const errors = validateForm({ ...validState, fortuneMax: 0 });
      expect(errors.fortuneMax).toBeDefined();
    });

    it('fortuneMin >= fortuneMaxの場合両方エラー', () => {
      const errors = validateForm({ ...validState, fortuneMin: 10, fortuneMax: 10 });
      expect(errors.fortuneMin).toBe('最小値は最大値より小さくしてください');
      expect(errors.fortuneMax).toBe('最大値は最小値より大きくしてください');
    });

    it('fortuneMin > fortuneMaxの場合両方エラー', () => {
      const errors = validateForm({ ...validState, fortuneMin: 20, fortuneMax: 5 });
      expect(errors.fortuneMin).toBeDefined();
      expect(errors.fortuneMax).toBeDefined();
    });

    it('fortuneMin < fortuneMaxの場合エラーなし', () => {
      const errors = validateForm({ ...validState, fortuneMin: 1, fortuneMax: 20 });
      expect(errors.fortuneMin).toBeUndefined();
      expect(errors.fortuneMax).toBeUndefined();
    });
  });

  it('全項目正常な場合エラーなし', () => {
    const errors = validateForm(validState);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  describe('テストモード (testMode=true)', () => {
    it('lightningAddressが空でもエラーなし', () => {
      const errors = validateForm({ ...validState, lightningAddress: '' }, true);
      expect(errors.lightningAddress).toBeUndefined();
    });

    it('nostrPrivateKeyが空でもエラーなし', () => {
      const errors = validateForm({ ...validState, nostrPrivateKey: '' }, true);
      expect(errors.nostrPrivateKey).toBeUndefined();
    });

    it('両方空でもエラーなし', () => {
      const errors = validateForm({ ...validState, lightningAddress: '', nostrPrivateKey: '' }, true);
      expect(errors.lightningAddress).toBeUndefined();
      expect(errors.nostrPrivateKey).toBeUndefined();
    });

    it('入力済みのlightningAddressが不正形式の場合はエラー', () => {
      const errors = validateForm({ ...validState, lightningAddress: 'notanemail' }, true);
      expect(errors.lightningAddress).toBeDefined();
    });

    it('入力済みのnostrPrivateKeyがnsec1で始まらない場合はエラー', () => {
      const errors = validateForm({ ...validState, nostrPrivateKey: 'npub1somekey' }, true);
      expect(errors.nostrPrivateKey).toBeDefined();
    });

    it('pinCode・zapAmount・fortuneMin/Maxのバリデーションは通常通り動作する', () => {
      const errors = validateForm({ ...validState, lightningAddress: '', nostrPrivateKey: '', pinCode: '' }, true);
      expect(errors.pinCode).toBe('PINは必須です');
    });
  });
});
