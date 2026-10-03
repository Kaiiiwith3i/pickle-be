import { api, registerPlayer } from './helper';

type P = Awaited<ReturnType<typeof registerPlayer>>;

describe('community posts and match results', () => {
  let author: P, opp: P, third: P, admin: P;
  beforeAll(async () => {
    [author, opp, third, admin] = await Promise.all([
      registerPlayer(), registerPlayer(), registerPlayer(), registerPlayer({}, 'admin'),
    ]);
  });

  const match = (extra: object = {}) => ({
    kind: 'match_summary', body: 'Good game', scoreLine: '11-7, 9-11, 11-8', opponentId: opp.uid, winnerId: author.uid, ...extra,
  });
  const logMatch = async (extra: object = {}) => (await api('POST', '/posts', author.token, match(extra))).body;
  const act = (id: string, verb: string, user: P, body?: object) => api('POST', `/posts/${id}/${verb}`, user.token, body);

  describe('POST /posts', () => {
    it('creates a plain post and ignores fields clients may not set', async () => {
      const res = await api('POST', '/posts', author.token, {
        kind: 'post', body: 'Hello', authorId: 'someone', likedBy: ['x'], isSample: true, confirmed: true, verificationStatus: 'approved',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ authorId: author.uid, kind: 'post', body: 'Hello', likedBy: [] });
      expect(res.body.isSample).toBeUndefined();
      expect(res.body.confirmed).toBeUndefined();
      expect(res.body.verificationStatus).toBeUndefined();
    });

    it('starts a match result pending and unconfirmed, whatever the client sends', async () => {
      const res = await api('POST', '/posts', author.token, match({ confirmed: true, verificationStatus: 'approved', isSample: true, likedBy: ['x'] }));
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        authorId: author.uid, opponentId: opp.uid, winnerId: author.uid, scoreLine: '11-7 · 9-11 · 11-8',
        confirmed: false, disputed: false, verificationStatus: 'pending', likedBy: [],
      });
      expect(res.body.isSample).toBeUndefined();
    });

    it.each([
      ['unknown kind', { kind: 'story' }],
      ['empty body on a plain post', { kind: 'post', body: ' ' }],
      ['self as opponent', { opponentId: 'SELF' }],
      ['unknown opponent', { opponentId: 'nobody' }],
      ['missing opponent', { opponentId: undefined }],
      ['winner who is not a player', { winnerId: 'x' }],
      ['bad score line', { scoreLine: '11-10' }],
      ['missing score line', { scoreLine: undefined }],
      ['winner contradicting the score', { winnerId: 'OPP' }],
      ['unknown court', { courtId: 'nope' }],
    ])('rejects %s with 400', async (_n, extra: any) => {
      const fixed = { ...extra };
      if (fixed.opponentId === 'SELF') fixed.opponentId = author.uid;
      if (fixed.winnerId === 'OPP') fixed.winnerId = opp.uid;
      const res = await api('POST', '/posts', author.token, match(fixed));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('invalid');
    });
  });

  it('lists posts newest first, with pending distinguishable from confirmed', async () => {
    const a = await logMatch();
    const b = await logMatch();
    await act(b.id, 'confirm', opp);
    const { status, body } = await api('GET', '/posts', third.token);
    expect(status).toBe(200);
    const ids = body.map((p: any) => p.id);
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(a.id));
    expect(body.find((p: any) => p.id === a.id)).toMatchObject({ confirmed: false, verificationStatus: 'pending' });
    expect(body.find((p: any) => p.id === b.id)).toMatchObject({ confirmed: true, verificationStatus: 'approved' });
  });

  it('toggles likes per caller', async () => {
    const p = await logMatch();
    expect((await act(p.id, 'like', third)).body.likedBy).toEqual([third.uid]);
    expect((await act(p.id, 'like', opp)).body.likedBy).toEqual([third.uid, opp.uid]);
    expect((await act(p.id, 'like', third)).body.likedBy).toEqual([opp.uid]);
    expect((await act('nope', 'like', third)).status).toBe(404);
  });

  describe('confirm', () => {
    it('refuses the author and third parties (403), accepts the opponent', async () => {
      const p = await logMatch();
      for (const u of [author, third, admin]) expect((await act(p.id, 'confirm', u)).status).toBe(403);
      const ok = await act(p.id, 'confirm', opp);
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ confirmed: true, disputed: false, verificationStatus: 'approved' });
    });

    it('refuses to confirm twice or resolve a plain post (409), and an unknown post (404)', async () => {
      const p = await logMatch();
      await act(p.id, 'confirm', opp);
      expect((await act(p.id, 'confirm', opp)).status).toBe(409);
      const plain = (await api('POST', '/posts', opp.token, { kind: 'post', body: 'hi' })).body;
      expect((await act(plain.id, 'confirm', opp)).status).toBe(403); // no opponent on a plain post
      expect((await act(plain.id, 'resolve', admin, { action: 'confirm' })).status).toBe(409);
      expect((await act('nope', 'confirm', opp)).status).toBe(404);
    });
  });

  describe('dispute', () => {
    it('is opponent only and marks the result rejected', async () => {
      const p = await logMatch();
      expect((await act(p.id, 'dispute', author)).status).toBe(403);
      const res = await act(p.id, 'dispute', opp);
      expect(res.body).toMatchObject({ confirmed: false, disputed: true, verificationStatus: 'rejected' });
      expect((await act(p.id, 'confirm', opp)).status).toBe(409);
    });
  });

  describe('counter-score', () => {
    it('lets the opponent propose, validates it, and lets only the author accept', async () => {
      const p = await logMatch();
      expect((await act(p.id, 'counter-score', author, { scoreLine: '11-9 · 11-8' })).status).toBe(403);
      expect((await act(p.id, 'counter-score', opp, { scoreLine: '11-10' })).status).toBe(400);
      expect((await act(p.id, 'counter-score', opp, {})).status).toBe(400);
      const c = await act(p.id, 'counter-score', opp, { scoreLine: '9-11, 9-11' });
      expect(c.body).toMatchObject({ counterScoreLine: '9-11 · 9-11', counterProposedBy: opp.uid, verificationStatus: 'pending' });
      expect((await act(p.id, 'accept-counter', opp)).status).toBe(403);
      expect((await act(p.id, 'accept-counter', third)).status).toBe(403);
      const ok = await act(p.id, 'accept-counter', author);
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ scoreLine: '9-11 · 9-11', winnerId: opp.uid, confirmed: true, verificationStatus: 'approved' });
      expect(ok.body.counterScoreLine).toBeUndefined();
    });

    it('refuses accept-counter when there is none (409)', async () => {
      const p = await logMatch();
      expect((await act(p.id, 'accept-counter', author)).status).toBe(409);
    });
  });

  describe('resolve', () => {
    it('is admin only and validates the action', async () => {
      const p = await logMatch();
      for (const u of [author, opp, third]) expect((await act(p.id, 'resolve', u, { action: 'confirm' })).status).toBe(403);
      expect((await act(p.id, 'resolve', admin, { action: 'explode' })).status).toBe(400);
      expect((await act(p.id, 'resolve', admin, {})).status).toBe(400);
    });

    it('confirms a disputed result, voids it, and then refuses further changes', async () => {
      const p = await logMatch();
      await act(p.id, 'dispute', opp);
      expect((await act(p.id, 'resolve', admin, { action: 'confirm' })).body).toMatchObject({ confirmed: true, verificationStatus: 'approved' });
      expect((await act(p.id, 'resolve', admin, { action: 'void' })).body).toMatchObject({ confirmed: false, verificationStatus: 'expired' });
      expect((await act(p.id, 'resolve', admin, { action: 'confirm' })).status).toBe(409);
    });

    it('dismisses and re-opens', async () => {
      const p = await logMatch();
      expect((await act(p.id, 'resolve', admin, { action: 'dismiss' })).body).toMatchObject({ disputed: true, verificationStatus: 'rejected' });
      expect((await act(p.id, 'resolve', admin, { action: 're_entry' })).body).toMatchObject({ disputed: false, verificationStatus: 'pending' });
    });
  });
});
