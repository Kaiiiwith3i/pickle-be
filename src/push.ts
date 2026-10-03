/** Expo push delivery. Callers never await a failure: a push problem must not fail the request. */
import { db } from './firebase';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Expo push tokens live at `pushTokens/{uid}`; users without one are skipped. */
export async function loadTokens(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const snaps = await db.getAll(...userIds.map((id) => db.collection('pushTokens').doc(id)));
  return snaps.flatMap((s) => (s.exists ? [s.data()!.token as string] : []));
}

/** Expo accepts at most 100 messages per request. */
const BATCH = 100;

export function chunk<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}

/** Fire-and-forget. Skipped under the emulators so local runs and tests never reach Expo. */
export async function sendPush(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0 || process.env.FIRESTORE_EMULATOR_HOST) return;
  for (const batch of chunk(messages, BATCH)) {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) console.error(`push send failed with HTTP ${res.status}`);
    } catch (err) {
      console.error('push send failed', err);
    }
  }
}
