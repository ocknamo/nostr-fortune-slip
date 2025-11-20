import { SimplePool } from 'nostr-tools';
import type { NostrEvent } from './types.js';
import { RELAYS } from './relay.js';

/**
 * リレーにイベントを送信
 */
export async function publishEvent(event: NostrEvent): Promise<void> {
  const pool = new SimplePool();

  try {
    // タイムアウト設定付きでイベントを送信
    const publishPromises = pool.publish(RELAYS, event);

    // 最低1つのリレーで成功すれば良いので、Promise.allSettledを使用
    const results = await Promise.allSettled(
      publishPromises.map((promise) =>
        Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Publish timeout')), 5000)),
        ]),
      ),
    );

    // 少なくとも1つのリレーで成功しているかチェック
    const successful = results.some((result) => result.status === 'fulfilled');

    if (!successful) {
      const errors = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason?.message || 'Unknown error');
      console.error('All relays failed:', errors);
      console.info('Failed event:', event);
      throw new Error(`Failed to publish to any relay. Errors: ${errors.join(', ')}`);
    }

    console.log('Event published successfully to at least one relay');
  } catch (error) {
    console.error('Failed to publish event:', error);
    throw new Error(`Failed to publish event to relays: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // 少し待ってからプールを閉じる
    setTimeout(() => {
      pool.close(RELAYS);
    }, 1000);
  }
}
