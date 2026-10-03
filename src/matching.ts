/** Loading shared by the matchmaking, doubles and algorithm routes. */
import { loadEngagements, loadPublicPlayers } from './data';
import { InteractionMatrix } from './engine';
import type { EngagementRecord } from './engine';
import { db } from './firebase';
import type { PublicPlayer } from './types';

export interface ScoringData {
  /** Public profiles (coarse location) of every opted-in player plus any `extraIds` that exist. Safe to return. */
  publicById: Map<string, PublicPlayer>;
  /**
   * What the engine scores: the same players, except the caller's own entry carries their private GPS fix.
   * Everyone else stays on the coarse location, so no response can reveal another player's fix (RA 10173).
   * For scoring only — never return these.
   */
  scoringById: Map<string, PublicPlayer>;
  /** Ids of the opted-in players (the candidate pool). */
  optedInIds: string[];
  engagements: EngagementRecord[];
  matrix: InteractionMatrix;
}

/** `extraIds` (the seeker, a partner) are loaded even when they have not opted in. `callerId` is the only player scored on a GPS fix. */
export async function loadScoringData(callerId: string, extraIds: string[] = []): Promise<ScoringData> {
  const optedIn = await loadPublicPlayers();
  const publicById = new Map(optedIn.map((p) => [p.id, p]));
  for (const id of extraIds) {
    if (publicById.has(id)) continue;
    const snap = await db.collection('users').doc(id).get();
    if (snap.exists) publicById.set(id, { ...(snap.data() as PublicPlayer), id });
  }
  const scoringById = new Map(publicById);
  const mine = scoringById.get(callerId);
  if (mine) {
    const fix = (await db.collection('users').doc(callerId).collection('private').doc('profile').get()).data()?.preciseLocation;
    if (fix) scoringById.set(callerId, { ...mine, location: fix });
  }
  const engagements = await loadEngagements();
  return {
    publicById,
    scoringById,
    optedInIds: optedIn.map((p) => p.id),
    engagements,
    matrix: new InteractionMatrix(engagements),
  };
}
