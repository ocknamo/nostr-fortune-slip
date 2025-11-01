/**
 * ランダムな8byteの値を生成してbase64エンコードした文字列を返す
 * @returns base64エンコードされた8byteのランダム文字列
 */
export function generateRandomBase64(): string {
  // 8バイトのランダムな値を生成
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);

  // base64エンコード
  const base64 = btoa(String.fromCharCode(...randomBytes));

  return base64;
}
