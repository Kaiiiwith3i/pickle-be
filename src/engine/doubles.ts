import { sharedAvailability } from './availability';
import { InteractionMatrix } from './collaborative';
import { CALAMBA_LOS_BANOS_BOUNDARY, haversineKm, inBoundary } from './geo';
import { cfWeight, DEFAULT_CONFIG } from './hybrid';
import { tierDistance, tierMidpoint } from './tiers';
import type {
  AvailabilityWindow,
  DoublesCandidate,
  DoublesGateReport,
  DoublesMatchResult,
  DoublesTeam,
  EngineConfig,
  GeoPoint,
  PlayerProfile,
  SkillTier,
} from './types';
import { clamp01 } from './vector';

/**
 * Computes the combined USA Pickleball numeric rating for a doubles pair.
 */
export function computeCompositeRating(p1: PlayerProfile, p2: PlayerProfile): number {
  const r1 = p1.rating ?? tierMidpoint(p1.tier);
  const r2 = p2.rating ?? tierMidpoint(p2.tier);
  return Number(((r1 + r2) / 2).toFixed(2));
}

/**
 * Maps a composite numeric rating back to a categorical SkillTier.
 */
export function computeCompositeTier(rating: number): SkillTier {
  if (rating < 2.75) return 'beginner';
  if (rating <= 3.75) return 'intermediate';
  return 'advanced';
}

/**
 * Computes the geographic centroid (midpoint) of a doubles team.
 */
export function computeTeamCentroid(p1: PlayerProfile, p2: PlayerProfile): GeoPoint {
  return {
    lat: Number(((p1.location.lat + p2.location.lat) / 2).toFixed(6)),
    lng: Number(((p1.location.lng + p2.location.lng) / 2).toFixed(6)),
  };
}

/**
 * Computes the joint availability window where BOTH team partners are free.
 */
export function computeTeamAvailability(
  p1: PlayerProfile,
  p2: PlayerProfile,
): AvailabilityWindow[] {
  return sharedAvailability(p1.availability, p2.availability).windows;
}

/**
 * Stage-1 Deterministic Gating for 2v2 Doubles Matchmaking.
 */
export function evaluateDoublesGate(
  seekerTeam: DoublesTeam,
  candidateTeam: DoublesTeam,
  config: EngineConfig = DEFAULT_CONFIG,
): DoublesGateReport {
  const cSeeker = computeTeamCentroid(seekerTeam.player1, seekerTeam.player2);
  const cCandidate = computeTeamCentroid(candidateTeam.player1, candidateTeam.player2);

  // 1. Boundary check: team centroids must lie in operational corridor
  const inBoundaryOk = inBoundary(cSeeker, config.boundary) && inBoundary(cCandidate, config.boundary);

  // 2. Distance check: centroid distance <= maxDistanceKm
  const distanceKm = haversineKm(cSeeker, cCandidate);
  const withinDistance = distanceKm <= config.maxDistanceKm;

  // 3. Skill compatibility: composite tier distance <= maxTierDistance
  const tierA = computeCompositeTier(computeCompositeRating(seekerTeam.player1, seekerTeam.player2));
  const tierB = computeCompositeTier(computeCompositeRating(candidateTeam.player1, candidateTeam.player2));
  const tDist = tierDistance(tierA, tierB);
  const tierCompatible = tDist <= config.maxTierDistance;

  // 4. 4-way shared schedule intersection: (A1 ∩ A2) ∩ (B1 ∩ B2)
  const availA = computeTeamAvailability(seekerTeam.player1, seekerTeam.player2);
  const availB = computeTeamAvailability(candidateTeam.player1, candidateTeam.player2);
  const shared = sharedAvailability(availA, availB);
  const overlapMinutes = shared.totalMinutes;
  const hasOverlap = overlapMinutes >= config.minOverlapMinutes;

  const passed = inBoundaryOk && withinDistance && tierCompatible && hasOverlap;

  return {
    inBoundary: inBoundaryOk,
    withinDistance,
    distanceKm: Number(distanceKm.toFixed(2)),
    overlapMinutes,
    hasOverlap,
    tierDistance: tDist,
    tierCompatible,
    passed,
  };
}

/**
 * Stage-2 Hybrid Scoring for Doubles Pairs S_2v2(TeamA, TeamB) ∈ [0, 1].
 */
export function scoreDoublesPair(
  seekerTeam: DoublesTeam,
  candidateTeam: DoublesTeam,
  interactions: InteractionMatrix,
  config: EngineConfig = DEFAULT_CONFIG,
): {
  score: number;
  contentScore: number;
  cfScore: number;
  cfWeight: number;
  sharedWindows: AvailabilityWindow[];
  sharedMinutes: number;
  compositeTier: SkillTier;
  compositeRating: number;
} {
  const rA = computeCompositeRating(seekerTeam.player1, seekerTeam.player2);
  const rB = computeCompositeRating(candidateTeam.player1, candidateTeam.player2);
  const compositeTier = computeCompositeTier(rB);

  const cA = computeTeamCentroid(seekerTeam.player1, seekerTeam.player2);
  const cB = computeTeamCentroid(candidateTeam.player1, candidateTeam.player2);
  const distKm = haversineKm(cA, cB);

  const availA = computeTeamAvailability(seekerTeam.player1, seekerTeam.player2);
  const availB = computeTeamAvailability(candidateTeam.player1, candidateTeam.player2);
  const shared = sharedAvailability(availA, availB);

  // Content sub-scores
  const sSkill = clamp01(1 - Math.abs(rA - rB) / 3.5);
  const sDist = clamp01(1 - distKm / config.maxDistanceKm);
  const sTime = clamp01(shared.totalMinutes / 180);

  // Fused Content Score: 40% skill balance, 35% distance, 25% schedule overlap
  const contentScore = clamp01(0.4 * sSkill + 0.35 * sDist + 0.25 * sTime);

  // Cross-player Collaborative Filtering boost across 4 players
  const cfPair1 = interactions.similarity(seekerTeam.player1.id, candidateTeam.player1.id);
  const cfPair2 = interactions.similarity(seekerTeam.player1.id, candidateTeam.player2.id);
  const cfPair3 = interactions.similarity(seekerTeam.player2.id, candidateTeam.player1.id);
  const cfPair4 = interactions.similarity(seekerTeam.player2.id, candidateTeam.player2.id);

  const validCf = [cfPair1, cfPair2, cfPair3, cfPair4].filter((v): v is number => v !== null);
  const cfScore = validCf.length > 0 ? validCf.reduce((a, b) => a + b, 0) / validCf.length : 0;

  const countA =
    interactions.interactionCount(seekerTeam.player1.id) +
    interactions.interactionCount(seekerTeam.player2.id);
  const countB =
    interactions.interactionCount(candidateTeam.player1.id) +
    interactions.interactionCount(candidateTeam.player2.id);
  const cfW = validCf.length > 0 ? cfWeight(countA, countB, config) : 0;

  // Boost-only Hybrid Formula
  const score = clamp01(contentScore + cfW * cfScore * (1 - contentScore));

  return {
    score: Number(score.toFixed(4)),
    contentScore: Number(contentScore.toFixed(4)),
    cfScore: Number(cfScore.toFixed(4)),
    cfWeight: Number(cfW.toFixed(4)),
    sharedWindows: shared.windows,
    sharedMinutes: shared.totalMinutes,
    compositeTier,
    compositeRating: rB,
  };
}

/**
 * High-level 2v2 Doubles Matchmaking entry point.
 */
export function matchDoublesTeams(
  seekerTeam: DoublesTeam,
  candidateTeams: DoublesTeam[],
  interactions: InteractionMatrix,
  config: EngineConfig = DEFAULT_CONFIG,
): DoublesMatchResult {
  const scored: DoublesCandidate[] = [];

  // Exclude teams containing either player from seeker team
  const seekerIds = new Set([seekerTeam.player1.id, seekerTeam.player2.id]);
  const pool = candidateTeams.filter(
    (t) => !seekerIds.has(t.player1.id) && !seekerIds.has(t.player2.id),
  );

  for (const candidateTeam of pool) {
    const gate = evaluateDoublesGate(seekerTeam, candidateTeam, config);
    if (gate.passed) {
      const s = scoreDoublesPair(seekerTeam, candidateTeam, interactions, config);
      scored.push({
        team: candidateTeam,
        score: s.score,
        contentScore: s.contentScore,
        cfScore: s.cfScore,
        cfWeight: s.cfWeight,
        distanceKm: gate.distanceKm,
        sharedMinutes: s.sharedMinutes,
        sharedWindows: s.sharedWindows,
        compositeTier: s.compositeTier,
        compositeRating: s.compositeRating,
        gate,
      });
    }
  }

  // Sort descending by score, tiebreak by distance ascending, then id
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    return a.team.id.localeCompare(b.team.id);
  });

  const recommended = scored.filter((c) => c.score >= config.tau);

  return {
    seekerTeamId: seekerTeam.id,
    tau: config.tau,
    recommended,
    scored,
  };
}
