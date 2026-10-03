import { api, registerUser } from './helper';

describe('API foundation', () => {
  it('answers the health probe without a token', async () => {
    expect(await api('GET', '/healthz')).toEqual({ status: 200, body: { ok: true } });
  });

  it('rejects a protected route without a token, or with a bad one', async () => {
    for (const token of [undefined, 'not-a-token']) {
      const res = await api('GET', '/me', token);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('unauthenticated');
      expect(typeof res.body.error.message).toBe('string');
    }
  });

  it('serves areas and tier bands from /config without a token', async () => {
    const { status, body } = await api('GET', '/config');
    expect(status).toBe(200);
    expect(body.areas).toHaveLength(9);
    expect(body.areas).toContainEqual({ label: 'Calamba Poblacion', lat: 14.2117, lng: 121.1653 });
    expect(body.tierBands).toEqual({
      beginner: { min: 2.0, max: 2.5 },
      intermediate: { min: 3.0, max: 3.5 },
      advanced: { min: 4.0, max: 5.5 },
    });
    expect(body.tau).toBe(0.9);
    expect(body.tauLadder).toEqual([0.75, 0.8, 0.85, 0.9, 0.95]);
    expect(body.bookingSlots).toEqual({ startMin: 360, endMin: 1260, stepMin: 60 });
  });

  describe('POST /geo/resolve', () => {
    let token: string;
    beforeAll(async () => {
      ({ token } = await registerUser());
    });

    it('classifies a point inside the corridor and names the nearest area', async () => {
      const { status, body } = await api('POST', '/geo/resolve', token, { lat: 14.165, lng: 121.24 });
      expect(status).toBe(200);
      expect(body.inCorridor).toBe(true);
      expect(body.nearestArea.label).toBe('UPLB, Los Baños');
    });

    it('classifies a point outside the corridor (Manila)', async () => {
      const { status, body } = await api('POST', '/geo/resolve', token, { lat: 14.5995, lng: 120.9842 });
      expect(status).toBe(200);
      expect(body).toEqual({ inCorridor: false, nearestArea: null });
    });

    it('rejects coordinates that are not numbers in range', async () => {
      for (const bad of [{}, { lat: '14', lng: 121 }, { lat: 91, lng: 121 }, { lat: 14, lng: 181 }]) {
        const res = await api('POST', '/geo/resolve', token, bad);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('invalid');
      }
    });

    it('answers without a token, and with one', async () => {
      for (const t of [undefined, token]) {
        const res = await api('POST', '/geo/resolve', t, { lat: 14.165, lng: 121.24 });
        expect(res.status).toBe(200);
        expect(res.body.inCorridor).toBe(true);
      }
      expect((await api('POST', '/geo/resolve', undefined, { lat: 'x', lng: 1 })).status).toBe(400);
    });
  });

  it('returns 404 in the error format for an unknown route', async () => {
    const { token } = await registerUser();
    const res = await api('GET', '/no-such-route', token);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});
