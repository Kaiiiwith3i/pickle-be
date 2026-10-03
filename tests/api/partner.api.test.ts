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
