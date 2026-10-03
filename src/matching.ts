/** Loading shared by the matchmaking, doubles and algorithm routes. */
import { loadEngagements, loadPublicPlayers, withPrecise } from './data';
import { InteractionMatrix } from './engine';
import type { EngagementRecord } from './engine';
import { db } from './firebase';
import type { PublicPlayer } from './types';

export interface ScoringData {
  /** Public profiles (coarse location) of every opted-in player plus any `extraIds` that exist. Safe to return. */
  publicById: Map<string, PublicPlayer>;
  /** The same players with the private GPS fix on `location`. For scoring only — never return these. */
  preciseById: Map<string, PublicPlayer>;
  /** Ids of the opted-in players (the candidate pool). */
  optedInIds: string[];
  engagements: EngagementRecord[];
  matrix: InteractionMatrix;
}

/** `extraIds` (the seeker, a partner) are loaded even when they have not opted in. */
export async function loadScoringData(extraIds: string[] = []): Promise<ScoringData> {
  const optedIn = await loadPublicPlayers();
  const publicById = new Map(optedIn.map((p) => [p.id, p]));
  for (const id of extraIds) {
    if (publicById.has(id)) continue;
    const snap = await db.collection('users').doc(id).get();
    if (snap.exists) publicById.set(id, { ...(snap.data() as PublicPlayer), id });
  }
  const [precise, engagements] = await Promise.all([withPrecise([...publicById.values()]), loadEngagements()]);
  return {
    publicById,
    preciseById: new Map(precise.map((p) => [p.id, p])),
    optedInIds: optedIn.map((p) => p.id),
    engagements,
    matrix: new InteractionMatrix(engagements),
  };
}
