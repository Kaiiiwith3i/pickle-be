import type { EngineConfig, GateReport, PlayerProfile } from './types';
import { haversineKm, inBoundary } from './geo';
import { sharedAvailability } from './availability';
import { tierDistance } from './tiers';

/**
 * Stage 1 — deterministic filtering. Three hard Boolean predicates
 * (Chapter 3, Step 3): geospatial containment + distance, temporal
 * availability intersection, and the skill-tier adjacency gate.
 * Produces a full report per candidate for UI explainability.
 */
export function evaluateGate(
  seeker: PlayerProfile,
  candidate: PlayerProfile,
  config: EngineConfig,
): GateReport {
  const distanceKm = haversineKm(seeker.location, candidate.location);
  const boundaryOk = inBoundary(candidate.location, config.boundary);
  const distanceOk = distanceKm <= config.maxDistanceKm;

  const shared = sharedAvailability(seeker.availability, candidate.availability);
  const overlapOk = shared.totalMinutes >= config.minOverlapMinutes;

  const tDist = tierDistance(seeker.tier, candidate.tier);
  const tierOk = tDist <= config.maxTierDistance;

  return {
    inBoundary: boundaryOk,
    withinDistance: distanceOk,
    distanceKm,
    overlapMinutes: shared.totalMinutes,
    hasOverlap: overlapOk,
    tierDistance: tDist,
    tierCompatible: tierOk,
    passed: boundaryOk && distanceOk && overlapOk && tierOk,
  };
}

/** Candidates that pass every deterministic predicate. */
export function deterministicFilter(
  seeker: PlayerProfile,
  pool: PlayerProfile[],
  config: EngineConfig,
): Array<{ profile: PlayerProfile; gate: GateReport }> {
  return pool
    .filter((p) => p.id !== seeker.id && p.matchmakingOptIn)
    .map((profile) => ({ profile, gate: evaluateGate(seeker, profile, config) }))
    .filter((c) => c.gate.passed);
}
