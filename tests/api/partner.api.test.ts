import { db } from '../../src/firebase';
import { api, registerPlayer, registerUser } from './helper';

const user = async (uid: string) => (await db.collection('users').doc(uid).get()).data();

describe('partner invites (ticket 10)', () => {
  let a: Awaited<ReturnType<typeof registerPlayer>>;
  let b: Awaited<ReturnType<typeof registerPlayer>>;
  let c: Awaited<ReturnType<typeof registerPlayer>>;

  beforeAll(async () => {
    [a, b, c] = [await registerPlayer(), await registerPlayer(), await registerPlayer()];
  });

  it('sends an invite, lists it as outgoing for the sender and incoming for the invitee', async () => {
    const res = await api('POST', '/partner-invites', a.token, { toId: b.uid });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fromId: a.uid, toId: b.uid, status: 'pending' });
    expect(typeof res.body.id).toBe('string');
    expect(Number.isNaN(Date.parse(res.body.createdAt))).toBe(false);

    const mineA = (await api('GET', '/partner-invites', a.token)).body;
    expect(mineA.outgoing.map((i: any) => i.id)).toContain(res.body.id);
    expect(mineA.incoming.map((i: any) => i.id)).not.toContain(res.body.id);
    const mineB = (await api('GET', '/partner-invites', b.token)).body;
    expect(mineB.incoming).toContainEqual(res.body);
    expect(mineB.outgoing).toEqual([]);
    const stranger = (await api('GET', '/partner-invites', c.token)).body;
    expect(stranger).toEqual({ incoming: [], outgoing: [] });
  });

  it('refuses a duplicate pending invite in either direction (409)', async () => {
    for (const [from, to] of [[a, b], [b, a]]) {
      const res = await api('POST', '/partner-invites', from.token, { toId: to.uid });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('conflict');
    }
  });

  it('validates the target: self 400, unknown 404, bad body 400', async () => {
    expect((await api('POST', '/partner-invites', a.token, { toId: a.uid })).status).toBe(400);
    expect((await api('POST', '/partner-invites', a.token, { toId: 'nobody' })).status).toBe(404);
    expect((await api('POST', '/partner-invites', a.token, {})).status).toBe(400);
    const bare = await registerUser();
    expect((await api('POST', '/partner-invites', bare.token, { toId: b.uid })).status).toBe(404);
  });

  it('only the invitee may respond (403) and the body must say accept true/false (400)', async () => {
    const { body: invite } = await api('GET', '/partner-invites', b.token).then((r) => ({ body: r.body.incoming[0] }));
    expect((await api('POST', `/partner-invites/${invite.id}/respond`, a.token, { accept: true })).status).toBe(403);
    expect((await api('POST', `/partner-invites/${invite.id}/respond`, c.token, { accept: true })).status).toBe(403);
    expect((await api('POST', `/partner-invites/${invite.id}/respond`, b.token, { accept: 'yes' })).status).toBe(400);
    expect((await api('POST', '/partner-invites/nope/respond', b.token, { accept: true })).status).toBe(404);
    expect((await user(a.uid))?.partnerConfirmed).toBeUndefined();
  });

  it('accepting sets both players partner and partnerConfirmed, once (409 after)', async () => {
    const invite = (await api('GET', '/partner-invites', b.token)).body.incoming[0];
    const res = await api('POST', `/partner-invites/${invite.id}/respond`, b.token, { accept: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: invite.id, status: 'accepted' });
    expect(await user(a.uid)).toMatchObject({ doublesPartnerId: b.uid, partnerConfirmed: true });
    expect(await user(b.uid)).toMatchObject({ doublesPartnerId: a.uid, partnerConfirmed: true });

    const again = await api('POST', `/partner-invites/${invite.id}/respond`, b.token, { accept: false });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('conflict');
    expect((await user(a.uid))?.partnerConfirmed).toBe(true);
  });

  it('declining marks the invite declined and changes neither player', async () => {
    const d = await registerPlayer();
    const e = await registerPlayer();
    const { body: invite } = await api('POST', '/partner-invites', d.token, { toId: e.uid });
    const res = await api('POST', `/partner-invites/${invite.id}/respond`, e.token, { accept: false });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('declined');
    expect((await user(d.uid))?.doublesPartnerId).toBeUndefined();
    expect((await user(e.uid))?.doublesPartnerId).toBeUndefined();
    // a declined invite no longer blocks a new one
    expect((await api('POST', '/partner-invites', d.token, { toId: e.uid })).status).toBe(201);
  });
});

describe('a confirmed partner is released when the other player moves on', () => {
  const confirmed = async (x: any, y: any) => {
    const inv = (await api('POST', '/partner-invites', x.token, { toId: y.uid })).body;
    expect((await api('POST', `/partner-invites/${inv.id}/respond`, y.token, { accept: true })).status).toBe(200);
  };
  const state = async (uid: string) => {
    const d = await user(uid);
    return { doublesPartnerId: d?.doublesPartnerId, partnerConfirmed: d?.partnerConfirmed };
  };
  const free = { doublesPartnerId: undefined, partnerConfirmed: undefined };

  it('PUT /me/partner to someone else, or to null, clears the previous partner', async () => {
    const [a, b, c] = [await registerPlayer(), await registerPlayer(), await registerPlayer()];
    await confirmed(a, b);
    expect((await api('PUT', '/me/partner', a.token, { partnerId: c.uid })).status).toBe(200);
    expect(await state(b.uid)).toEqual(free);
    expect(await state(a.uid)).toEqual({ doublesPartnerId: c.uid, partnerConfirmed: false });

    await confirmed(b, c);
    await api('PUT', '/me/partner', b.token, { partnerId: null });
    expect(await state(b.uid)).toEqual(free);
    expect(await state(c.uid)).toEqual(free);
  });

  it('accepting an invite clears the previous partner of both players', async () => {
    const [a, b, c, d] = [await registerPlayer(), await registerPlayer(), await registerPlayer(), await registerPlayer()];
    await confirmed(a, b);
    await confirmed(c, d);
    await confirmed(a, c); // a leaves b, c leaves d
    expect(await state(b.uid)).toEqual(free);
    expect(await state(d.uid)).toEqual(free);
    expect(await state(a.uid)).toEqual({ doublesPartnerId: c.uid, partnerConfirmed: true });
    expect(await state(c.uid)).toEqual({ doublesPartnerId: a.uid, partnerConfirmed: true });
  });

  it('leaves a previous partner alone when they have already moved on to someone else', async () => {
    const [a, b, c] = [await registerPlayer(), await registerPlayer(), await registerPlayer()];
    await confirmed(a, b);
    await confirmed(b, c); // b now with c; a still points at b
    await api('PUT', '/me/partner', a.token, { partnerId: null }); // b does not point back at a
    expect(await state(b.uid)).toEqual({ doublesPartnerId: c.uid, partnerConfirmed: true });
  });
});
