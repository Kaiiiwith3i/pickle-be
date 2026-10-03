import { db } from '../../src/firebase';
import { withPrecise } from '../../src/data';
import { DEFAULT_CONFIG, evaluateGate } from '../../src/engine';
import type { PublicPlayer } from '../../src/types';
import { api, registerPlayer, registerUser } from './helper';

const gps = (n: number) => ({ lat: 14.21 + n * 0.0001234, lng: 121.165 + n * 0.0001567 });

describe('doubles (ticket 09)', () => {
  let seeker: Awaited<ReturnType<typeof registerPlayer>>;
  let partner: Awaited<ReturnType<typeof registerPlayer>>;
  let r: Awaited<ReturnType<typeof registerPlayer>>;
  let s: Awaited<ReturnType<typeof registerPlayer>>;
  let p: Awaited<ReturnType<typeof registerPlayer>>;
  let q: Awaited<ReturnType<typeof registerPlayer>>;

  beforeAll(async () => {
    seeker = await registerPlayer({ preciseLocation: gps(1), phone: '+639171110001' });
    partner = await registerPlayer({ preciseLocation: gps(2), phone: '+639171110002' });
    r = await registerPlayer({ preciseLocation: gps(3) });
    s = await registerPlayer({ preciseLocation: gps(4) });
    // p and q have no shared time with each other, so they can never be teammates.
    p = await registerPlayer({ availability: [{ day: 6, startMin: 360, endMin: 540 }], preciseLocation: gps(5) });
    q = await registerPlayer({ availability: [{ day: 6, startMin: 600, endMin: 720 }], preciseLocation: gps(6) });
  });

  describe('PUT /me/partner', () => {
    it('saves the partner unconfirmed and returns the caller AppUser', async () => {
      const { status, body } = await api('PUT', '/me/partner', seeker.token, { partnerId: partner.uid });
      expect(status).toBe(200);
      expect(body.id).toBe(seeker.uid);
      expect(body.doublesPartnerId).toBe(partner.uid);
      expect(body.partnerConfirmed).toBe(false);
      expect(body.email).toBe(seeker.email);
      expect((await db.collection('users').doc(seeker.uid).get()).data()).toMatchObject({
        doublesPartnerId: partner.uid,
        partnerConfirmed: false,
      });
    });

    it('rejects yourself (400), an unknown player (404), a bad body (400)', async () => {
      expect((await api('PUT', '/me/partner', seeker.token, { partnerId: seeker.uid })).status).toBe(400);
      expect((await api('PUT', '/me/partner', seeker.token, { partnerId: 'nobody' })).status).toBe(404);
      for (const bad of [{}, { partnerId: 5 }, { partnerId: '' }]) {
        const res = await api('PUT', '/me/partner', seeker.token, bad);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('invalid');
      }
    });

    it('is 404 for an account with no profile', async () => {
      const bare = await registerUser();
      expect((await api('PUT', '/me/partner', bare.token, { partnerId: partner.uid })).status).toBe(404);
    });

    it('clears the partner with null', async () => {
      const lone = await registerPlayer();
      await api('PUT', '/me/partner', lone.token, { partnerId: partner.uid });
      const { status, body } = await api('PUT', '/me/partner', lone.token, { partnerId: null });
      expect(status).toBe(200);
      expect(body.doublesPartnerId).toBeUndefined();
      expect(body.partnerConfirmed).toBeUndefined();
      expect((await db.collection('users').doc(lone.uid).get()).data()).not.toHaveProperty('doublesPartnerId');
    });
  });

  describe('GET /matchmake/doubles', () => {
    it('asks for a partner instead of assigning a stranger', async () => {
      const lone = await registerPlayer();
      const res = await api('GET', '/matchmake/doubles', lone.token);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('invalid');
      expect(res.body.error.message).toMatch(/partner/i);
    });

    it('is 404 for a partnerId that does not exist, 400 for yourself', async () => {
      expect((await api('GET', '/matchmake/doubles?partnerId=nobody', seeker.token)).status).toBe(404);
      expect((await api('GET', `/matchmake/doubles?partnerId=${seeker.uid}`, seeker.token)).status).toBe(400);
    });

    it('forms only real, distinct, gate-passing opposing teams and returns only public profiles', async () => {
      const { status, body } = await api('GET', '/matchmake/doubles', seeker.token); // saved partner
      expect(status).toBe(200);
      expect(body.seekerTeamId).toBe(`team_${seeker.uid}_${partner.uid}`);

      const teams = body.scored.map((c: any) => c.team);
      const ours = new Set([r.uid, s.uid, p.uid, q.uid]);
      const mine = teams.filter((t: any) => ours.has(t.player1.id) && ours.has(t.player2.id));
      const pairs = mine.map((t: any) => [t.player1.id, t.player2.id].sort().join('+'));
      expect(pairs).toContain([r.uid, s.uid].sort().join('+'));
      expect(pairs).toContain([r.uid, p.uid].sort().join('+'));
      expect(pairs).not.toContain([p.uid, q.uid].sort().join('+')); // fail the gate with each other

      const optedIn = new Set((await db.collection('users').where('matchmakingOptIn', '==', true).get()).docs.map((d) => d.id));
      const precise = new Map((await withPrecise<PublicPlayer>(teams.flatMap((t: any) => [t.player1, t.player2]))).map((x) => [x.id, x]));
      for (const c of [...body.scored, ...body.recommended]) {
        const { player1, player2 } = c.team;
        expect(player1.id).not.toBe(player2.id);
        expect([seeker.uid, partner.uid]).not.toContain(player1.id);
        expect([seeker.uid, partner.uid]).not.toContain(player2.id);
        expect(optedIn.has(player1.id) && optedIn.has(player2.id)).toBe(true);
        const [a, b] = [precise.get(player1.id)!, precise.get(player2.id)!];
        expect(evaluateGate(a, b, DEFAULT_CONFIG).passed).toBe(true);
        expect(evaluateGate(b, a, DEFAULT_CONFIG).passed).toBe(true);
      }

      const json = JSON.stringify(body);
      for (const key of ['"email"', '"phone"', '"preciseLocation"']) expect(json).not.toContain(key);
      for (const secret of ['+639171110001', '+639171110002', String(gps(3).lat), String(gps(4).lng)]) {
        expect(json).not.toContain(secret);
      }
    }, 30000);

    it('uses an explicit ?partnerId= over the saved one', async () => {
      const res = await api('GET', `/matchmake/doubles?partnerId=${r.uid}`, seeker.token);
      expect(res.status).toBe(200);
      expect(res.body.seekerTeamId).toBe(`team_${seeker.uid}_${r.uid}`);
    });
  });
});
