import { InteractionMatrix } from '../../src/engine/collaborative';
import {
  computeCompositeRating,
  computeCompositeTier,
  computeTeamAvailability,
  computeTeamCentroid,
  evaluateDoublesGate,
  matchDoublesTeams,
  scoreDoublesPair,
} from '../../src/engine/doubles';
import type { DoublesTeam, PlayerProfile } from '../../src/engine/types';
import { makePlayer } from './fixtures';

describe('2v2 Doubles Matchmaking Engine', () => {
  const p1 = makePlayer({
    id: 'u1',
    tier: 'intermediate',
    rating: 3.25,
    location: { lat: 14.1946, lng: 121.1554 }, // Halang, Calamba
    availability: [{ day: 6, startMin: 480, endMin: 720 }], // Sat 8am-12pm
  });

  const p2 = makePlayer({
    id: 'u2',
    tier: 'intermediate',
    rating: 3.5,
    location: { lat: 14.2044, lng: 121.1739 }, // Real, Calamba
    availability: [{ day: 6, startMin: 480, endMin: 660 }], // Sat 8am-11am
  });

  const p3 = makePlayer({
    id: 'u3',
    tier: 'intermediate',
    rating: 3.0,
    location: { lat: 14.1678, lng: 121.2428 }, // LB Sports, Los Baños
    availability: [{ day: 6, startMin: 540, endMin: 720 }], // Sat 9am-12pm
  });

  const p4 = makePlayer({
    id: 'u4',
    tier: 'intermediate',
    rating: 3.25,
    location: { lat: 14.1622, lng: 121.2415 }, // Copeland, Los Baños
    availability: [{ day: 6, startMin: 480, endMin: 660 }], // Sat 8am-11am
  });

  const teamA: DoublesTeam = {
    id: 'team-a',
    player1: p1,
    player2: p2,
    name: 'Calamba Strikers',
  };

  const teamB: DoublesTeam = {
    id: 'team-b',
    player1: p3,
    player2: p4,
    name: 'Los Baños Smashers',
  };

  describe('Composite Rating & Tier Modeling', () => {
    it('computes arithmetic mean rating of two partners', () => {
      const rating = computeCompositeRating(p1, p2);
      expect(rating).toBe(3.38); // (3.25 + 3.5) / 2
    });

    it('maps composite rating to correct SkillTier', () => {
      expect(computeCompositeTier(2.5)).toBe('beginner');
      expect(computeCompositeTier(2.75)).toBe('intermediate');
      expect(computeCompositeTier(3.5)).toBe('intermediate');
      expect(computeCompositeTier(3.75)).toBe('intermediate');
      expect(computeCompositeTier(4.0)).toBe('advanced');
    });
  });

  describe('Spatial Midpoint & Joint Availability', () => {
    it('computes accurate team centroid', () => {
      const centroid = computeTeamCentroid(p1, p2);
      expect(centroid.lat).toBeCloseTo(14.1995, 4);
      expect(centroid.lng).toBeCloseTo(121.16465, 4);
    });

    it('computes joint availability where BOTH partners are free', () => {
      const joint = computeTeamAvailability(p1, p2);
      // p1 is 8am-12pm (480-720), p2 is 8am-11am (480-660) -> joint is 8am-11am (480-660, 180 min)
      expect(joint).toHaveLength(1);
      expect(joint[0].startMin).toBe(480);
      expect(joint[0].endMin).toBe(660);
    });
  });

  describe('Deterministic 2v2 Gating', () => {
    it('passes compatible teams with 4-way overlapping schedule', () => {
      const gate = evaluateDoublesGate(teamA, teamB);
      expect(gate.inBoundary).toBe(true);
      expect(gate.withinDistance).toBe(true);
      expect(gate.tierCompatible).toBe(true);
      expect(gate.hasOverlap).toBe(true);
      // Joint A: 480-660 (8am-11am). Joint B: p3 is 540-720 (9am-12pm), p4 is 480-660 (8am-11am) -> Joint B is 540-660 (9am-11am).
      // 4-way overlap: 540-660 = 120 minutes (2 hours).
      expect(gate.overlapMinutes).toBe(120);
      expect(gate.passed).toBe(true);
    });

    it('fails when 4-way schedule overlap is under minOverlapMinutes', () => {
      const pBusy = makePlayer({
        id: 'u-busy',
        availability: [{ day: 0, startMin: 60, endMin: 90 }], // Sunday midnight
      });
      const teamBusy: DoublesTeam = {
        id: 'team-busy',
        player1: pBusy,
        player2: p2,
      };
      const gate = evaluateDoublesGate(teamA, teamBusy);
      expect(gate.hasOverlap).toBe(false);
      expect(gate.passed).toBe(false);
    });
  });

  describe('Hybrid Scoring & Match Ranking', () => {
    const emptyMatrix = new InteractionMatrix();

    it('scores 2v2 pair under cold start using content fusion', () => {
      const scored = scoreDoublesPair(teamA, teamB, emptyMatrix);
      expect(scored.score).toBeGreaterThan(0.65);
      expect(scored.cfScore).toBe(0);
      expect(scored.cfWeight).toBe(0);
      expect(scored.sharedMinutes).toBe(120);
      expect(scored.compositeTier).toBe('intermediate');
    });

    it('matches and ranks pool of candidate doubles teams', () => {
      const result = matchDoublesTeams(teamA, [teamB], emptyMatrix);
      expect(result.seekerTeamId).toBe('team-a');
      expect(result.scored).toHaveLength(1);
      expect(result.scored[0].team.id).toBe('team-b');
      expect(result.scored[0].sharedMinutes).toBe(120);
    });

    it('excludes candidate teams containing either player from seeker team', () => {
      const teamSelfConflict: DoublesTeam = {
        id: 'team-conflict',
        player1: p1,
        player2: p3,
      };
      const result = matchDoublesTeams(teamA, [teamSelfConflict], emptyMatrix);
      expect(result.scored).toHaveLength(0);
    });
  });
});
