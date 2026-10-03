/** Ticket 03: the caller's profile and the public player list. */
import { Router } from 'express';

import { AREAS } from '../config';
import { CALAMBA_LOS_BANOS_BOUNDARY, inBoundary } from '../engine';
import { loadPublicPlayers } from '../data';
import { auth, db } from '../firebase';
import { ApiError, TIERS, bad, handle } from '../http';
import type { AppUser, FacilityProfile, GeoPoint } from '../types';

export const router = Router();

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], name: string): T => {
  if (!allowed.includes(v as T)) throw bad(`${name} must be one of: ${allowed.join(', ')}`);
  return v as T;
};
const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const optString = (v: unknown, name: string, max = 60): string | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || v.length > max) throw bad(`${name} must be a string of at most ${max} characters`);
  return v;
};

function point(v: unknown, name: string): GeoPoint {
  if (!isObj(v) || typeof v.lat !== 'number' || typeof v.lng !== 'number' || Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180) {
    throw bad(`${name} must be { lat, lng } in range`);
  }
  return { lat: v.lat, lng: v.lng };
}

/** The public and private halves of a validated profile. */
function parseProfile(body: unknown) {
  if (!isObj(body)) throw bad('A profile object is required');
  const name = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  if (name.length < 2 || name.length > 60) throw bad('displayName must be 2-60 characters');
  if (typeof body.matchmakingOptIn !== 'boolean') throw bad('matchmakingOptIn must be true or false');
  if (!Array.isArray(body.availability) || body.availability.length > 28) throw bad('availability must be a list of windows');
  for (const w of body.availability) {
    if (!isObj(w) || !int(w.day, 0, 6) || !int(w.startMin, 0, 1439) || !int(w.endMin, 1, 1440) || w.endMin <= w.startMin) {
      throw bad('availability windows need day 0-6 and startMin < endMin within the day');
    }
  }
  if (body.rating !== undefined && (typeof body.rating !== 'number' || body.rating < 2 || body.rating > 5.5)) {
    throw bad('rating must be between 2.0 and 5.5');
  }
  // The public location is always the home-area centroid, so a GPS fix sent as `location` can never leak.
  const area = AREAS.find((a) => a.label === body.areaLabel);
  if (!area) throw bad('areaLabel must be one of the /config areas');

  let facilityProfile: FacilityProfile | undefined;
  if (body.facilityProfile !== undefined) {
    const f = body.facilityProfile;
    if (!isObj(f) || typeof f.venueName !== 'string' || f.venueName.length > 100 || !int(f.courtCount, 1, 50) || typeof f.surfaceType !== 'string' || f.surfaceType.length > 50) {
      throw bad('facilityProfile needs venueName, courtCount and surfaceType');
    }
    facilityProfile = { venueName: f.venueName, courtCount: f.courtCount, surfaceType: f.surfaceType as FacilityProfile['surfaceType'] };
  }

  const pub = {
    displayName: name,
    tier: oneOf(body.tier, TIERS, 'tier'),
    rating: body.rating,
    location: { lat: area.lat, lng: area.lng },
    areaLabel: area.label,
    availability: body.availability.map((w: any) => ({ day: w.day, startMin: w.startMin, endMin: w.endMin })),
    format: oneOf(body.format, ['singles', 'doubles', 'both'], 'format'),
    intent: oneOf(body.intent, ['casual', 'competitive', 'both'], 'intent'),
    matchmakingOptIn: body.matchmakingOptIn,
    bio: optString(body.bio, 'bio', 500),
    firstName: optString(body.firstName, 'firstName'),
    middleName: optString(body.middleName, 'middleName'),
    lastName: optString(body.lastName, 'lastName'),
    suffix: optString(body.suffix, 'suffix'),
    username: optString(body.username, 'username'),
    homeCourtId: optString(body.homeCourtId, 'homeCourtId', 128),
    communityRole: body.communityRole === undefined ? undefined : oneOf(body.communityRole, ['player', 'owner', 'both'], 'communityRole'),
    facilityProfile,
  };
  const priv = {
    phone: optString(body.phone, 'phone', 30),
    preciseLocation: body.preciseLocation === undefined ? undefined : point(body.preciseLocation, 'preciseLocation'),
  };
  if (priv.preciseLocation && !inBoundary(priv.preciseLocation, CALAMBA_LOS_BANOS_BOUNDARY)) {
    throw bad('preciseLocation is outside the Calamba–Los Baños corridor');
  }
  return { pub, priv };
}

const privateRef = (uid: string) => db.collection('users').doc(uid).collection('private').doc('profile');

router.get(
  '/me',
  handle(async (req, res) => {
    const [pub, priv] = await Promise.all([db.collection('users').doc(req.uid).get(), privateRef(req.uid).get()]);
    if (!pub.exists) throw new ApiError('not_found', 'No profile yet');
    const me: AppUser = { ...(pub.data() as AppUser), ...priv.data(), id: req.uid, role: req.role };
    res.json(me);
  }),
);

router.put(
  '/me',
  handle(async (req, res) => {
    const { pub, priv } = parseProfile(req.body);
    const { email } = await auth.getUser(req.uid);
    const ref = db.collection('users').doc(req.uid);
    const saved = await db.runTransaction(async (tx) => {
      const old = (await tx.get(ref)).data() as AppUser | undefined;
      const doc: AppUser = {
        ...pub,
        id: req.uid,
        role: req.role,
        joinedAt: old?.joinedAt ?? new Date().toISOString(),
        onboarded: true,
        // Owned by the partner routes: a profile edit must not clobber them.
        doublesPartnerId: old?.doublesPartnerId,
        partnerConfirmed: old?.partnerConfirmed,
        isSample: old?.isSample,
      };
      tx.set(ref, doc);
      tx.set(privateRef(req.uid), { email, ...priv });
      return doc;
    });
    res.json({ ...saved, email, ...priv });
  }),
);

router.post(
  '/me/push-token',
  handle(async (req, res) => {
    const token = req.body?.token;
    if (typeof token !== 'string' || !token || token.length > 500) throw bad('token is required');
    await db.collection('pushTokens').doc(req.uid).set({ userId: req.uid, token, updatedAt: new Date().toISOString() });
    res.sendStatus(204);
  }),
);

router.get(
  '/players',
  handle(async (_req, res) => {
    res.json(await loadPublicPlayers());
  }),
);
