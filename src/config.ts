import { CALIBRATED_TAU, TIER_RATING_BANDS } from './engine';
import type { Area, Config } from './types';

/** Coarse home areas: the public location a player shows instead of a GPS fix. */
export const AREAS: Area[] = [
  { label: 'Calamba Poblacion', lat: 14.2117, lng: 121.1653 },
  { label: 'Mayapa, Calamba', lat: 14.2246, lng: 121.1265 },
  { label: 'Canlubang, Calamba', lat: 14.2634, lng: 121.0873 },
  { label: 'Halang, Calamba', lat: 14.1946, lng: 121.1554 },
  { label: 'Real, Calamba', lat: 14.2044, lng: 121.1739 },
  { label: 'Pansol, Calamba', lat: 14.1893, lng: 121.1998 },
  { label: 'Batong Malake, Los Baños', lat: 14.1735, lng: 121.2438 },
  { label: 'UPLB, Los Baños', lat: 14.1622, lng: 121.2415 },
  { label: 'Anos, Los Baños', lat: 14.1755, lng: 121.2245 },
];

/** The thresholds the harness evaluates (`TAUS` in scripts/evaluate.ts). */
export const TAU_LADDER = [0.75, 0.8, 0.85, 0.9, 0.95];

/** Hourly booking slots, 6:00 to 21:00. */
export const BOOKING_SLOTS = { startMin: 360, endMin: 1260, stepMin: 60 };

export const CONFIG: Config = {
  areas: AREAS,
  tierBands: TIER_RATING_BANDS,
  tau: CALIBRATED_TAU,
  tauLadder: TAU_LADDER,
  bookingSlots: BOOKING_SLOTS,
};
