/** Ticket 03. Public: mounted before the token check. Proxies Firebase Authentication's REST API. */
import { Router } from 'express';

import { ApiError, handle } from '../http';
import type { AuthTokens } from '../types';

export const router = Router();

const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const base = (api: 'identitytoolkit' | 'securetoken') =>
  emulator ? `http://${emulator}/${api}.googleapis.com` : `https://${api}.googleapis.com`;
const key = () => process.env.FIREBASE_WEB_API_KEY ?? 'emulator';

/** POSTs to Firebase; a 400 becomes `onBadRequest`, anything else is a server fault. Never forwards the upstream body. */
async function upstream(url: string, body: object, onBadRequest: (firebaseCode: string) => ApiError) {
  const res = await fetch(`${url}?key=${key()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (res.ok) return json;
  if (res.status === 400) throw onBadRequest(String(json?.error?.message ?? ''));
  throw new Error(`Firebase Auth ${url} failed with ${res.status}`);
}

const credentials = (body: any): { email: string; password: string } => {
  const { email, password } = body ?? {};
  if (typeof email !== 'string' || !email.includes('@')) throw new ApiError('invalid', 'A valid email is required');
  if (typeof password !== 'string' || password.length < 6) {
    throw new ApiError('invalid', 'Password must be at least 6 characters');
  }
  return { email, password };
};

const tokens = (j: any): AuthTokens => ({ idToken: j.idToken, refreshToken: j.refreshToken, expiresIn: j.expiresIn });

router.post(
  '/auth/register',
  handle(async (req, res) => {
    const { email, password } = credentials(req.body);
    const j = await upstream(`${base('identitytoolkit')}/v1/accounts:signUp`, { email, password, returnSecureToken: true }, (code) =>
      code.startsWith('EMAIL_EXISTS')
        ? new ApiError('conflict', 'An account with this email already exists')
        : new ApiError('invalid', 'Email or password was rejected'),
    );
    res.status(201).json({ uid: j.localId, ...tokens(j) });
  }),
);

router.post(
  '/auth/login',
  handle(async (req, res) => {
    const { email, password } = credentials(req.body);
    const j = await upstream(
      `${base('identitytoolkit')}/v1/accounts:signInWithPassword`,
      { email, password, returnSecureToken: true },
      () => new ApiError('unauthenticated', 'Incorrect email or password'),
    );
    res.json({ uid: j.localId, ...tokens(j) });
  }),
);

router.post(
  '/auth/refresh',
  handle(async (req, res) => {
    const refreshToken = req.body?.refreshToken;
    if (typeof refreshToken !== 'string' || !refreshToken) throw new ApiError('invalid', 'refreshToken is required');
    const j = await upstream(
      `${base('securetoken')}/v1/token`,
      { grant_type: 'refresh_token', refresh_token: refreshToken },
      () => new ApiError('unauthenticated', 'Refresh token is invalid or expired'),
    );
    res.json({ idToken: j.id_token, refreshToken: j.refresh_token, expiresIn: j.expires_in });
  }),
);
