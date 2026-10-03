import { db } from '../../src/firebase';
import { sessionRecipientTokens } from '../../src/routes/sessions';
import { api, registerPlayer } from './helper';

const COURT = { lat: 14.2117, lng: 121.1653 };
const FAR = { lat: 14.5995, lng: 120.9842 }; // Manila, ~60 km away

const startsAt = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();

async function makeCourt() {
  const ref = db.collection('courts').doc();
  await ref.set({ name: 'Test Court', barangay: 'Poblacion', city: 'Calamba', location: COURT, verified: true });
  return ref.id;
}

const body = (courtId: string, extra: object = {}) => ({
  courtId,
  title: 'Sunday OpenPlay',
  startsAt: startsAt(24),
  durationMin: 120,
  capacity: 3,
  tierRestriction: null,
  ...extra,
});

describe('OpenPlay sessions', () => {
  let host: Awaited<ReturnType<typeof registerPlayer>>;
  let guest: typeof host;
  let guest2: typeof host;
  let courtId: string;

  beforeAll(async () => {
    [host, guest, guest2] = await Promise.all([registerPlayer(), registerPlayer(), registerPlayer()]);
    courtId = await makeCourt();
  });

  it('creates a session with the caller as host and first attendee', async () => {
    const res = await api('POST', '/sessions', host.token, body(courtId, { hostId: 'x', attendeeIds: ['y'], isSample: true }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ hostId: host.uid, attendeeIds: [host.uid], capacity: 3, courtId });
    expect(res.body.isSample).toBeUndefined();
    expect(typeof res.body.id).toBe('string');
  });

  it('lists sessions ordered by startsAt', async () => {
    const late = await api('POST', '/sessions', host.token, body(courtId, { startsAt: startsAt(500) }));
    const early = await api('POST', '/sessions', host.token, body(courtId, { startsAt: startsAt(400) }));
    const { status, body: list } = await api('GET', '/sessions', guest.token);
    expect(status).toBe(200);
    const ids = list.map((s: any) => s.id);
    expect(ids.indexOf(early.body.id)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(early.body.id)).toBeLessThan(ids.indexOf(late.body.id));
    const times = list.map((s: any) => s.startsAt);
    expect(times).toEqual([...times].sort());
  });

  it.each([
    ['unknown court', { courtId: 'nope' }],
    ['empty title', { title: '  ' }],
    ['bad startsAt', { startsAt: 'tomorrow' }],
    ['startsAt in the past', { startsAt: startsAt(-1) }],
    ['non-positive duration', { durationMin: 0 }],
    ['capacity below 2', { capacity: 1 }],
    ['fractional capacity', { capacity: 2.5 }],
    ['bad tier', { tierRestriction: ['pro'] }],
    ['empty tier list', { tierRestriction: [] }],
  ])('rejects %s with 400', async (_name, extra) => {
    const res = await api('POST', '/sessions', host.token, body(courtId, extra));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid');
  });

  describe('attendance', () => {
    let id: string;
    beforeAll(async () => {
      id = (await api('POST', '/sessions', host.token, body(courtId, { capacity: 2 }))).body.id;
    });

    it('toggles the caller in and out', async () => {
      const join = await api('POST', `/sessions/${id}/attendance`, guest.token);
      expect(join.status).toBe(200);
      expect(join.body.attendeeIds).toEqual([host.uid, guest.uid]);
      const leave = await api('POST', `/sessions/${id}/attendance`, guest.token);
      expect(leave.body.attendeeIds).toEqual([host.uid]);
    });

    it('refuses a join when the session is full (409)', async () => {
      await api('POST', `/sessions/${id}/attendance`, guest.token);
      const res = await api('POST', `/sessions/${id}/attendance`, guest2.token);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('conflict');
    });

    it('does not let the host leave their own session (409)', async () => {
      const res = await api('POST', `/sessions/${id}/attendance`, host.token);
      expect(res.status).toBe(409);
    });

    it('is closed once the session has started: neither join nor leave (409)', async () => {
      const ref = db.collection('sessions').doc();
      await ref.set({ ...body(courtId), hostId: host.uid, startsAt: startsAt(-1), attendeeIds: [host.uid, guest.uid], capacity: 4 });
      for (const who of [guest, guest2]) {
        const res = await api('POST', `/sessions/${ref.id}/attendance`, who.token);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('conflict');
      }
      expect((await ref.get()).data()!.attendeeIds).toEqual([host.uid, guest.uid]);
    });

    it('404s on an unknown session', async () => {
      expect((await api('POST', '/sessions/nope/attendance', guest.token)).status).toBe(404);
    });
  });

  describe('delete', () => {
    it('lets only the host delete', async () => {
      const id = (await api('POST', '/sessions', host.token, body(courtId))).body.id;
      const other = await api('DELETE', `/sessions/${id}`, guest.token);
      expect(other.status).toBe(403);
      expect((await api('DELETE', `/sessions/${id}`, host.token)).status).toBe(204);
      expect((await api('DELETE', `/sessions/${id}`, host.token)).status).toBe(404);
    });
  });

  describe('proximity notification selection', () => {
    it('selects tokens of eligible nearby players only', async () => {
      const near = await registerPlayer({ tier: 'intermediate' });
      const gps = await registerPlayer({ tier: 'intermediate', location: FAR, preciseLocation: COURT });
      const far = await registerPlayer({ tier: 'intermediate', location: FAR });
      const wrongTier = await registerPlayer({ tier: 'beginner' });
      const optedOut = await registerPlayer({ tier: 'intermediate', matchmakingOptIn: false });
      const hostTok = await registerPlayer({ tier: 'intermediate' });
      for (const p of [near, gps, far, wrongTier, optedOut, hostTok]) {
        await db.collection('pushTokens').doc(p.uid).set({ userId: p.uid, token: `ExpoPushToken[${p.uid}]`, updatedAt: '' });
      }
      const session = { hostId: hostTok.uid, tierRestriction: ['intermediate'] } as any;
      const tokens = await sessionRecipientTokens(session, { location: COURT } as any);
      const tok = (p: { uid: string }) => `ExpoPushToken[${p.uid}]`;
      expect(tokens).toContain(tok(near));
      expect(tokens).toContain(tok(gps)); // coarse area is far, precise GPS is at the court
      for (const p of [far, wrongTier, optedOut, hostTok]) expect(tokens).not.toContain(tok(p));
    });
  });
});
