/** Firestore reads shared by several route files. */
import { deriveEngagements } from './engine';
import type { EngagementMatch, EngagementRecord, EngagementSession } from './engine';
import { db } from './firebase';
import type { GeoPoint, PublicPlayer } from './types';

/** Every opted-in player's public profile (coarse location, no email or phone). */
export async function loadPublicPlayers(): Promise<PublicPlayer[]> {
  const snap = await db.collection('users').where('matchmakingOptIn', '==', true).get();
  return snap.docs.map((d) => ({ ...(d.data() as PublicPlayer), id: d.id }));
}

/**
 * The same players with the private GPS fix overlaid onto `location`.
 * For scoring and distance only — never put the result in a response.
 */
export async function withPrecise<T extends { id: string; location: GeoPoint }>(players: T[]): Promise<T[]> {
  const snap = await db.collectionGroup('private').get();
  const precise = new Map<string, GeoPoint>();
  for (const d of snap.docs) {
    const loc = d.data().preciseLocation;
    if (d.id === 'profile' && loc) precise.set(d.ref.parent.parent!.id, loc);
  }
  return players.map((p) => ({ ...p, location: precise.get(p.id) ?? p.location }));
}

/** Co-engagement records for the collaborative stage, derived from ended sessions and confirmed results. */
export async function loadEngagements(): Promise<EngagementRecord[]> {
  const [sessions, posts] = await Promise.all([db.collection('sessions').get(), db.collection('posts').get()]);
  return deriveEngagements(
    sessions.docs.map((d) => ({ ...d.data(), id: d.id }) as EngagementSession),
    posts.docs.map((d) => ({ ...d.data(), id: d.id }) as EngagementMatch),
  );
}
