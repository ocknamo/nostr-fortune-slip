export const OPENSATS_ADDRESS = 'opensats@npub.cash';
export const DEFAULT_FORTUNE_TEXTS = '大吉,中吉,小吉,吉,末吉,凶,大凶';

export interface SettingsFormState {
  lightningAddress: string;
  nostrPrivateKey: string;
  pinCode: string;
  zapAmount: number;
  fortuneMin: number;
  fortuneMax: number;
}

export type SettingsErrors = Record<string, string>;

export function validateForm(state: SettingsFormState, testMode = false): SettingsErrors {
  const errors: SettingsErrors = {};

  if (!testMode) {
    if (!state.lightningAddress.trim()) {
      errors.lightningAddress = 'ライトニングアドレスは必須です';
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(state.lightningAddress)) {
      errors.lightningAddress = '正しいメールアドレス形式で入力してください（例：user@domain.com）';
    }

    if (!state.nostrPrivateKey.trim()) {
      errors.nostrPrivateKey = 'Nostr秘密鍵は必須です';
    } else if (!state.nostrPrivateKey.startsWith('nsec1')) {
      errors.nostrPrivateKey = 'nsec1で始まる有効な秘密鍵を入力してください';
    }
  } else if (state.lightningAddress.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(state.lightningAddress)) {
    errors.lightningAddress = '正しいメールアドレス形式で入力してください（例：user@domain.com）';
  } else if (state.nostrPrivateKey.trim() && !state.nostrPrivateKey.startsWith('nsec1')) {
    errors.nostrPrivateKey = 'nsec1で始まる有効な秘密鍵を入力してください';
  }

  if (!state.pinCode.trim()) {
    errors.pinCode = 'PINは必須です';
  } else if (!/^\d{4}$/.test(state.pinCode)) {
    errors.pinCode = '4桁の数字を入力してください';
  }

  if (!state.zapAmount || state.zapAmount < 1 || state.zapAmount > 1000) {
    errors.zapAmount = 'Zap金額は1〜1000 satsの範囲で入力してください';
  } else if (!Number.isInteger(state.zapAmount)) {
    errors.zapAmount = 'Zap金額は整数で入力してください';
  }

  if (!state.fortuneMin || !Number.isInteger(state.fortuneMin) || state.fortuneMin < 1) {
    errors.fortuneMin = '最小値は1以上の整数を入力してください';
  }
  if (!state.fortuneMax || !Number.isInteger(state.fortuneMax) || state.fortuneMax < 1) {
    errors.fortuneMax = '最大値は1以上の整数を入力してください';
  }
  if (state.fortuneMin && state.fortuneMax && state.fortuneMin >= state.fortuneMax) {
    errors.fortuneMin = '最小値は最大値より小さくしてください';
    errors.fortuneMax = '最大値は最小値より大きくしてください';
  }

  return errors;
}

export function applyDefaultFortuneTexts(
  enabled: boolean,
  currentTexts: string,
  savedTexts: string,
): { fortuneTexts: string; savedFortuneTexts: string } {
  if (enabled) {
    return { fortuneTexts: DEFAULT_FORTUNE_TEXTS, savedFortuneTexts: currentTexts };
  }
  return { fortuneTexts: savedTexts, savedFortuneTexts: savedTexts };
}

export function applyDonateToOpenSats(
  enabled: boolean,
  currentAddress: string,
  savedAddress: string,
): { lightningAddress: string; savedLightningAddress: string } {
  if (enabled) {
    return { lightningAddress: OPENSATS_ADDRESS, savedLightningAddress: currentAddress };
  }
  return { lightningAddress: savedAddress, savedLightningAddress: savedAddress };
}
