import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CALIBRATED_TAU, DEFAULT_CONFIG } from '../../src/engine';
import { api, registerPlayer, registerUser } from './helper';

describe('Algorithm Lab (ticket 11)', () => {
  let admin: Awaited<ReturnType<typeof registerPlayer>>;
  let seeker: Awaited<ReturnType<typeof registerPlayer>>;
  let fit: Awaited<ReturnType<typeof registerPlayer>>;
  let rejected: Awaited<ReturnType<typeof registerPlayer>>;
  let optedOut: Awaited<ReturnType<typeof registerPlayer>>;

  beforeAll(async () => {
    admin = await registerPlayer({}, 'admin');
    seeker = await registerPlayer({ phone: '+639172220001', preciseLocation: { lat: 14.2161111, lng: 121.1711111 } });
    fit = await registerPlayer({ preciseLocation: { lat: 14.2172222, lng: 121.1722222 } });
    // Sunday only: shares no time with the seeker, so Stage 1 rejects them.
    rejected = await registerPlayer({ availability: [{ day: 0, startMin: 360, endMin: 600 }] });
    optedOut = await registerPlayer({ matchmakingOptIn: false });
  });

  describe('GET /algorithm/lab/:seekerId', () => {
    it('is admin only: players and caretakers get 403, no token gets 401', async () => {
      const caretaker = await registerUser('caretaker');
      for (const token of [seeker.token, caretaker.token]) {
        const res = await api('GET', `/algorithm/lab/${seeker.uid}`, token);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('forbidden');
      }
      expect((await api('GET', `/algorithm/lab/${seeker.uid}`)).status).toBe(401);
    });

    it('is 404 for an unknown seeker', async () => {
      expect((await api('GET', '/algorithm/lab/nobody', admin.token)).status).toBe(404);
    });

    it('lists every opted-in player, rejected ones included, with gate and scores and no private data', async () => {
      const { status, body } = await api('GET', `/algorithm/lab/${seeker.uid}`, admin.token);
      expect(status).toBe(200);
      expect(body.seeker.id).toBe(seeker.uid);
      expect(body.config).toEqual({ ...DEFAULT_CONFIG, tau: CALIBRATED_TAU });

      const byId = new Map<string, any>(body.candidates.map((c: any) => [c.profile.id, c]));
      expect(byId.get(fit.uid).gate.passed).toBe(true);
      expect(byId.get(rejected.uid).gate).toMatchObject({ passed: false, hasOverlap: false });
      for (const c of [byId.get(fit.uid), byId.get(rejected.uid)]) {
        for (const k of ['contentScore', 'cfScore', 'cfWeight', 'score']) expect(typeof c[k]).toBe('number');
      }
      expect(byId.has(optedOut.uid)).toBe(false);
      expect(byId.has(seeker.uid)).toBe(false);

      const json = JSON.stringify(body);
      for (const secret of ['"email"', '"phone"', '"preciseLocation"', '+639172220001', '14.2161111', '121.1711111', '14.2172222']) {
        expect(json).not.toContain(secret);
      }
    });
  });

  describe('GET /algorithm/evaluation', () => {
    it('serves the stored harness output as-is to any signed-in user', async () => {
      const file = JSON.parse(readFileSync(join(__dirname, '../../thesis-artifacts/evaluation-summary.json'), 'utf8'));
      const { status, body } = await api('GET', '/algorithm/evaluation', seeker.token);
      expect(status).toBe(200);
      expect(body.cold_start.metrics).toEqual(file.cold_start.metrics);
      expect(body).toEqual(file);
      expect((await api('GET', '/algorithm/evaluation')).status).toBe(401);
    });
  });
});
