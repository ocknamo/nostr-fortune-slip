/**
 * ランダムな8byteの値を生成してbase64urlエンコードした文字列を返す
 * @returns base64urlエンコードされた8byteのランダム文字列（URL safe）
 */
export function generateRandomBase64(): string {
  // 8バイトのランダムな値を生成
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);

  // base64エンコード
  const base64 = btoa(String.fromCharCode(...randomBytes));

  // base64urlに変換（URL safe）
  // + を - に、/ を _ に変換し、パディングの = を削除
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return base64url;
}
