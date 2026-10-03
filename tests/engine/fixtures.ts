import type { AvailabilityWindow, PlayerProfile } from '../../src/engine/types';

/** Calamba city-center-ish default location. */
export const CALAMBA = { lat: 14.2117, lng: 121.1653 };
/** Los Baños (UPLB area). */
export const LOS_BANOS = { lat: 14.1699, lng: 121.2441 };
/** Manila — far outside the corridor. */
export const MANILA = { lat: 14.5995, lng: 120.9842 };

export const SAT_MORNING: AvailabilityWindow = { day: 6, startMin: 360, endMin: 600 };
export const SAT_EVENING: AvailabilityWindow = { day: 6, startMin: 1020, endMin: 1260 };
export const SUN_MORNING: AvailabilityWindow = { day: 0, startMin: 360, endMin: 600 };

let counter = 0;

export function makePlayer(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  counter += 1;
  return {
    id: overrides.id ?? `p${counter}`,
    displayName: overrides.displayName ?? `Player ${counter}`,
    tier: 'intermediate',
    location: CALAMBA,
    availability: [SAT_MORNING],
    format: 'doubles',
    intent: 'casual',
    matchmakingOptIn: true,
    ...overrides,
  };
}
