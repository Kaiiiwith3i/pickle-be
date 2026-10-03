import { tierDistance, tierFromRating, tierMidpoint, TIER_RATING_BANDS } from '../../src/engine/tiers';

describe('tierDistance', () => {
  it('is 0 for same tier, 1 for adjacent, 2 across the range', () => {
    expect(tierDistance('beginner', 'beginner')).toBe(0);
    expect(tierDistance('beginner', 'intermediate')).toBe(1);
    expect(tierDistance('intermediate', 'advanced')).toBe(1);
    expect(tierDistance('beginner', 'advanced')).toBe(2);
  });
});

describe('tierFromRating', () => {
  it('maps USA Pickleball ratings to bands', () => {
    expect(tierFromRating(2.0)).toBe('beginner');
    expect(tierFromRating(2.9)).toBe('beginner');
    expect(tierFromRating(3.0)).toBe('intermediate');
    expect(tierFromRating(3.9)).toBe('intermediate');
    expect(tierFromRating(4.0)).toBe('advanced');
    expect(tierFromRating(5.5)).toBe('advanced');
  });
});

describe('tierMidpoint', () => {
  it('sits inside each band', () => {
    for (const tier of ['beginner', 'intermediate', 'advanced'] as const) {
      const band = TIER_RATING_BANDS[tier];
      const mid = tierMidpoint(tier);
      expect(mid).toBeGreaterThanOrEqual(band.min);
      expect(mid).toBeLessThanOrEqual(band.max);
    }
  });
});
