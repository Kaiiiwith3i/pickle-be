import { db } from '../../src/firebase';
import { api, registerPlayer } from './helper';

const DATE = '2099-06-15';
const SLOT = 600;
const book = (token: string, courtId: string, over: Record<string, unknown> = {}) =>
  api('POST', '/bookings', token, { courtId, dateISO: DATE, startMin: SLOT, ...over });

describe('bookings', () => {
  let owner: Awaited<ReturnType<typeof registerPlayer>>;
  const players: Awaited<ReturnType<typeof registerPlayer>>[] = [];
  const makeCourt = async (courtCount: number) =>
    (
      await api('POST', '/courts', owner.token, {
        name: `Booking test ${courtCount}`,
        barangay: 'Halang',
        city: 'Calamba',
        location: { lat: 14.2117, lng: 121.1653 },
        indoor: false,
        courtCount,
        surface: 'Acrylic',
        hours: '6:00 AM – 10:00 PM',
        feePerHour: 0,
        amenities: [],
      })
    ).body.id as string;

  beforeAll(async () => {
    owner = await registerPlayer();
    for (let i = 0; i < 4; i++) players.push(await registerPlayer());
  });

  it('two users cannot hold the same court number: concurrent requests on a 1-court venue give one 201 and one 409', async () => {
    const id = await makeCourt(1);
    const results = await Promise.all([book(players[0].token, id), book(players[1].token, id)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const won = results.find((r) => r.status === 201)!;
    expect(won.body).toMatchObject({ courtId: id, dateISO: DATE, startMin: SLOT, endMin: SLOT + 60, courtNo: 1, status: 'confirmed' });
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe('conflict');
  });

  it('cancel frees the slot', async () => {
    const id = await makeCourt(1);
    const first = await book(players[0].token, id);
    expect(first.status).toBe(201);
    expect((await book(players[1].token, id)).status).toBe(409);

    expect((await api('DELETE', `/bookings/${first.body.id}`, players[1].token)).status).toBe(403);
    expect((await api('DELETE', `/bookings/${first.body.id}`, players[0].token)).status).toBe(204);
    expect((await api('DELETE', `/bookings/${first.body.id}`, players[0].token)).status).toBe(404);

    const second = await book(players[1].token, id);
    expect(second.status).toBe(201);
    expect(second.body.courtNo).toBe(1);
  });

  it('assigns the lowest free court number and never hands out a number twice under concurrency', async () => {
    const id = await makeCourt(2);
    const results = await Promise.all(players.map((p) => book(p.token, id)));
    const won = results.filter((r) => r.status === 201);
    expect(won).toHaveLength(2);
    expect(won.map((r) => r.body.courtNo).sort()).toEqual([1, 2]);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);

    const one = won.find((r) => r.body.courtNo === 1)!;
    const owner1 = players.find((_, i) => results[i] === one)!;
    await api('DELETE', `/bookings/${one.body.id}`, owner1.token);
    const next = players.find((_, i) => results[i].status === 409)!;
    expect((await book(next.token, id)).body.courtNo).toBe(1);
  });

  it('does not let one user hold two courts for the same slot', async () => {
    const id = await makeCourt(2);
    expect((await book(players[0].token, id)).status).toBe(201);
    const again = await book(players[0].token, id);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('conflict');
    expect((await book(players[0].token, id, { startMin: SLOT + 60 })).status).toBe(201);
  });

  it('rejects invalid bookings', async () => {
    const id = await makeCourt(1);
    const bads = [
      { startMin: 361 },
      { startMin: 300 },
      { startMin: 1260 },
      { startMin: '600' },
      { dateISO: '2099-02-30' },
      { dateISO: '15-06-2099' },
      { dateISO: '2020-01-01' },
      { courtId: undefined },
    ];
    for (const bad of bads) {
      const res = await book(players[0].token, id, bad);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('invalid');
    }
    expect((await book(players[0].token, 'no-such-court')).status).toBe(404);
    expect((await api('POST', '/bookings', players[0].token)).status).toBe(400);
    expect((await api('POST', '/bookings', undefined, { courtId: id, dateISO: DATE, startMin: SLOT })).status).toBe(401);
  });

  it('lists a court day and my upcoming bookings', async () => {
    const id = await makeCourt(2);
    const [booker, other] = [await registerPlayer(), await registerPlayer()];
    const mine = (await book(booker.token, id)).body;
    await book(other.token, id, { startMin: SLOT + 120 });

    const day = await api('GET', `/courts/${id}/bookings?date=${DATE}`, players[0].token);
    expect(day.status).toBe(200);
    expect(day.body).toHaveLength(2);
    expect(day.body.map((b: any) => b.startMin).sort()).toEqual([SLOT, SLOT + 120]);
    expect((await api('GET', `/courts/${id}/bookings?date=2099-06-16`, players[0].token)).body).toEqual([]);
    for (const q of ['', '?date=nope']) expect((await api('GET', `/courts/${id}/bookings${q}`, players[0].token)).status).toBe(400);
    expect((await api('GET', `/courts/nope/bookings?date=${DATE}`, players[0].token)).status).toBe(404);

    // A booking dated yesterday must not show under "today onward".
    await db.collection('bookings').doc(`${id}_2020-01-01_600_1`).set({
      id: `${id}_2020-01-01_600_1`, courtId: id, userId: booker.uid, dateISO: '2020-01-01', startMin: 600, endMin: 660, courtNo: 1, status: 'confirmed',
    });
    const upcoming = await api('GET', '/me/bookings', booker.token);
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.map((b: any) => b.id)).toEqual([mine.id]);
  });
});
