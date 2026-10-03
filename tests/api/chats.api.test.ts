import { db } from '../../src/firebase';
import { api, fixtureCourt, registerPlayer } from './helper';

type P = Awaited<ReturnType<typeof registerPlayer>>;

describe('chat', () => {
  let a: P, b: P, c: P, courtId: string;
  const chatId = (x: P, y: P) => `chat_${[x.uid, y.uid].sort().join('_')}`;
  const open = async (from: P, to: P) => (await api('POST', '/chats', from.token, { userId: to.uid })).body;
  const send = (from: P, id: string, body: object) => api('POST', `/chats/${id}/messages`, from.token, body);
  const unread = async (who: P, id: string) =>
    (await api('GET', '/chats', who.token)).body.find((t: any) => t.id === id)?.unreadCount;

  beforeAll(async () => {
    [a, b, c] = await Promise.all([registerPlayer(), registerPlayer(), registerPlayer()]);
    courtId = await fixtureCourt({ name: 'Chat Court' });
  });

  afterAll(async () => {
    await db.collection('courts').doc(courtId).delete();
  });

  describe('POST /chats', () => {
    it('creates a thread, and returns the same one from either side', async () => {
      const t = await api('POST', '/chats', a.token, { userId: b.uid });
      expect(t.status).toBe(200);
      expect(t.body).toMatchObject({ id: chatId(a, b), participantIds: [a.uid, b.uid].sort(), initiatedBy: a.uid, unreadCount: 0 });
      const again = await open(b, a);
      expect(again.id).toBe(t.body.id);
      expect(again.initiatedBy).toBe(a.uid);
    });

    it.each([['self', 'SELF'], ['an unknown user', 'nobody'], ['nothing', undefined], ['a non-string', 5]])('rejects %s with 400', async (_n, v) => {
      const res = await api('POST', '/chats', a.token, { userId: v === 'SELF' ? a.uid : v });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('invalid');
    });
  });

  describe('messages and unread counts', () => {
    it('two users exchange messages; unread rises per message and clears on /read', async () => {
      const id = (await open(a, b)).id;
      const m1 = await send(a, id, { text: ' hello ' });
      expect(m1.status).toBe(201);
      expect(m1.body).toMatchObject({ chatId: id, senderId: a.uid, text: 'hello', readBy: [a.uid] });
      await send(a, id, { text: 'you there?' });
      expect(await unread(b, id)).toBe(2);
      expect(await unread(a, id)).toBe(0);
      await send(b, id, { text: 'yes' });
      expect(await unread(a, id)).toBe(1);
      expect(await unread(b, id)).toBe(2);

      const read = await api('POST', `/chats/${id}/read`, b.token);
      expect(read.status).toBe(204);
      expect(await unread(b, id)).toBe(0);
      expect(await unread(a, id)).toBe(1);

      const list = await api('GET', `/chats/${id}/messages`, b.token);
      expect(list.body.map((m: any) => m.text)).toEqual(['hello', 'you there?', 'yes']);
      const thread = (await api('GET', '/chats', a.token)).body.find((t: any) => t.id === id);
      expect(thread.lastMessage).toBe('yes');
    });

    it('lists threads newest first', async () => {
      const first = (await open(a, c)).id;
      const second = (await open(a, b)).id;
      await send(a, first, { text: 'older' });
      await send(a, second, { text: 'newer' });
      const ids = (await api('GET', '/chats', a.token)).body.map((t: any) => t.id);
      expect(ids.indexOf(second)).toBeLessThan(ids.indexOf(first));
    });

    it('returns only the last 30 days, oldest first', async () => {
      const id = (await open(b, c)).id;
      const old = new Date(Date.now() - 40 * 86400_000).toISOString();
      await db.collection('chats').doc(id).collection('messages').add({ chatId: id, senderId: b.uid, text: 'ancient', createdAt: old, readBy: [b.uid] });
      await send(b, id, { text: 'recent' });
      const res = await api('GET', `/chats/${id}/messages`, c.token);
      expect(res.body.map((m: any) => m.text)).toEqual(['recent']);
    });

    it.each([['empty text', { text: '  ' }], ['non-string text', { text: 3 }], ['over-long text', { text: 'x'.repeat(2001) }], ['unknown court', { text: 'hi', courtId: 'nope' }]])(
      'rejects %s with 400',
      async (_n, body) => {
        const res = await send(a, (await open(a, b)).id, body);
        expect(res.status).toBe(400);
      },
    );

    it('keeps third users out of a thread (403) and 404s an unknown one', async () => {
      const id = (await open(a, b)).id;
      expect((await api('GET', `/chats/${id}/messages`, c.token)).status).toBe(403);
      expect((await send(c, id, { text: 'psst' })).status).toBe(403);
      expect((await api('POST', `/chats/${id}/read`, c.token)).status).toBe(403);
      expect((await api('GET', '/chats/chat_nope/messages', a.token)).status).toBe(404);
      const own = (await api('GET', '/chats', c.token)).body.map((t: any) => t.id);
      expect(own).not.toContain(id);
    });
  });

  describe('match proposals', () => {
    const proposal = (extra: object = {}) => ({ courtId: '', dateISO: '2030-05-01', timeSlotLabel: '6:00 PM', format: 'singles', ...extra });
    let id: string;
    beforeAll(async () => {
      id = (await open(a, b)).id;
    });

    it('always starts pending and shows in the thread preview', async () => {
      const res = await send(a, id, { text: 'Game?', courtId, proposal: proposal({ courtId, status: 'accepted' }) });
      expect(res.status).toBe(201);
      expect(res.body.proposal).toEqual({ courtId, dateISO: '2030-05-01', timeSlotLabel: '6:00 PM', format: 'singles', status: 'pending' });
      expect((await api('GET', '/chats', b.token)).body.find((t: any) => t.id === id).lastMessage).toBe('Match proposal: 6:00 PM');
    });

    it.each([
      ['bad date', { dateISO: '05/01/2030' }],
      ['impossible date', { dateISO: '2030-02-31' }],
      ['missing label', { timeSlotLabel: '' }],
      ['bad format', { format: 'triples' }],
      ['unknown court', { courtId: 'nope' }],
    ])('rejects a proposal with %s', async (_n, extra) => {
      const res = await send(a, id, { text: 'Game?', proposal: proposal({ courtId, ...extra }) });
      expect(res.status).toBe(400);
    });

    it('lets only the recipient answer, and only once', async () => {
      const m = (await send(a, id, { text: 'Another?', proposal: proposal({ courtId }) })).body;
      const url = `/chats/${id}/messages/${m.id}/proposal`;
      expect((await api('POST', url, a.token, { status: 'accepted' })).status).toBe(403);
      expect((await api('POST', url, c.token, { status: 'accepted' })).status).toBe(403);
      expect((await api('POST', url, b.token, { status: 'maybe' })).status).toBe(400);
      const ok = await api('POST', url, b.token, { status: 'accepted' });
      expect(ok.status).toBe(200);
      expect(ok.body.proposal).toMatchObject({ status: 'accepted', courtId, timeSlotLabel: '6:00 PM' });
      expect((await api('POST', url, b.token, { status: 'declined' })).status).toBe(409);
    });

    it('409s on a message with no proposal and 404s on an unknown message', async () => {
      const m = (await send(a, id, { text: 'plain' })).body;
      expect((await api('POST', `/chats/${id}/messages/${m.id}/proposal`, b.token, { status: 'accepted' })).status).toBe(409);
      expect((await api('POST', `/chats/${id}/messages/nope/proposal`, b.token, { status: 'accepted' })).status).toBe(404);
    });
  });
});
