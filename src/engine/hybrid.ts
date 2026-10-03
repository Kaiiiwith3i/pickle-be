import type {
  EngineConfig,
  MatchCandidate,
  MatchResult,
  PlayerProfile,
} from './types';
import { CALAMBA_LOS_BANOS_BOUNDARY } from './geo';
import { sharedAvailability } from './availability';
import { contentSimilarity } from './content';
import { InteractionMatrix } from './collaborative';
import { deterministicFilter } from './deterministic';
import { clamp01 } from './vector';

/** Production threshold: the F1-optimal τ* from the Chapter 4 calibration. */
export const CALIBRATED_TAU = 0.9;

export const DEFAULT_CONFIG: EngineConfig = {
  boundary: CALAMBA_LOS_BANOS_BOUNDARY,
  maxDistanceKm: 15,
  minOverlapMinutes: 60,
  maxTierDistance: 1,
  wCfMax: 0.4,
  rampK: 20,
  tau: 0.85,
};

/**
 * CF weight ramp — the documented cold-start mitigation. A player pair with no
 * interaction history is scored purely on onboarding content; the CF term
 * gains weight as the co-engagement matrix densifies, saturating at wCfMax.
 */
export function cfWeight(
  seekerInteractions: number,
  candidateInteractions: number,
  config: EngineConfig,
): number {
  const evidence = Math.min(seekerInteractions, candidateInteractions);
  return config.wCfMax * Math.min(1, evidence / config.rampK);
}

export interface PairScore {
  content: number;
  cfSim: number | null;
  cfW: number;
  /** Final hybrid compatibility score S(u,v) ∈ [0,1]. τ thresholds THIS. */
  score: number;
}

/**
 * The single scoring path used by the app, the Cloud Function, and the thesis
 * evaluation harness — the evaluation measures THIS code, not a re-implementation.
 * CF is boost-only: shared engagement history strengthens a match, but the
 * absence of history is not negative evidence (cold-start soundness).
 */
export function scorePair(
  seeker: PlayerProfile,
  candidate: PlayerProfile,
  interactions: InteractionMatrix,
  config: EngineConfig = DEFAULT_CONFIG,
): PairScore {
  const content = contentSimilarity(seeker, candidate);
  const cfSim = interactions.similarity(seeker.id, candidate.id);
  const cfW =
    cfSim === null
      ? 0
      : cfWeight(
          interactions.interactionCount(seeker.id),
          interactions.interactionCount(candidate.id),
          config,
        );
  return {
    content,
    cfSim,
    cfW,
    score: clamp01(content + cfW * (cfSim ?? 0) * (1 - content)),
  };
}

/**
 * Stage 1 + Stage 2 pipeline producing the final hybrid compatibility score
 * S(u,v) ∈ [0,1] for every gate-passing candidate, thresholded at τ.
 * Pure and deterministic: identical inputs produce identical rankings on
 * Android, iOS, server, and the evaluation harness.
 */
export function matchPlayers(
  seeker: PlayerProfile,
  pool: PlayerProfile[],
  interactions: InteractionMatrix,
  config: EngineConfig = DEFAULT_CONFIG,
): MatchResult {
  const eligible = deterministicFilter(seeker, pool, config);

  const scored: MatchCandidate[] = eligible.map(({ profile, gate }) => {
    const s = scorePair(seeker, profile, interactions, config);
    const shared = sharedAvailability(seeker.availability, profile.availability);
    return {
      profile,
      score: s.score,
      contentScore: s.content,
      cfScore: s.cfSim ?? 0,
      cfWeight: s.cfW,
      distanceKm: gate.distanceKm,
      sharedMinutes: shared.totalMinutes,
      sharedWindows: shared.windows,
      gate,
    };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.distanceKm - b.distanceKm ||
      a.profile.id.localeCompare(b.profile.id),
  );

  return {
    seekerId: seeker.id,
    tau: config.tau,
    recommended: scored.filter((c) => c.score >= config.tau),
    scored,
  };
}
