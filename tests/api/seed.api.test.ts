import { db } from '../../src/firebase';
import { seedSample, wipeSample } from '../../scripts/seed';
import { api, registerPlayer } from './helper';

const COLLECTIONS = ['users', 'courts', 'sessions', 'posts'];
const sampleDocs = async (name: string) =>
  (await db.collection(name).get()).docs.filter((d) => d.id.startsWith('sample-'));

// Reading whole collections and recursive deletes are slow once the shared emulator database has grown.
jest.setTimeout(120_000);

describe('sample dataset', () => {
  // The wipe is global to `isSample` records, so put back whatever was there before this suite ran
  // (a developer's seeded emulator) and always leave the database without leftovers from a failed run.
  let hadSample = false;
  beforeAll(async () => {
    hadSample = (await sampleDocs('users')).length > 0;
  });
  afterAll(async () => {
    await wipeSample();
    if (hadSample) await seedSample();
  });

  it('seeds labelled records with relative dates, and wipe removes exactly those', async () => {
    // Non-sample records that must survive the wipe.
    const player = await registerPlayer();
    const { body: court } = await api('POST', '/courts', player.token, {
      name: 'Real Court', barangay: 'Halang', city: 'Calamba', location: { lat: 14.2117, lng: 121.1653 },
      indoor: false, courtCount: 1, surface: 'Acrylic', hours: '6-10', feePerHour: 0, amenities: [],
    });

    const now = new Date();
    const counts = await seedSample(now);
    expect(counts).toEqual({ users: 12, courts: 8, sessions: 5, posts: 13 });

    for (const name of COLLECTIONS) {
      const docs = await sampleDocs(name);
      expect(docs.length).toBe(counts[name as keyof typeof counts]);
      for (const d of docs) expect(d.data().isSample).toBe(true);
    }
    for (const d of await sampleDocs('sessions')) expect(new Date(d.data().startsAt).getTime()).toBeGreaterThan(now.getTime());
    for (const d of await sampleDocs('posts')) expect(new Date(d.data().createdAt).getTime()).toBeLessThanOrEqual(now.getTime() + 3600_000 * 24);

    const courts = (await api('GET', '/courts', player.token)).body.filter((c: any) => c.id.startsWith('sample-'));
    expect(courts).toHaveLength(8);
    expect(courts.every((c: any) => c.isSample === true)).toBe(true);
    const players = (await api('GET', '/players', player.token)).body.filter((p: any) => p.id.startsWith('sample-'));
    expect(players).toHaveLength(12);
    expect(players.every((p: any) => p.isSample === true && !('email' in p))).toBe(true);

    // Re-seeding is idempotent.
    await seedSample(now);
    expect(await sampleDocs('users')).toHaveLength(12);

    const removed = await wipeSample();
    expect(removed).toEqual(counts);
    for (const name of COLLECTIONS) {
      expect(await sampleDocs(name)).toHaveLength(0);
      expect((await db.collection(name).where('isSample', '==', true).get()).size).toBe(0);
    }
    expect((await db.collection('courts').doc(court.id).get()).exists).toBe(true);
    expect((await db.collection('users').doc(player.uid).get()).exists).toBe(true);
    expect((await db.collection('users').doc(player.uid).collection('private').doc('profile').get()).exists).toBe(true);
  });
});
