import { db } from '../../src/firebase';
import { loadEngagements } from '../../src/data';
import { CALIBRATED_TAU, DEFAULT_CONFIG, evaluateGate, InteractionMatrix, scorePair } from '../../src/engine';
import { api, registerPlayer, registerUser } from './helper';

const SEEKER_GPS = { lat: 14.2150123, lng: 121.1700456 };
const CAND_GPS = { lat: 14.2231987, lng: 121.1612345 };

describe('singles matchmaking and explain (ticket 08)', () => {
  let seeker: Awaited<ReturnType<typeof registerPlayer>>;
  let cand: Awaited<ReturnType<typeof registerPlayer>>;

  beforeAll(async () => {
    seeker = await registerPlayer({ preciseLocation: SEEKER_GPS, phone: '+639170000001' });
    cand = await registerPlayer({ preciseLocation: CAND_GPS, phone: '+639170000002' });
  });

  it('returns a MatchResult with only public profiles and no coordinates from private GPS', async () => {
    const { status, body } = await api('GET', '/matchmake', seeker.token);
    expect(status).toBe(200);
    expect(body.seekerId).toBe(seeker.uid);
    expect(body.tau).toBe(CALIBRATED_TAU);
    const hit = body.scored.find((c: any) => c.profile.id === cand.uid);
    expect(hit).toBeDefined();
    expect(hit.profile.location).toEqual(cand.profile.location);

    const json = JSON.stringify(body);
    for (const key of ['"email"', '"phone"', '"preciseLocation"']) expect(json).not.toContain(key);
    for (const secret of [cand.email, seeker.email, '+639170000002', '14.2231987', '121.1612345', '14.2150123']) {
      expect(json).not.toContain(secret);
    }
  });

  it('clamps ?tau= to the ladder range', async () => {
    expect((await api('GET', '/matchmake?tau=0.1', seeker.token)).body.tau).toBe(0.75);
    expect((await api('GET', '/matchmake?tau=7', seeker.token)).body.tau).toBe(0.95);
    expect((await api('GET', '/matchmake?tau=0.8', seeker.token)).body.tau).toBe(0.8);
  });

  it('is 404 for an account with no profile and 401 without a token', async () => {
    const bare = await registerUser();
    const res = await api('GET', '/matchmake', bare.token);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
    expect((await api('GET', '/matchmake')).status).toBe(401);
  });

  describe('GET /algorithm/explain/:playerId', () => {
    it('equals the engine scorePair for the same pair and leaks nothing private', async () => {
      const { status, body } = await api('GET', `/algorithm/explain/${cand.uid}`, seeker.token);
      expect(status).toBe(200);

      // Only the caller's own fix is precise; the candidate is scored on the public coarse location.
      const strip = ({ email, phone, preciseLocation, ...p }: typeof seeker.profile) => p;
      const s = { ...strip(seeker.profile), location: SEEKER_GPS };
      const c = strip(cand.profile);
      const expected = scorePair(s, c, new InteractionMatrix(await loadEngagements()), DEFAULT_CONFIG);
      expect(body.score).toBe(expected.score);
      expect(body.content.total).toBe(expected.content);
      expect(body.cf.similarity).toBe(expected.cfSim);
      expect(body.cf.weight).toBe(expected.cfW);
      expect(body.tau).toBe(CALIBRATED_TAU);
      expect(body.recommended).toBe(body.gate.passed && expected.score >= CALIBRATED_TAU);
      expect(typeof body.gate.passed).toBe('boolean');
      expect(body.content.weights).toEqual({ skill: 0.35, schedule: 0.3, distance: 0.15, intent: 0.12, format: 0.08 });
      const sum = Object.entries(body.content.weights).reduce(
        (acc, [k, w]) => acc + (w as number) * body.content[k],
        0,
      );
      expect(sum).toBeCloseTo(body.content.total, 10);
      expect(typeof body.cf.sharedItems).toBe('number');

      const json = JSON.stringify(body);
      for (const secret of ['"email"', '"phone"', '14.2231987', '121.1612345', '14.2150123']) {
        expect(json).not.toContain(secret);
      }
    });

    it('rejects explaining yourself (400), an unknown player (404) and a caller with no profile (404)', async () => {
      expect((await api('GET', `/algorithm/explain/${seeker.uid}`, seeker.token)).status).toBe(400);
      expect((await api('GET', '/algorithm/explain/nobody', seeker.token)).status).toBe(404);
      const bare = await registerUser();
      expect((await api('GET', `/algorithm/explain/${cand.uid}`, bare.token)).status).toBe(404);
    });

    it('does not explain a player who opted out of matchmaking', async () => {
      const hidden = await registerPlayer({ matchmakingOptIn: false });
      expect((await api('GET', `/algorithm/explain/${hidden.uid}`, seeker.token)).status).toBe(404);
    });
  });

  describe('another player\'s GPS fix is never used (RA 10173)', () => {
    const FAR_GPS = { lat: 14.1725, lng: 121.2412 }; // inside the corridor, ~9 km from the victim's home area
    const OTHER_GPS = { lat: 14.2301, lng: 121.1511 };
    let victim: Awaited<ReturnType<typeof registerPlayer>>;
    const setFix = (fix: { lat: number; lng: number }) =>
      db.collection('users').doc(victim.uid).collection('private').doc('profile').update({ preciseLocation: fix });
    const view = async () => {
      const mm = (await api('GET', '/matchmake', seeker.token)).body.scored.find((c: any) => c.profile.id === victim.uid);
      const ex = (await api('GET', `/algorithm/explain/${victim.uid}`, seeker.token)).body;
      return { mm, ex };
    };

    beforeAll(async () => {
      victim = await registerPlayer({ preciseLocation: FAR_GPS });
    });

    it('scores the victim on their coarse location and ignores a changed fix', async () => {
      const coarse = { ...victim.profile, preciseLocation: undefined, email: undefined, phone: undefined };
      const expectedGate = evaluateGate({ ...seeker.profile, location: SEEKER_GPS }, coarse as any, DEFAULT_CONFIG);

      const first = await view();
      expect(first.mm.distanceKm).toBe(expectedGate.distanceKm);
      expect(first.ex.gate.distanceKm).toBe(expectedGate.distanceKm);

      await setFix(OTHER_GPS);
      const second = await view();
      expect(second.mm.distanceKm).toBe(first.mm.distanceKm);
      expect(second.mm.score).toBe(first.mm.score);
      expect(second.ex.gate.distanceKm).toBe(first.ex.gate.distanceKm);
      expect(second.ex.score).toBe(first.ex.score);
    });

    it('lab scores a non-caller seeker on coarse locations only', async () => {
      const admin = await registerPlayer({}, 'admin');
      const before = (await api('GET', `/algorithm/lab/${seeker.uid}`, admin.token)).body.candidates.find((c: any) => c.profile.id === victim.uid);
      await setFix(FAR_GPS);
      const after = (await api('GET', `/algorithm/lab/${seeker.uid}`, admin.token)).body.candidates.find((c: any) => c.profile.id === victim.uid);
      expect(after.gate.distanceKm).toBe(before.gate.distanceKm);
      expect(after.score).toBe(before.score);
      const seekerCoarse = { ...seeker.profile, preciseLocation: undefined, email: undefined, phone: undefined };
      expect(after.gate.distanceKm).toBe(evaluateGate(seekerCoarse as any, victim.profile as any, DEFAULT_CONFIG).distanceKm);
    });
  });
});
