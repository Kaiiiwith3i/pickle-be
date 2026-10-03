/** Ticket 05: OpenPlay sessions. */
import { Router } from 'express';

import { withPrecise, loadPublicPlayers } from '../data';
import { DEFAULT_CONFIG, haversineKm } from '../engine';
import { db } from '../firebase';
import { ApiError, TIERS, docId, handle, int, text } from '../http';
import { loadTokens, sendPush } from '../push';
import type { GeoPoint, OpenPlaySession } from '../types';

export const router = Router();

const sessions = db.collection('sessions');

/** Players who should hear about a new session: opted in, not the host, tier-eligible, near the court. */
export async function sessionRecipientTokens(
  session: Pick<OpenPlaySession, 'hostId' | 'tierRestriction'>,
  court: { location: GeoPoint },
): Promise<string[]> {
  const players = await withPrecise(await loadPublicPlayers());
  const eligible = players.filter(
    (p) =>
      p.id !== session.hostId &&
      (!session.tierRestriction || session.tierRestriction.includes(p.tier)) &&
      haversineKm(p.location, court.location) <= DEFAULT_CONFIG.maxDistanceKm,
  );
  return loadTokens(eligible.map((p) => p.id));
}

router.get('/sessions', handle(async (_req, res) => {
  const snap = await sessions.get();
  const list = snap.docs.map((d) => ({ ...(d.data() as OpenPlaySession), id: d.id }));
  res.json(list.sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
}));

router.post('/sessions', handle(async (req, res) => {
  const b = req.body ?? {};
  const courtId = docId(b.courtId, 'courtId');
  const court = await db.collection('courts').doc(courtId).get();
  if (!court.exists) throw new ApiError('invalid', 'courtId does not match a court');
  if (typeof b.startsAt !== 'string' || !Number.isFinite(Date.parse(b.startsAt))) {
    throw new ApiError('invalid', 'startsAt must be an ISO-8601 date-time');
  }
  const tiers = b.tierRestriction ?? null;
  if (tiers !== null && (!Array.isArray(tiers) || tiers.length === 0 || tiers.some((t) => !TIERS.includes(t)))) {
    throw new ApiError('invalid', 'tierRestriction must be null or a non-empty list of skill tiers');
  }
  const session: Omit<OpenPlaySession, 'id'> = {
    courtId,
    hostId: req.uid,
    title: text(b.title, 'title', 100),
    startsAt: new Date(b.startsAt).toISOString(),
    durationMin: int(b.durationMin, 'durationMin', 15, 600),
    capacity: int(b.capacity, 'capacity', 2, 100),
    attendeeIds: [req.uid],
    tierRestriction: tiers,
    notes: text(b.notes, 'notes', 500, false),
    paymentInstructions: text(b.paymentInstructions, 'paymentInstructions', 500, false),
  };
  const ref = await sessions.add(session);
  // Inline fan-out (no Firestore trigger any more). It must never fail the request.
  try {
    const c = court.data() as { name: string; barangay: string; location: GeoPoint };
    const tokens = await sessionRecipientTokens(session, c);
    await sendPush(
      tokens.map((to) => ({
        to,
        title: `OpenPlay near you: ${session.title}`,
        body: `${c.name}, ${c.barangay} — tap to join before it fills up.`,
        data: { sessionId: ref.id },
      })),
    );
  } catch (err) {
    console.error('session notification failed', err);
  }
  res.status(201).json({ ...session, id: ref.id });
}));

router.delete('/sessions/:id', handle(async (req, res) => {
  const ref = sessions.doc(docId(req.params.id, 'id'));
  const snap = await ref.get();
  if (!snap.exists) throw new ApiError('not_found', 'No such session');
  if (snap.data()!.hostId !== req.uid) throw new ApiError('forbidden', 'Only the host can delete a session');
  await ref.delete();
  res.sendStatus(204);
}));

router.post('/sessions/:id/attendance', handle(async (req, res) => {
  const ref = sessions.doc(docId(req.params.id, 'id'));
  const updated = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError('not_found', 'No such session');
    const s = { ...(snap.data() as OpenPlaySession), id: snap.id };
    const joined = s.attendeeIds.includes(req.uid);
    if (joined && s.hostId === req.uid) throw new ApiError('conflict', 'The host cannot leave; delete the session instead');
    if (!joined && s.attendeeIds.length >= s.capacity) throw new ApiError('conflict', 'This session is full');
    s.attendeeIds = joined ? s.attendeeIds.filter((id) => id !== req.uid) : [...s.attendeeIds, req.uid];
    tx.update(ref, { attendeeIds: s.attendeeIds });
    return s;
  });
  res.json(updated);
}));
