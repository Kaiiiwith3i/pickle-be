import type { PlayerProfile } from './types';
import { haversineKm } from './geo';
import { sharedAvailability } from './availability';
import { tierMidpoint } from './tiers';
import { clamp01 } from './vector';

/**
 * Content-based compatibility (Stage 2a) — the cold-start path. Each player is
 * encoded as an interpretable feature vector (skill rating, weekly schedule,
 * travel distance, play intent, format) and pairwise compatibility is a
 * calibrated weighted agreement over those features, so that S ≈ 1 means
 * "plays the same level, genuinely overlapping schedule, nearby, wants the
 * same kind of game" and the thesis's τ ladder (0.75–0.95) cuts through the
 * meaningful range of the distribution.
 *
 * Component weights (sum = 1). Skill parity dominates by design — the
 * manuscript's core problem is skill-mismatched pairings.
 */
export const CONTENT_WEIGHTS = {
  skill: 0.35,
  schedule: 0.3,
  distance: 0.15,
  intent: 0.12,
  format: 0.08,
} as const;

export function effectiveRating(p: PlayerProfile): number {
  return p.rating ?? tierMidpoint(p.tier);
}

/** 1.0 at rating parity, decaying past the USA Pickleball "plays well" band. */
export function skillAgreement(gap: number): number {
  if (gap <= 0.25) return 1;
  if (gap <= 0.5) return 0.9;
  if (gap <= 0.75) return 0.8;
  if (gap <= 1.0) return 0.55;
  if (gap <= 1.5) return 0.3;
  return 0.1;
}

/** Saturates at 3 shared hours per week; the 60-min gate floor maps to 0.65. */
export function scheduleAgreement(sharedMinutes: number): number {
  if (sharedMinutes >= 180) return 1;
  if (sharedMinutes >= 120) return 0.9;
  if (sharedMinutes >= 90) return 0.8;
  if (sharedMinutes >= 60) return 0.65;
  return clamp01(sharedMinutes / 90);
}

/** Corridor-scale travel tolerance. */
export function distanceAgreement(km: number): number {
  if (km <= 3) return 1;
  if (km <= 6) return 0.9;
  if (km <= 10) return 0.8;
  if (km <= 15) return 0.65;
  return 0.4;
}

export function intentAgreement(a: PlayerProfile, b: PlayerProfile): number {
  if (a.intent === b.intent) return 1;
  if (a.intent === 'both' || b.intent === 'both') return 1;
  return 0.4;
}

export function formatAgreement(a: PlayerProfile, b: PlayerProfile): number {
  if (a.format === b.format) return 1;
  if (a.format === 'both' || b.format === 'both') return 1;
  return 0.7;
}

/** Content score ∈ [0,1] from observed onboarding data only. */
export function contentSimilarity(a: PlayerProfile, b: PlayerProfile): number {
  const gap = Math.abs(effectiveRating(a) - effectiveRating(b));
  const shared = sharedAvailability(a.availability, b.availability);
  const km = haversineKm(a.location, b.location);
  return clamp01(
    CONTENT_WEIGHTS.skill * skillAgreement(gap) +
      CONTENT_WEIGHTS.schedule * scheduleAgreement(shared.totalMinutes) +
      CONTENT_WEIGHTS.distance * distanceAgreement(km) +
      CONTENT_WEIGHTS.intent * intentAgreement(a, b) +
      CONTENT_WEIGHTS.format * formatAgreement(a, b),
  );
}
