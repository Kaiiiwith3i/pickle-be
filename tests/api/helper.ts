/**
 * API test helper. Needs the emulators (`npm run emulators`); `npm run test:api`
 * sets the env vars. The app runs in-process on a random port, so suites never
 * depend on the dev server. Every user gets a random email — suites share one
 * emulator database and must not assume it is empty.
 */
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';

import { createApp } from '../../src/app';
import { auth, db } from '../../src/firebase';
import type { AppUser, Court, Role } from '../../src/types';

const IDENTITY = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts`;
const PASSWORD = 'Passw0rd!';

let baseUrl: Promise<string> | undefined;
function start(): Promise<string> {
  return (baseUrl ??= new Promise((resolve) => {
    const server = createApp().listen(0, () =>
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
    );
  }));
}

/** A body sent verbatim, for JSON that `JSON.stringify` cannot produce (e.g. `1e999`). */
export class RawJson {
  constructor(readonly text: string) {}
}

/** Calls a route. `body` is sent as JSON; the parsed response body is returned. */
export async function api(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const res = await fetch((await start()) + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : body instanceof RawJson ? body.text : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

async function identity(action: 'signUp' | 'signInWithPassword', email: string) {
  const res = await fetch(`${IDENTITY}:${action}?key=test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`Auth emulator ${action} failed: ${await res.text()}`);
  return (await res.json()) as { localId: string; idToken: string };
}

export interface TestUser {
  uid: string;
  email: string;
  password: string;
  token: string;
}

// Each suite removes the users it registered here: leftover players become candidates in every later
// matchmaking request, and a long-lived emulator database slows down with them.
const created: string[] = [];
afterAll(async () => {
  await Promise.all(created.map((uid) => db.recursiveDelete(db.collection('users').doc(uid))));
  await Promise.all(created.map((uid) => db.collection('pushTokens').doc(uid).delete()));
  await auth.deleteUsers(created);
});

/** An Auth account with no profile. `role` sets the custom claim the API reads. */
export async function registerUser(role: Role = 'player'): Promise<TestUser> {
  const email = `${randomUUID()}@test.local`;
  let { localId: uid, idToken: token } = await identity('signUp', email);
  created.push(uid);
  if (role !== 'player') {
    await auth.setCustomUserClaims(uid, { admin: role === 'admin', caretaker: role === 'caretaker' });
    ({ idToken: token } = await identity('signInWithPassword', email));
  }
  return { uid, email, password: PASSWORD, token };
}

/**
 * An onboarded player written straight to Firestore, so suites do not depend
 * on `PUT /me`. Private fields in `profile` go to the private doc.
 */
export async function registerPlayer(
  profile: Partial<AppUser> = {},
  role: Role = 'player',
): Promise<TestUser & { profile: AppUser }> {
  const user = await registerUser(role);
  const { email = user.email, phone, preciseLocation, ...rest } = profile;
  const pub: AppUser = {
    id: user.uid,
    displayName: `Test ${user.uid.slice(0, 6)}`,
    tier: 'intermediate',
    location: { lat: 14.2117, lng: 121.1653 },
    areaLabel: 'Calamba Poblacion',
    availability: [{ day: 6, startMin: 360, endMin: 720 }],
    format: 'both',
    intent: 'both',
    matchmakingOptIn: true,
    joinedAt: new Date().toISOString(),
    onboarded: true,
    role,
    ...rest,
  };
  const ref = db.collection('users').doc(user.uid);
  await ref.set(pub);
  await ref.collection('private').doc('profile').set({ email, phone, preciseLocation });
  return { ...user, profile: { ...pub, email, phone, preciseLocation } };
}

/**
 * Writes a complete, valid `Court` straight to Firestore and returns its id. Callers delete it in `afterAll`
 * (`db.collection('courts').doc(id).delete()`): a partial court in the shared emulator breaks every client that lists courts.
 */
export async function fixtureCourt(overrides: Partial<Court> = {}): Promise<string> {
  const court: Omit<Court, 'id'> = {
    name: 'Test Court',
    barangay: 'Poblacion',
    city: 'Calamba',
    location: { lat: 14.2117, lng: 121.1653 },
    indoor: false,
    courtCount: 1,
    surface: 'Acrylic',
    hours: '6:00-22:00',
    feePerHour: 0,
    amenities: [],
    verified: true,
    ...overrides,
  };
  return (await db.collection('courts').add(court)).id;
}
