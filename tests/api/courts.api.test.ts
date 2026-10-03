import { api, registerPlayer } from './helper';

const POBLACION = { lat: 14.2117, lng: 121.1653 };
const UPLB = { lat: 14.1622, lng: 121.2415 };
const court = (over: Record<string, unknown> = {}) => ({
  name: 'Test Court',
  barangay: 'Halang',
  city: 'Calamba',
  location: POBLACION,
  indoor: false,
  courtCount: 2,
  surface: 'Acrylic',
  hours: '6:00 AM – 10:00 PM',
  feePerHour: 100,
  amenities: ['Lighting'],
  ...over,
});

describe('courts', () => {
  let player: Awaited<ReturnType<typeof registerPlayer>>;
  let admin: Awaited<ReturnType<typeof registerPlayer>>;
  let caretaker: Awaited<ReturnType<typeof registerPlayer>>;
  beforeAll(async () => {
    // The player's GPS fix sits at UPLB while the home area is Poblacion.
    player = await registerPlayer({ preciseLocation: UPLB });
    admin = await registerPlayer({}, 'admin');
    caretaker = await registerPlayer({}, 'caretaker');
  });

  it('submits an unverified court, ignoring client-sent id, verified, submittedBy and isSample', async () => {
    const res = await api('POST', '/courts', player.token, court({ id: 'mine', verified: true, submittedBy: 'x', isSample: true }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ verified: false, submittedBy: player.uid, name: 'Test Court' });
    expect(res.body.id).not.toBe('mine');
    expect(res.body.isSample).toBeUndefined();
  });

  it('rejects a court outside the corridor and other invalid input', async () => {
    const bads = [
      court({ location: { lat: 14.5995, lng: 120.9842 } }),
      court({ location: { lat: 'a', lng: 1 } }),
      court({ name: '' }),
      court({ city: 'Manila' }),
      court({ courtCount: 0 }),
      court({ feePerHour: -5 }),
      court({ amenities: 'lights' }),
      court({ indoor: 'yes' }),
      undefined,
    ];
    for (const bad of bads) {
      const res = await api('POST', '/courts', player.token, bad);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('invalid');
    }
  });

  it('a submitted court stays unverified until an admin verifies it', async () => {
    const { body: created } = await api('POST', '/courts', player.token, court());
    const listed = async () => (await api('GET', '/courts', player.token)).body.find((c: any) => c.id === created.id);
    expect((await listed()).verified).toBe(false);

    for (const who of [player, caretaker]) {
      const res = await api('PATCH', `/courts/${created.id}`, who.token, { verified: true });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('forbidden');
    }
    expect((await listed()).verified).toBe(false);

    const ok = await api('PATCH', `/courts/${created.id}`, admin.token, { verified: true });
    expect(ok.status).toBe(200);
    expect(ok.body.verified).toBe(true);
    expect((await listed()).verified).toBe(true);
  });

  it('lets an admin or caretaker set maintenance status, not a player', async () => {
    const { body: c } = await api('POST', '/courts', player.token, court());
    expect((await api('PATCH', `/courts/${c.id}`, player.token, { maintenanceStatus: 'maintenance' })).status).toBe(403);
    for (const who of [caretaker, admin]) {
      const res = await api('PATCH', `/courts/${c.id}`, who.token, { maintenanceStatus: 'rain_closure' });
      expect(res.status).toBe(200);
      expect(res.body.maintenanceStatus).toBe('rain_closure');
    }
    for (const bad of [{}, { maintenanceStatus: 'closed' }, { verified: 'yes' }]) {
      expect((await api('PATCH', `/courts/${c.id}`, admin.token, bad)).status).toBe(400);
    }
    expect((await api('PATCH', '/courts/nope', admin.token, { verified: true })).status).toBe(404);
  });

  it('sets status in bulk for admin or caretaker only', async () => {
    const a = (await api('POST', '/courts', player.token, court())).body;
    const b = (await api('POST', '/courts', player.token, court())).body;
    const res = await api('POST', '/courts/status', caretaker.token, { courtIds: [a.id, b.id], status: 'maintenance' });
    expect(res.status).toBe(200);
    expect(res.body.map((c: any) => c.maintenanceStatus)).toEqual(['maintenance', 'maintenance']);
    expect((await api('POST', '/courts/status', player.token, { courtIds: [a.id], status: 'open' })).status).toBe(403);
    expect((await api('POST', '/courts/status', admin.token, { courtIds: [a.id, 'nope'], status: 'open' })).status).toBe(404);
    for (const bad of [{ courtIds: [], status: 'open' }, { courtIds: [a.id], status: 'x' }, { courtIds: 'a', status: 'open' }]) {
      expect((await api('POST', '/courts/status', admin.token, bad)).status).toBe(400);
    }
    // A failed bulk request changes nothing.
    expect((await api('GET', '/courts', player.token)).body.find((c: any) => c.id === a.id).maintenanceStatus).toBe('maintenance');
  });

  it('lists courts nearest first, measured from the precise location, else the home area', async () => {
    const near = (await api('POST', '/courts', player.token, court({ name: 'Near UPLB', city: 'Los Baños', location: UPLB }))).body;
    const far = (await api('POST', '/courts', player.token, court({ name: 'Far Poblacion', location: POBLACION }))).body;
    const mine = (token: string) => api('GET', '/courts', token).then((r) => r.body.filter((c: any) => [near.id, far.id].includes(c.id)));

    const fromGps = await mine(player.token); // precise fix at UPLB
    expect(fromGps.map((c: any) => c.id)).toEqual([near.id, far.id]);
    expect(fromGps[0].distanceKm).toBeLessThan(0.1);
    expect(fromGps[1].distanceKm).toBeGreaterThan(9);

    const homebody = await registerPlayer(); // no GPS: home area Poblacion
    const fromHome = await mine(homebody.token);
    expect(fromHome.map((c: any) => c.id)).toEqual([far.id, near.id]);
    expect(fromHome[0].distanceKm).toBeLessThan(0.1);

    const all = (await api('GET', '/courts', player.token)).body;
    const km = all.map((c: any) => c.distanceKm ?? 1e9);
    expect(km).toEqual([...km].sort((x: number, y: number) => x - y));
  });

  it('needs a token', async () => {
    expect((await api('GET', '/courts')).status).toBe(401);
    expect((await api('POST', '/courts', undefined, court())).status).toBe(401);
  });
});
