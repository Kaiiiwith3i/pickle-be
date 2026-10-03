/**
 * Pickle C-LB Hybrid Filtering Engine — shared domain types.
 *
 * This package is pure TypeScript with zero runtime dependencies so the exact
 * same code executes in the Expo app, in Cloud Functions, and in the thesis
 * evaluation harness ("Unified Logic Layer" in the manuscript).
 */

/** WGS-84 coordinate pair. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Skill tiers aligned to USA Pickleball rating bands:
 * Beginner ≈ 2.0–2.5, Intermediate ≈ 3.0–3.5, Advanced ≈ 4.0+
 */
export type SkillTier = 'beginner' | 'intermediate' | 'advanced';

export type PlayFormat = 'singles' | 'doubles' | 'both';
export type PlayIntent = 'casual' | 'competitive' | 'both';

/** Day-of-week: 0 = Sunday … 6 = Saturday (JS Date convention). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A recurring weekly availability window, minutes since midnight. */
export interface AvailabilityWindow {
  day: Weekday;
  startMin: number; // inclusive, 0..1439
  endMin: number;   // exclusive, 1..1440
}

export interface PlayerProfile {
  id: string;
  displayName: string;
  tier: SkillTier;
  /** Optional self-reported USA Pickleball numeric rating (2.0–5.5). */
  rating?: number;
  location: GeoPoint;
  availability: AvailabilityWindow[];
  format: PlayFormat;
  intent: PlayIntent;
  /** Explicit matchmaking consent (RA 10173 opt-in). Non-consenting users are never candidates. */
  matchmakingOptIn: boolean;
}

/**
 * One co-engagement record: the seeker and partner appeared in the same
 * completed session/match. Feeds the collaborative-filtering interaction matrix.
 */
export interface EngagementRecord {
  playerId: string;
  /** Identifier of the co-engaged item (sessionId, courtId, or matchId). */
  itemId: string;
  /** Optional weight, e.g. matches count more than feed interactions. Default 1. */
  weight?: number;
}

/** Circular region; the operational boundary is the union of anchor regions. */
export interface BoundaryRegion {
  center: GeoPoint;
  radiusKm: number;
}

export interface EngineConfig {
  /** Operational corridor (Calamba + Los Baños anchors by default). */
  boundary: BoundaryRegion[];
  /** Max geodesic seeker↔candidate distance in km (deterministic gate). */
  maxDistanceKm: number;
  /** Minimum shared availability minutes per week (deterministic gate). */
  minOverlapMinutes: number;
  /** Max tier distance allowed by the skill gate (1 = adjacent tiers allowed). */
  maxTierDistance: number;
  /**
   * Collaborative-filtering ramp: CF weight = wCfMax * min(1, interactions/rampK).
   * With zero interaction history the hybrid score degrades gracefully to the
   * content-based score (cold-start mitigation documented in Chapter 3).
   */
  wCfMax: number;
  rampK: number;
  /** Compatibility threshold τ ∈ [0,1] applied to the final hybrid score. */
  tau: number;
}

/** Stage-1 (deterministic) per-predicate outcome, kept for explainability. */
export interface GateReport {
  inBoundary: boolean;
  withinDistance: boolean;
  distanceKm: number;
  overlapMinutes: number;
  hasOverlap: boolean;
  tierDistance: number;
  tierCompatible: boolean;
  passed: boolean;
}

export interface MatchCandidate {
  profile: PlayerProfile;
  /** Final hybrid compatibility score S(u,v) ∈ [0,1]. τ thresholds THIS value. */
  score: number;
  contentScore: number;
  cfScore: number;
  /** Effective CF weight used (0 under cold start). */
  cfWeight: number;
  distanceKm: number;
  sharedMinutes: number;
  sharedWindows: AvailabilityWindow[];
  gate: GateReport;
}

export interface MatchResult {
  seekerId: string;
  tau: number;
  /** Candidates with score ≥ τ, ranked by score desc (distance, then id tiebreak). */
  recommended: MatchCandidate[];
  /** All gate-passing candidates regardless of τ (for dashboards/tuning). */
  scored: MatchCandidate[];
}

/**
 * 2v2 Doubles Team and Matchmaking Types
 */

export interface DoublesTeam {
  id: string;
  player1: PlayerProfile;
  player2: PlayerProfile;
  name?: string;
}

export interface DoublesGateReport {
  inBoundary: boolean;
  withinDistance: boolean;
  distanceKm: number;
  overlapMinutes: number;
  hasOverlap: boolean;
  tierDistance: number;
  tierCompatible: boolean;
  passed: boolean;
}

export interface DoublesCandidate {
  team: DoublesTeam;
  score: number;
  contentScore: number;
  cfScore: number;
  cfWeight: number;
  distanceKm: number;
  sharedMinutes: number;
  sharedWindows: AvailabilityWindow[];
  compositeTier: SkillTier;
  compositeRating: number;
  gate: DoublesGateReport;
}

export interface DoublesMatchResult {
  seekerTeamId: string;
  tau: number;
  recommended: DoublesCandidate[];
  scored: DoublesCandidate[];
}
