import type { SkillTier } from './types';

/** Ordinal encoding of tiers for distance computation. */
export const TIER_ORDER: Record<SkillTier, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

/** USA Pickleball rating bands backing each tier (documented in Chapter 1). */
export const TIER_RATING_BANDS: Record<SkillTier, { min: number; max: number }> = {
  beginner: { min: 2.0, max: 2.5 },
  intermediate: { min: 3.0, max: 3.5 },
  advanced: { min: 4.0, max: 5.5 },
};

export function tierDistance(a: SkillTier, b: SkillTier): number {
  return Math.abs(TIER_ORDER[a] - TIER_ORDER[b]);
}

/** Map a numeric USA Pickleball rating to its tier. */
export function tierFromRating(rating: number): SkillTier {
  if (rating < 3.0) return 'beginner';
  if (rating < 4.0) return 'intermediate';
  return 'advanced';
}

/** Midpoint rating of a tier band; used when a player gave no numeric rating. */
export function tierMidpoint(tier: SkillTier): number {
  const band = TIER_RATING_BANDS[tier];
  return (band.min + band.max) / 2;
}
