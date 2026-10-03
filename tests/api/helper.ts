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
import type { AppUser, Role } from '../../src/types';

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
    body: body === undefined ? undefined : JSON.stringify(body),
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

/** An Auth account with no profile. `role` sets the custom claim the API reads. */
export async function registerUser(role: Role = 'player'): Promise<TestUser> {
  const email = `${randomUUID()}@test.local`;
  let { localId: uid, idToken: token } = await identity('signUp', email);
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
