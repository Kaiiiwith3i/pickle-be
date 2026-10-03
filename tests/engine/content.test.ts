import {
  contentSimilarity,
  effectiveRating,
  skillAgreement,
  scheduleAgreement,
} from '../../src/engine/content';
import { makePlayer, SAT_MORNING, SAT_EVENING } from './fixtures';

describe('effectiveRating', () => {
  it('uses the tier midpoint when no numeric rating is given', () => {
    const p = makePlayer({ tier: 'beginner', rating: undefined });
    expect(effectiveRating(p)).toBeCloseTo(2.25);
  });
});

describe('agreement calibration', () => {
  it('skill agreement is monotonically non-increasing in the rating gap', () => {
    const gaps = [0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0];
    const values = gaps.map(skillAgreement);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
    }
    expect(skillAgreement(0)).toBe(1);
  });

  it('schedule agreement saturates at 3 shared hours', () => {
    expect(scheduleAgreement(180)).toBe(1);
    expect(scheduleAgreement(240)).toBe(1);
    expect(scheduleAgreement(60)).toBeLessThan(scheduleAgreement(120));
    expect(scheduleAgreement(0)).toBe(0);
  });
});

describe('contentSimilarity', () => {
  it('scores identically-configured players at ~1', () => {
    const a = makePlayer({ rating: 3.5 });
    const b = makePlayer({ rating: 3.5 });
    expect(contentSimilarity(a, b)).toBeGreaterThan(0.99);
  });

  it('penalizes large skill gaps even when schedules align', () => {
    const a = makePlayer({ rating: 2.0 });
    const b = makePlayer({ rating: 5.5 });
    const c = makePlayer({ rating: 2.5 });
    expect(contentSimilarity(a, b)).toBeLessThan(contentSimilarity(a, c));
  });

  it('scores disjoint schedules lower than aligned ones', () => {
    const base = makePlayer({ availability: [SAT_MORNING] });
    const aligned = makePlayer({ availability: [SAT_MORNING] });
    const disjoint = makePlayer({ availability: [SAT_EVENING] });
    expect(contentSimilarity(base, aligned)).toBeGreaterThan(
      contentSimilarity(base, disjoint),
    );
  });

  it('scores mismatched intent lower than matching intent', () => {
    const casual = makePlayer({ intent: 'casual' });
    const casual2 = makePlayer({ intent: 'casual' });
    const competitive = makePlayer({ intent: 'competitive' });
    expect(contentSimilarity(casual, casual2)).toBeGreaterThan(
      contentSimilarity(casual, competitive),
    );
  });

  it('stays within [0, 1]', () => {
    const a = makePlayer({ rating: 2.0, intent: 'casual', format: 'singles' });
    const b = makePlayer({ rating: 5.5, intent: 'competitive', format: 'doubles' });
    const s = contentSimilarity(a, b);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});
