import { deterministicFilter, evaluateGate } from '../../src/engine/deterministic';
import { DEFAULT_CONFIG } from '../../src/engine/hybrid';
import { makePlayer, LOS_BANOS, MANILA, SAT_MORNING, SUN_MORNING } from './fixtures';

describe('evaluateGate', () => {
  it('passes a compatible nearby candidate', () => {
    const gate = evaluateGate(makePlayer(), makePlayer(), DEFAULT_CONFIG);
    expect(gate).toMatchObject({
      inBoundary: true,
      withinDistance: true,
      hasOverlap: true,
      tierCompatible: true,
      passed: true,
    });
  });

  it('fails candidates outside the corridor boundary', () => {
    const gate = evaluateGate(
      makePlayer(),
      makePlayer({ location: MANILA }),
      DEFAULT_CONFIG,
    );
    expect(gate.inBoundary).toBe(false);
    expect(gate.passed).toBe(false);
  });

  it('fails candidates with no schedule overlap', () => {
    const gate = evaluateGate(
      makePlayer({ availability: [SAT_MORNING] }),
      makePlayer({ availability: [SUN_MORNING] }),
      DEFAULT_CONFIG,
    );
    expect(gate.hasOverlap).toBe(false);
    expect(gate.passed).toBe(false);
  });

  it('fails candidates two tiers away but passes adjacent tiers', () => {
    const seeker = makePlayer({ tier: 'beginner' });
    expect(
      evaluateGate(seeker, makePlayer({ tier: 'advanced' }), DEFAULT_CONFIG).passed,
    ).toBe(false);
    expect(
      evaluateGate(seeker, makePlayer({ tier: 'intermediate' }), DEFAULT_CONFIG)
        .passed,
    ).toBe(true);
  });

  it('respects the distance cap independently of boundary membership', () => {
    const config = { ...DEFAULT_CONFIG, maxDistanceKm: 5 };
    const gate = evaluateGate(
      makePlayer(),
      makePlayer({ location: LOS_BANOS }),
      config,
    );
    expect(gate.inBoundary).toBe(true);
    expect(gate.withinDistance).toBe(false);
    expect(gate.passed).toBe(false);
  });
});

describe('deterministicFilter', () => {
  it('excludes the seeker and non-consenting players', () => {
    const seeker = makePlayer({ id: 'seeker' });
    const optedOut = makePlayer({ matchmakingOptIn: false });
    const ok = makePlayer();
    const result = deterministicFilter(seeker, [seeker, optedOut, ok], DEFAULT_CONFIG);
    expect(result.map((r) => r.profile.id)).toEqual([ok.id]);
  });
});
