import { InteractionMatrix } from '../../src/engine/collaborative';
import { cfWeight, matchPlayers, DEFAULT_CONFIG } from '../../src/engine/hybrid';
import { makePlayer } from './fixtures';

const emptyMatrix = new InteractionMatrix();

describe('cfWeight (cold-start ramp)', () => {
  it('is 0 with no evidence and saturates at wCfMax', () => {
    expect(cfWeight(0, 0, DEFAULT_CONFIG)).toBe(0);
    expect(cfWeight(5, 100, DEFAULT_CONFIG)).toBeCloseTo(
      DEFAULT_CONFIG.wCfMax * (5 / DEFAULT_CONFIG.rampK),
    );
    expect(cfWeight(1000, 1000, DEFAULT_CONFIG)).toBe(DEFAULT_CONFIG.wCfMax);
  });

  it('is limited by the less-active player (evidence = min)', () => {
    expect(cfWeight(1000, 2, DEFAULT_CONFIG)).toBeCloseTo(
      DEFAULT_CONFIG.wCfMax * (2 / DEFAULT_CONFIG.rampK),
    );
  });
});

describe('matchPlayers', () => {
  it('falls back to pure content scoring under cold start', () => {
    const seeker = makePlayer({ id: 'seeker' });
    const candidate = makePlayer();
    const result = matchPlayers(seeker, [candidate], emptyMatrix);
    const scored = result.scored[0];
    expect(scored.cfWeight).toBe(0);
    expect(scored.score).toBeCloseTo(scored.contentScore, 12);
  });

  it('blends CF once shared history exists', () => {
    const seeker = makePlayer({ id: 'seeker' });
    const candidate = makePlayer({ id: 'cand' });
    const records = [];
    for (let i = 0; i < 25; i++) {
      records.push({ playerId: 'seeker', itemId: `s${i}` });
      records.push({ playerId: 'cand', itemId: `s${i}` });
    }
    const matrix = new InteractionMatrix(records);
    const result = matchPlayers(seeker, [candidate], matrix);
    const scored = result.scored[0];
    expect(scored.cfWeight).toBe(DEFAULT_CONFIG.wCfMax);
    expect(scored.cfScore).toBeCloseTo(1);
    expect(scored.score).toBeGreaterThanOrEqual(scored.contentScore - 1e-12);
  });

  it('thresholds recommendations at τ over the hybrid score', () => {
    const seeker = makePlayer({ id: 'seeker', rating: 3.5 });
    const close = makePlayer({ rating: 3.5 });
    const far = makePlayer({ rating: 2.6, tier: 'intermediate', intent: 'competitive' });
    const result = matchPlayers(seeker, [close, far], emptyMatrix, {
      ...DEFAULT_CONFIG,
      tau: 0.9,
    });
    expect(result.scored).toHaveLength(2);
    expect(result.recommended.map((c) => c.profile.id)).toEqual([close.id]);
  });

  it('ranks deterministically with stable tiebreaks', () => {
    const seeker = makePlayer({ id: 'seeker' });
    const twinA = makePlayer({ id: 'aaa' });
    const twinB = makePlayer({ id: 'bbb' });
    const r1 = matchPlayers(seeker, [twinB, twinA], emptyMatrix);
    const r2 = matchPlayers(seeker, [twinA, twinB], emptyMatrix);
    expect(r1.scored.map((c) => c.profile.id)).toEqual(['aaa', 'bbb']);
    expect(r2.scored.map((c) => c.profile.id)).toEqual(['aaa', 'bbb']);
  });

  it('produces scores strictly within [0, 1]', () => {
    const seeker = makePlayer({ id: 'seeker', rating: 2.0, intent: 'casual' });
    const pool = [
      makePlayer({ rating: 2.0 }),
      makePlayer({ rating: 3.0, tier: 'intermediate' }),
      makePlayer({ rating: 2.5, intent: 'competitive' }),
    ];
    const result = matchPlayers(seeker, pool, emptyMatrix);
    for (const c of result.scored) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(1);
    }
  });
});
