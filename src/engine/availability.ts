import type { AvailabilityWindow } from './types';

/** Overlap in minutes between two windows on the same day (0 when disjoint). */
export function windowOverlapMinutes(
  a: AvailabilityWindow,
  b: AvailabilityWindow,
): number {
  if (a.day !== b.day) return 0;
  const start = Math.max(a.startMin, b.startMin);
  const end = Math.min(a.endMin, b.endMin);
  return Math.max(0, end - start);
}

/** The intersected window of two overlapping windows, or null. */
export function intersectWindows(
  a: AvailabilityWindow,
  b: AvailabilityWindow,
): AvailabilityWindow | null {
  if (windowOverlapMinutes(a, b) === 0) return null;
  return {
    day: a.day,
    startMin: Math.max(a.startMin, b.startMin),
    endMin: Math.min(a.endMin, b.endMin),
  };
}

export interface SharedAvailability {
  totalMinutes: number;
  windows: AvailabilityWindow[];
}

/**
 * Total weekly shared minutes and the concrete shared windows between two
 * schedules. Windows within one schedule are treated as non-overlapping
 * (the app's availability picker enforces this); overlapping inputs simply
 * produce duplicate shared segments rather than an error.
 */
export function sharedAvailability(
  a: AvailabilityWindow[],
  b: AvailabilityWindow[],
): SharedAvailability {
  const windows: AvailabilityWindow[] = [];
  let totalMinutes = 0;
  for (const wa of a) {
    for (const wb of b) {
      const shared = intersectWindows(wa, wb);
      if (shared) {
        windows.push(shared);
        totalMinutes += shared.endMin - shared.startMin;
      }
    }
  }
  windows.sort((x, y) => x.day - y.day || x.startMin - y.startMin);
  return { totalMinutes, windows };
}
