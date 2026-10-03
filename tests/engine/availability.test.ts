import {
  windowOverlapMinutes,
  intersectWindows,
  sharedAvailability,
} from '../../src/engine/availability';
import { SAT_MORNING, SAT_EVENING, SUN_MORNING } from './fixtures';

describe('windowOverlapMinutes', () => {
  it('computes same-day overlap', () => {
    expect(
      windowOverlapMinutes(
        { day: 6, startMin: 360, endMin: 600 },
        { day: 6, startMin: 480, endMin: 720 },
      ),
    ).toBe(120);
  });

  it('returns 0 for different days even with same clock times', () => {
    expect(windowOverlapMinutes(SAT_MORNING, SUN_MORNING)).toBe(0);
  });

  it('returns 0 for adjacent-but-disjoint windows', () => {
    expect(windowOverlapMinutes(SAT_MORNING, SAT_EVENING)).toBe(0);
    expect(
      windowOverlapMinutes(
        { day: 6, startMin: 360, endMin: 600 },
        { day: 6, startMin: 600, endMin: 700 },
      ),
    ).toBe(0);
  });
});

describe('intersectWindows', () => {
  it('returns the concrete shared window', () => {
    expect(
      intersectWindows(
        { day: 3, startMin: 1020, endMin: 1260 },
        { day: 3, startMin: 1140, endMin: 1320 },
      ),
    ).toEqual({ day: 3, startMin: 1140, endMin: 1260 });
  });

  it('returns null when disjoint', () => {
    expect(intersectWindows(SAT_MORNING, SAT_EVENING)).toBeNull();
  });
});

describe('sharedAvailability', () => {
  it('sums minutes across multiple shared windows and sorts them', () => {
    const a = [
      { day: 6, startMin: 360, endMin: 600 },
      { day: 2, startMin: 1020, endMin: 1200 },
    ] as const;
    const b = [
      { day: 2, startMin: 1080, endMin: 1260 },
      { day: 6, startMin: 480, endMin: 660 },
    ] as const;
    const shared = sharedAvailability([...a], [...b]);
    expect(shared.totalMinutes).toBe(120 + 120);
    expect(shared.windows).toEqual([
      { day: 2, startMin: 1080, endMin: 1200 },
      { day: 6, startMin: 480, endMin: 600 },
    ]);
  });

  it('returns zero for players with no common slot', () => {
    expect(sharedAvailability([SAT_MORNING], [SUN_MORNING]).totalMinutes).toBe(0);
  });
});
