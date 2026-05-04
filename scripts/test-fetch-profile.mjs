/**
 * Nostr プロフィール取得の統合テスト
 * pool.get() が実際にリレーから kind 0 を取得できるか確認する
 *
 * 実行: node --experimental-vm-modules scripts/test-fetch-profile.mjs
 * または: npx tsx scripts/test-fetch-profile.mjs
 */
import { SimplePool, nip19, verifyEvent } from 'nostr-tools';

const RELAYS = [
  'wss://relay.damus.io/',
  'wss://r.kojira.io/',
  'wss://yabu.me',
  'wss://relay.snort.social',
  'wss://nostr.bitcoiner.social',
];

const TARGET_NPUB = 'npub1y6aja0kkc4fdvuxgqjcdv4fx0v7xv2epuqnddey2eyaxquznp9vq0tp75l';

async function main() {
  console.log('=== Nostr profile fetch integration test ===\n');

  // 1. npub → hex デコード
  const decoded = nip19.decode(TARGET_NPUB);
  if (decoded.type !== 'npub') {
    console.error('ERROR: not an npub');
    process.exit(1);
  }
  const pubkeyHex = decoded.data;
  console.log(`pubkey (hex): ${pubkeyHex}\n`);

  // 2. pool.get() で kind 0 を取得
  const pool = new SimplePool();
  console.log(`Querying ${RELAYS.length} relays...`);
  const startTime = Date.now();

  try {
    const event = await pool.get(RELAYS, { kinds: [0], authors: [pubkeyHex] });
    const elapsed = Date.now() - startTime;

    if (!event) {
      console.error(`RESULT: null (${elapsed}ms) — どのリレーからも取得できなかった`);
      process.exit(1);
    }

    console.log(`RESULT: kind 0 取得成功 (${elapsed}ms)\n`);

    // 3. 署名検証
    const valid = verifyEvent(event);
    console.log(`署名検証: ${valid ? '✓ PASS' : '✗ FAIL'}`);

    // 4. 内容確認
    const content = JSON.parse(event.content);
    console.log('\n--- kind 0 metadata ---');
    console.log(`id:           ${event.id}`);
    console.log(`pubkey:       ${event.pubkey}`);
    console.log(`created_at:   ${new Date(event.created_at * 1000).toISOString()}`);
    console.log(`name:         ${content.name ?? '(なし)'}`);
    console.log(`display_name: ${content.display_name ?? '(なし)'}`);
    console.log(`lud16:        ${content.lud16 ?? '(なし)'}`);
    console.log(`picture:      ${content.picture ? content.picture.slice(0, 60) + '...' : '(なし)'}`);

    // 5. pubkey 一致チェック
    if (event.pubkey !== pubkeyHex) {
      console.error(`\n✗ MISMATCH: event.pubkey (${event.pubkey}) !== requested (${pubkeyHex})`);
    } else {
      console.log('\n✓ pubkey 一致確認OK');
    }

  } finally {
    pool.close(RELAYS);
  }
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
