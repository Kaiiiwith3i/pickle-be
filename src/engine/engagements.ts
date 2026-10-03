import type { EngagementRecord } from './types';

/** Minimal shapes of the app records the collaborative stage learns from. */
export interface EngagementSession {
  id: string;
  startsAt: string; // ISO
  durationMin: number;
  attendeeIds: string[];
}

export interface EngagementMatch {
  id: string;
  kind: string;
  authorId: string;
  opponentId?: string;
  confirmed?: boolean;
  disputed?: boolean;
}

/**
 * The feedback loop (Chapter 3, Step 7): co-engagement records are derived
 * from what already happened — sessions that have ended and match results both
 * players stand behind. Derived on demand, so there is no second store to keep
 * in sync. Data shaping only; scoring stays in `scorePair`.
 */
export function deriveEngagements(
  sessions: EngagementSession[],
  posts: EngagementMatch[],
  now: number = Date.now(),
): EngagementRecord[] {
  const attended = sessions
    .filter((s) => Date.parse(s.startsAt) + s.durationMin * 60_000 <= now)
    .flatMap((s) => s.attendeeIds.map((playerId) => ({ playerId, itemId: s.id })));
  const played = posts
    .filter((p) => p.kind === 'match_summary' && p.confirmed && !p.disputed && p.opponentId)
    .flatMap((p) => [p.authorId, p.opponentId!].map((playerId) => ({ playerId, itemId: p.id })));
  return [...attended, ...played];
}
