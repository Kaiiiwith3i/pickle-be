/** Alignment integration tests: covers all features added to align with frontend. */
import { db } from '../../src/firebase';
import { api, registerPlayer, registerUser } from './helper';

const POBLACION = { lat: 14.2117, lng: 121.1653 };

describe('frontend-backend alignment', () => {
  it('submits a court with operating hours, advanceBookingDays and landmark', async () => {
    const player = await registerPlayer();
    const res = await api('POST', '/courts', player.token, {
      name: 'Clock Court',
      barangay: 'Halang',
      city: 'Calamba',
      location: POBLACION,
      indoor: true,
      courtCount: 3,
      surface: 'Wood/Indoor',
      hours: '6:00 AM – 10:00 PM',
      feePerHour: 150,
      amenities: ['Lighting', 'Restrooms'],
      openMin: 360,
      closeMin: 1320,
      advanceBookingDays: 14,
      landmark: 'Near Crossing Calamba',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Clock Court',
      openMin: 360,
      closeMin: 1320,
      advanceBookingDays: 14,
      landmark: 'Near Crossing Calamba',
    });

    // Verify it is listed in GET /courts
    const listRes = await api('GET', '/courts', player.token);
    expect(listRes.status).toBe(200);
    const found = listRes.body.find((c: any) => c.id === res.body.id);
    expect(found).toBeDefined();
    expect(found.openMin).toBe(360);
    expect(found.closeMin).toBe(1320);
    expect(found.advanceBookingDays).toBe(14);
    expect(found.landmark).toBe('Near Crossing Calamba');
  });

  it('deletes push token via DELETE /me/push-token', async () => {
    const { token, uid } = await registerUser();
    // Save token
    const postRes = await api('POST', '/me/push-token', token, { token: 'ExponentPushToken[test-123]' });
    expect(postRes.status).toBe(204);
    expect((await db.collection('pushTokens').doc(uid).get()).exists).toBe(true);

    // Delete token
    const delRes = await api('DELETE', '/me/push-token', token);
    expect(delRes.status).toBe(204);
    expect((await db.collection('pushTokens').doc(uid).get()).exists).toBe(false);
  });

  it('deactivates account via DELETE /me per RA 10173', async () => {
    const player = await registerPlayer({ displayName: 'Kiel Navasero' });
    const uid = player.uid;

    // Verify profile exists
    const before = await api('GET', '/me', player.token);
    expect(before.status).toBe(200);
    expect(before.body.displayName).toBe('Kiel Navasero');

    // Call DELETE /me
    const delRes = await api('DELETE', '/me', player.token);
    expect(delRes.status).toBe(204);

    // Profile document in Firestore is scrubbed
    const doc = (await db.collection('users').doc(uid).get()).data();
    expect(doc?.displayName).toBe('Deactivated Player');
    expect(doc?.deactivated).toBe(true);
    expect(doc?.matchmakingOptIn).toBe(false);
    expect(doc?.email).toBeNull();
    expect(doc?.phone).toBeNull();
    expect(doc?.location).toBeNull();

    // Private profile is destroyed
    const privDoc = await db.collection('users').doc(uid).collection('private').doc('profile').get();
    expect(privDoc.exists).toBe(false);
  });

  it('calculates leaderboard from confirmed match summaries via GET /leaderboard', async () => {
    const winner = await registerPlayer({ displayName: 'Champion Player' });
    const opponent = await registerPlayer({ displayName: 'Runner-up Player' });

    // Winner posts match summary
    const postRes = await api('POST', '/posts', winner.token, {
      kind: 'match_summary',
      body: 'Great match!',
      scoreLine: '11-7, 11-8',
      opponentId: opponent.uid,
      winnerId: winner.uid,
    });
    expect(postRes.status).toBe(201);
    const postId = postRes.body.id;

    // Opponent confirms the match
    const confirmRes = await api('POST', `/posts/${postId}/confirm`, opponent.token);
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.confirmed).toBe(true);

    // Query leaderboard
    const leadRes = await api('GET', '/leaderboard', winner.token);
    expect(leadRes.status).toBe(200);
    expect(Array.isArray(leadRes.body)).toBe(true);

    const winnerEntry = leadRes.body.find((e: any) => e.userId === winner.uid);
    expect(winnerEntry).toBeDefined();
    expect(winnerEntry.wins).toBeGreaterThanOrEqual(1);
    expect(winnerEntry.displayName).toBe('Champion Player');

    const oppEntry = leadRes.body.find((e: any) => e.userId === opponent.uid);
    expect(oppEntry).toBeDefined();
    expect(oppEntry.losses).toBeGreaterThanOrEqual(1);
  });

  it('returns platform telemetry metrics via GET /platform/telemetry', async () => {
    const user = await registerPlayer();
    const res = await api('GET', '/platform/telemetry', user.token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalPlayers');
    expect(res.body).toHaveProperty('totalCourts');
    expect(res.body).toHaveProperty('verifiedCourts');
    expect(res.body).toHaveProperty('totalMatches');
    expect(res.body).toHaveProperty('confirmedMatches');
    expect(res.body).toHaveProperty('totalSessions');
    expect(typeof res.body.totalPlayers).toBe('number');
  });
});
