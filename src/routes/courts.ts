/** Ticket 04. */
import { Router } from 'express';

import { CALAMBA_LOS_BANOS_BOUNDARY, haversineKm, inBoundary } from '../engine';
import { db } from '../firebase';
import { ApiError, bad, docId, handle, isDateISO, requireRole, text as requiredText } from '../http';
import type { Booking, Court, GeoPoint, MaintenanceStatus } from '../types';

export const router = Router();

const STATUSES: MaintenanceStatus[] = ['open', 'rain_closure', 'maintenance'];
const text = (v: unknown, name: string): string => requiredText(v, name, 200);
const optText = (v: unknown, name: string): string | undefined => (v === undefined || v === '' ? undefined : text(v, name));
const status = (v: unknown): MaintenanceStatus => {
  if (!STATUSES.includes(v as MaintenanceStatus)) throw bad(`status must be one of: ${STATUSES.join(', ')}`);
  return v as MaintenanceStatus;
};

/** A submitted court, whitelisted field by field: the client never sets id, verified, submittedBy or isSample. */
function parseCourt(body: any, uid: string): Omit<Court, 'id'> {
  if (typeof body !== 'object' || body === null) throw bad('A court object is required');
  const { location, courtCount, feePerHour } = body;
  if (typeof location?.lat !== 'number' || typeof location?.lng !== 'number') throw bad('location must be { lat, lng }');
  const point: GeoPoint = { lat: location.lat, lng: location.lng };
  if (!inBoundary(point, CALAMBA_LOS_BANOS_BOUNDARY)) throw bad('location is outside the Calamba–Los Baños corridor');
  if (!['Calamba', 'Los Baños'].includes(body.city)) throw bad('city must be Calamba or Los Baños');
  if (!Number.isInteger(courtCount) || courtCount < 1 || courtCount > 50) throw bad('courtCount must be a whole number 1-50');
  if (!Number.isFinite(feePerHour) || feePerHour < 0) throw bad('feePerHour must be 0 or more');
  if (typeof body.indoor !== 'boolean') throw bad('indoor must be true or false');
  if (!Array.isArray(body.amenities) || body.amenities.some((a: unknown) => typeof a !== 'string')) throw bad('amenities must be a list of strings');
  return {
    name: text(body.name, 'name'),
    barangay: text(body.barangay, 'barangay'),
    city: body.city,
    location: point,
    indoor: body.indoor,
    courtCount,
    surface: text(body.surface, 'surface'),
    hours: text(body.hours, 'hours'),
    feePerHour,
    amenities: body.amenities,
    verified: false,
    submittedBy: uid,
    caretakerName: optText(body.caretakerName, 'caretakerName'),
    caretakerContact: optText(body.caretakerContact, 'caretakerContact'),
    paddleRentals: typeof body.paddleRentals === 'boolean' ? body.paddleRentals : undefined,
  };
}

const withId = (d: FirebaseFirestore.DocumentSnapshot) => ({ ...(d.data() as Court), id: d.id });

router.get(
  '/courts',
  handle(async (req, res) => {
    const [courts, me, priv] = await Promise.all([
      db.collection('courts').get(),
      db.collection('users').doc(req.uid).get(),
      db.collection('users').doc(req.uid).collection('private').doc('profile').get(),
    ]);
    const from: GeoPoint | undefined = priv.data()?.preciseLocation ?? me.data()?.location;
    const list = courts.docs.map(withId);
    if (!from) return res.json(list);
    // A court document without a location (stub data) must not break the list: no distance, sorted last.
    const km = (c: Court) => (c.location ? Math.round(haversineKm(from, c.location) * 100) / 100 : undefined);
    res.json(
      list
        .map((c) => ({ ...c, distanceKm: km(c) }))
        .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)),
    );
  }),
);

router.post(
  '/courts',
  handle(async (req, res) => {
    const ref = db.collection('courts').doc();
    const court = parseCourt(req.body, req.uid);
    await ref.set(court);
    res.status(201).json({ ...court, id: ref.id });
  }),
);

router.patch(
  '/courts/:id',
  handle(async (req, res) => {
    const { verified, maintenanceStatus } = req.body ?? {};
    if (verified === undefined && maintenanceStatus === undefined) throw bad('verified or maintenanceStatus is required');
    if (verified !== undefined) {
      requireRole(req, 'admin');
      if (typeof verified !== 'boolean') throw bad('verified must be true or false');
    }
    if (maintenanceStatus !== undefined) {
      requireRole(req, 'admin', 'caretaker');
      status(maintenanceStatus);
    }
    const ref = db.collection('courts').doc(docId(req.params.id, 'id'));
    if (!(await ref.get()).exists) throw new ApiError('not_found', 'No such court');
    await ref.update({ ...(verified === undefined ? {} : { verified }), ...(maintenanceStatus === undefined ? {} : { maintenanceStatus }) });
    res.json(withId(await ref.get()));
  }),
);

router.post(
  '/courts/status',
  handle(async (req, res) => {
    requireRole(req, 'admin', 'caretaker');
    const { courtIds, status: next } = req.body ?? {};
    if (!Array.isArray(courtIds) || !courtIds.length || courtIds.length > 100) {
      throw bad('courtIds must be a non-empty list of ids');
    }
    courtIds.forEach((i) => docId(i, 'courtIds[]'));
    const maintenanceStatus = status(next);
    const refs = [...new Set<string>(courtIds)].map((id) => db.collection('courts').doc(id));
    const saved = await db.runTransaction(async (tx) => {
      const snaps = await tx.getAll(...refs);
      const missing = snaps.find((s) => !s.exists);
      if (missing) throw new ApiError('not_found', `No such court: ${missing.id}`);
      snaps.forEach((s) => tx.update(s.ref, { maintenanceStatus }));
      return snaps.map((s) => ({ ...withId(s), maintenanceStatus }));
    });
    res.json(saved);
  }),
);

router.get(
  '/courts/:id/bookings',
  handle(async (req, res) => {
    const date = req.query.date;
    if (!isDateISO(date)) throw bad('date must be YYYY-MM-DD');
    const courtId = docId(req.params.id, 'id');
    if (!(await db.collection('courts').doc(courtId).get()).exists) throw new ApiError('not_found', 'No such court');
    const snap = await db.collection('bookings').where('courtId', '==', courtId).where('dateISO', '==', date).get();
    res.json(snap.docs.map((d) => ({ ...(d.data() as Booking), id: d.id })));
  }),
);
