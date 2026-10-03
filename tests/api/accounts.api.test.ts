import { randomUUID } from 'node:crypto';

import { db } from '../../src/firebase';
import { api, registerPlayer, registerUser } from './helper';

const PASSWORD = 'Passw0rd!';
const profile = (over: Record<string, unknown> = {}) => ({
  displayName: 'Alex Cruz',
  tier: 'intermediate',
  areaLabel: 'Calamba Poblacion',
  location: { lat: 14.2117, lng: 121.1653 },
  availability: [{ day: 6, startMin: 360, endMin: 720 }],
  format: 'both',
  intent: 'both',
  matchmakingOptIn: true,
  ...over,
});
const newEmail = () => `${randomUUID()}@test.local`;

describe('POST /auth/*', () => {
  const email = newEmail();
  let tokens: any;

  it('registers an account', async () => {
    const res = await api('POST', '/auth/register', undefined, { email, password: PASSWORD });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(['expiresIn', 'idToken', 'refreshToken', 'uid']);
    tokens = res.body;
    expect((await api('GET', '/me', tokens.idToken)).status).toBe(404);
  });

  it('409s on a duplicate email', async () => {
    const res = await api('POST', '/auth/register', undefined, { email, password: PASSWORD });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('conflict');
  });

  it('400s on bad register input', async () => {
    for (const bad of [undefined, {}, { email: 'nope', password: PASSWORD }, { email: newEmail(), password: '123' }, { email: newEmail(), password: 5 }]) {
      const res = await api('POST', '/auth/register', undefined, bad);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('invalid');
    }
  });

  it('logs in and 401s on bad credentials', async () => {
    const ok = await api('POST', '/auth/login', undefined, { email, password: PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.body.uid).toBe(tokens.uid);
    for (const bad of [{ email, password: 'wrong-password' }, { email: newEmail(), password: PASSWORD }]) {
      const res = await api('POST', '/auth/login', undefined, bad);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('unauthenticated');
      expect(JSON.stringify(res.body)).not.toMatch(/INVALID|EMAIL_NOT_FOUND/);
    }
    expect((await api('POST', '/auth/login', undefined, {})).status).toBe(400);
  });

  it('refreshes a token and 401s on a bad refresh token', async () => {
    const ok = await api('POST', '/auth/refresh', undefined, { refreshToken: tokens.refreshToken });
    expect(ok.status).toBe(200);
    expect(Object.keys(ok.body).sort()).toEqual(['expiresIn', 'idToken', 'refreshToken']);
    expect((await api('GET', '/me', ok.body.idToken)).status).toBe(404);
    expect((await api('POST', '/auth/refresh', undefined, { refreshToken: 'garbage' })).status).toBe(401);
    expect((await api('POST', '/auth/refresh', undefined, {})).status).toBe(400);
  });
});

describe('/me', () => {
  it('register -> onboard -> login again keeps the profile', async () => {
    const email = newEmail();
    const reg = await api('POST', '/auth/register', undefined, { email, password: PASSWORD });
    const put = await api('PUT', '/me', reg.body.idToken, profile({ phone: '0917-555-0000', preciseLocation: { lat: 14.2, lng: 121.17 } }));
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ id: reg.body.uid, email, role: 'player', onboarded: true, phone: '0917-555-0000' });

    const login = await api('POST', '/auth/login', undefined, { email, password: PASSWORD });
    const me = await api('GET', '/me', login.body.idToken);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ id: reg.body.uid, displayName: 'Alex Cruz', email, preciseLocation: { lat: 14.2, lng: 121.17 } });
  });

  it('ignores id, role, isSample from the client and keeps the partner fields', async () => {
    const p = await registerPlayer({ doublesPartnerId: 'someone', partnerConfirmed: true });
    const res = await api('PUT', '/me', p.token, profile({ id: 'hijack', role: 'admin', isSample: true, doublesPartnerId: 'x', partnerConfirmed: false }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: p.uid, role: 'player', doublesPartnerId: 'someone', partnerConfirmed: true });
    expect(res.body.isSample).toBeUndefined();
  });

  it('rejects invalid profiles', async () => {
    const { token } = await registerUser();
    const bads = [
      undefined,
      profile({ displayName: 'A' }),
      profile({ displayName: 42 }),
      profile({ tier: 'pro' }),
      profile({ areaLabel: 'Manila' }),
      profile({ format: 'trios' }),
      profile({ intent: 'x' }),
      profile({ matchmakingOptIn: 'yes' }),
      profile({ availability: 'always' }),
      profile({ availability: [{ day: 7, startMin: 360, endMin: 720 }] }),
      profile({ availability: [{ day: 1, startMin: 720, endMin: 360 }] }),
      profile({ rating: 9 }),
      profile({ preciseLocation: { lat: 'a', lng: 1 } }),
    ];
    for (const bad of bads) {
      const res = await api('PUT', '/me', token, bad);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('invalid');
    }
    expect((await api('GET', '/me', token)).status).toBe(404);
  });

  it('stores a push token', async () => {
    const { token, uid } = await registerUser();
    expect((await api('POST', '/me/push-token', token, { token: 'ExponentPushToken[abc]' })).status).toBe(204);
    expect((await db.collection('pushTokens').doc(uid).get()).data()).toMatchObject({ userId: uid, token: 'ExponentPushToken[abc]' });
    expect((await api('POST', '/me/push-token', token, { token: '' })).status).toBe(400);
    expect((await api('POST', '/me/push-token', undefined, { token: 'x' })).status).toBe(401);
  });
});

describe('GET /players', () => {
  it('hides email, phone and the precise location, and lists opt-in players only', async () => {
    const a = await registerUser();
    const put = await api('PUT', '/me', a.token, profile({ phone: '0917-555-1111', preciseLocation: { lat: 14.2301, lng: 121.1111 } }));
    expect(put.status).toBe(200);
    const optedOut = await registerPlayer({ matchmakingOptIn: false });
    const b = await registerPlayer();

    const res = await api('GET', '/players', b.token);
    expect(res.status).toBe(200);
    const mine = res.body.find((p: any) => p.id === a.uid);
    expect(mine.displayName).toBe('Alex Cruz');
    expect(mine.location).toEqual({ lat: 14.2117, lng: 121.1653 }); // area centroid, not the GPS fix
    for (const p of res.body) for (const k of ['email', 'phone', 'preciseLocation']) expect(k in p).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('0917-555-1111');
    expect(JSON.stringify(res.body)).not.toContain('14.2301');
    expect(res.body.some((p: any) => p.id === optedOut.uid)).toBe(false);
    expect((await api('GET', '/players')).status).toBe(401);
  });
});
