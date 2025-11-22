import { nip19 } from 'nostr-tools';

export function getTargetEventMessage(): string {
  return `Thank you for praying!
Please zap this post or the LN QR code.

参拝ありがとうございます！
この投稿か、LN の QR コードに Zap してください。

※会場で参拝してない人はこのポストにZapしないでね!`;
}

export function getResultEventMessage(
  zapperPubkey: string,
  luckeyNumber: number,
  tagText: string = 'nostrasia2025',
): string {
  const npub = nip19.npubEncode(zapperPubkey);
  const mention = `nostr:${npub}`;

  return `Your omikuji number is “${luckeyNumber}”!
Wishing you a wonderful year ahead.

おみくじの番号は"${luckeyNumber}"です！ 
良い一年になりますように。

#${tagText} ${mention}`;
}
