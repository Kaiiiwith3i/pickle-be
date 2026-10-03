import { haversineKm, inBoundary, CALAMBA_LOS_BANOS_BOUNDARY } from '../../src/engine/geo';
import { CALAMBA, LOS_BANOS, MANILA } from './fixtures';

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(CALAMBA, CALAMBA)).toBe(0);
  });

  it('is symmetric', () => {
    expect(haversineKm(CALAMBA, LOS_BANOS)).toBeCloseTo(
      haversineKm(LOS_BANOS, CALAMBA),
      12,
    );
  });

  it('measures one degree of latitude as ~111.19 km', () => {
    const d = haversineKm({ lat: 14, lng: 121 }, { lat: 15, lng: 121 });
    expect(d).toBeGreaterThan(110.5);
    expect(d).toBeLessThan(111.8);
  });

  it('places Calamba and Los Baños within corridor range of each other', () => {
    const d = haversineKm(CALAMBA, LOS_BANOS);
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(15);
  });
});

describe('inBoundary', () => {
  it('accepts points near either anchor', () => {
    expect(inBoundary(CALAMBA, CALAMBA_LOS_BANOS_BOUNDARY)).toBe(true);
    expect(inBoundary(LOS_BANOS, CALAMBA_LOS_BANOS_BOUNDARY)).toBe(true);
  });

  it('rejects Manila', () => {
    expect(inBoundary(MANILA, CALAMBA_LOS_BANOS_BOUNDARY)).toBe(false);
  });
});
