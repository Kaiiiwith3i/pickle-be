import { api, RawJson, registerPlayer } from './helper';

const COURT = {
  name: 'Hardening Court', barangay: 'Halang', city: 'Calamba', location: { lat: 14.2117, lng: 121.1653 },
  indoor: false, courtCount: 1, surface: 'Acrylic', hours: '6-10', feePerHour: 0, amenities: [],
};
const PROPOSAL = { dateISO: '2030-01-01', timeSlotLabel: 'Sat morning' };

describe('crafted ids never reach a Firestore document path', () => {
  let me: Awaited<ReturnType<typeof registerPlayer>>;
  let other: Awaited<ReturnType<typeof registerPlayer>>;
  let admin: Awaited<ReturnType<typeof registerPlayer>>;
  let chatId: string;

  beforeAll(async () => {
    [me, other, admin] = await Promise.all([registerPlayer(), registerPlayer(), registerPlayer({}, 'admin')]);
    chatId = (await api('POST', '/chats', me.token, { userId: other.uid })).body.id;
  });

  it.each(['a%2Fb', '__x__'])('path params: %s is 400 on every resource', async (id) => {
    const d = '2030-01-01';
    const calls: Array<[string, string, 'me' | 'admin', unknown?]> = [
      ['POST', `/posts/${id}/like`, 'me'],
      ['POST', `/posts/${id}/confirm`, 'me'],
      ['POST', `/posts/${id}/dispute`, 'me'],
      ['POST', `/posts/${id}/counter-score`, 'me', { scoreLine: '11-7, 11-9' }],
      ['POST', `/posts/${id}/accept-counter`, 'me'],
      ['POST', `/posts/${id}/resolve`, 'admin', { action: 'void' }],
      ['DELETE', `/bookings/${id}`, 'me'],
      ['PATCH', `/courts/${id}`, 'admin', { verified: true }],
      ['GET', `/courts/${id}/bookings?date=${d}`, 'me'],
      ['DELETE', `/sessions/${id}`, 'me'],
      ['POST', `/sessions/${id}/attendance`, 'me'],
      ['GET', `/chats/${id}/messages`, 'me'],
      ['POST', `/chats/${id}/messages`, 'me', { text: 'hi' }],
      ['POST', `/chats/${id}/read`, 'me'],
      ['POST', `/chats/${chatId}/messages/${id}/proposal`, 'me', { status: 'accepted' }],
      ['POST', `/partner-invites/${id}/respond`, 'me', { accept: true }],
      ['GET', `/algorithm/explain/${id}`, 'me'],
      ['GET', `/algorithm/lab/${id}`, 'admin'],
      ['GET', `/matchmake/doubles?partnerId=${id}`, 'me'],
    ];
    for (const [method, path, who, body] of calls) {
      const res = await api(method, path, (who === 'me' ? me : admin).token, body);
      expect([method, path, res.status]).toEqual([method, path, 400]);
      expect(res.body.error.code).toBe('invalid');
    }
  });

  it('body ids: a/b, empty and another document path are 400', async () => {
    const crafted = ['a/b', '', '..', `${other.uid}/private/profile`, '__x__'];
    for (const v of crafted) {
      const post = { kind: 'match_summary', body: '', winnerId: me.uid, scoreLine: '11-7, 11-9' };
      const calls: Array<[string, string, unknown]> = [
        ['POST', '/chats', { userId: v }],
        ['POST', '/posts', { ...post, opponentId: v }],
        ['POST', '/posts', { ...post, opponentId: other.uid, courtId: v }],
        ['POST', '/bookings', { courtId: v, dateISO: '2030-01-01', startMin: 480 }],
        ['POST', '/courts/status', { courtIds: [v], status: 'open' }],
        ['POST', '/sessions', { courtId: v, title: 't', startsAt: '2031-01-01T10:00:00Z', durationMin: 60, capacity: 4 }],
        ['POST', `/chats/${chatId}/messages`, { text: 'hi', courtId: v }],
        ['POST', `/chats/${chatId}/messages`, { text: 'hi', proposal: { ...PROPOSAL, courtId: v } }],
        ['PUT', '/me/partner', { partnerId: v }],
        ['POST', '/partner-invites', { toId: v }],
      ];
      for (const [method, path, body] of calls) {
        const res = await api(method, path, (path === '/courts/status' ? admin : me).token, body);
        expect([path, v, res.status]).toEqual([path, v, 400]);
      }
    }
    // No stray thread was written for the crafted path.
    expect((await api('GET', '/chats', me.token)).body.map((c: any) => c.id)).toEqual([chatId]);
  });

  it('a well-formed unknown id is still 404', async () => {
    expect((await api('POST', '/posts/nobody/like', me.token)).status).toBe(404);
    expect((await api('GET', '/courts/nobody/bookings?date=2030-01-01', me.token)).status).toBe(404);
  });
});

describe('impossible dates are 400, not 500', () => {
  it.each(['2026-13-45', '2026-02-30'])('%s', async (date) => {
    const me = await registerPlayer();
    const other = await registerPlayer();
    const court = (await api('POST', '/courts', me.token, COURT)).body;
    const chat = (await api('POST', '/chats', me.token, { userId: other.uid })).body;
    for (const res of [
      await api('POST', '/bookings', me.token, { courtId: court.id, dateISO: date, startMin: 480 }),
      await api('GET', `/courts/${court.id}/bookings?date=${date}`, me.token),
      await api('POST', `/chats/${chat.id}/messages`, me.token, { text: 'hi', proposal: { ...PROPOSAL, dateISO: date, courtId: court.id } }),
    ]) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('invalid');
    }
  });
});

describe('malformed input is a clean 400', () => {
  it('a JSON body over the size limit', async () => {
    const me = await registerPlayer();
    const res = await api('POST', '/me/push-token', me.token, { token: 'x'.repeat(200_000) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid');
  });

  it('a number that parses to Infinity', async () => {
    const me = await registerPlayer();
    const raw = JSON.stringify(COURT).replace('"feePerHour":0', '"feePerHour":1e999');
    expect(raw).toContain('1e999');
    const res = await api('POST', '/courts', me.token, new RawJson(raw));
    expect(res.status).toBe(400);
  });
});
