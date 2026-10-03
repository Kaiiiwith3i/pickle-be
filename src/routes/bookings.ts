/** Ticket 04. */
import { Router } from 'express';

import { BOOKING_SLOTS } from '../config';
import { db } from '../firebase';
import { ApiError, docId, handle, isDateISO } from '../http';
import type { Booking } from '../types';

export const router = Router();

/** Today in Philippine time (UTC+8), the only timezone the corridor lives in. */
const todayISO = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

router.post(
  '/bookings',
  handle(async (req, res) => {
    const { courtId, dateISO, startMin } = req.body ?? {};
    const { startMin: first, endMin: last, stepMin } = BOOKING_SLOTS;
    docId(courtId, 'courtId');
    if (!isDateISO(dateISO)) throw new ApiError('invalid', 'dateISO must be YYYY-MM-DD');
    if (dateISO < todayISO()) throw new ApiError('invalid', 'dateISO is in the past');
    if (!Number.isInteger(startMin) || startMin < first || startMin + stepMin > last || (startMin - first) % stepMin) {
      throw new ApiError('invalid', `startMin must be a ${stepMin}-minute slot between ${first} and ${last}`);
    }

    const courtRef = db.collection('courts').doc(courtId);
    const booking = await db.runTransaction(async (tx) => {
      const court = await tx.get(courtRef);
      if (!court.exists) throw new ApiError('not_found', 'No such court');
      // Reading every court-number document of the slot makes concurrent requests contend on the same documents,
      // so Firestore retries the loser against the winner's write and it sees the number taken.
      const id = (n: number) => `${courtId}_${dateISO}_${startMin}_${n}`;
      const refs = Array.from({ length: court.data()!.courtCount }, (_, i) => db.collection('bookings').doc(id(i + 1)));
      const slots = await tx.getAll(...refs);
      if (slots.some((s) => s.exists && s.data()!.userId === req.uid)) {
        throw new ApiError('conflict', 'You already hold a court for this slot');
      }
      const free = slots.findIndex((s) => !s.exists);
      if (free < 0) throw new ApiError('conflict', 'Every court is taken for this slot');
      const made: Booking = {
        id: id(free + 1),
        courtId,
        userId: req.uid,
        dateISO,
        startMin,
        endMin: startMin + stepMin,
        courtNo: free + 1,
        status: 'confirmed',
      };
      tx.create(refs[free], made);
      return made;
      // Contenders for one slot retry against each other; the default 5 attempts can run out on a busy slot.
    }, { maxAttempts: 20 });
    res.status(201).json(booking);
  }),
);

router.get(
  '/me/bookings',
  handle(async (req, res) => {
    const snap = await db.collection('bookings').where('userId', '==', req.uid).get();
    const today = todayISO();
    res.json(
      snap.docs
        .map((d) => ({ ...(d.data() as Booking), id: d.id }))
        .filter((b) => b.dateISO >= today)
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.startMin - b.startMin),
    );
  }),
);

router.delete(
  '/bookings/:id',
  handle(async (req, res) => {
    const ref = db.collection('bookings').doc(docId(req.params.id, 'id'));
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiError('not_found', 'No such booking');
      if (snap.data()!.userId !== req.uid) throw new ApiError('forbidden', 'Only the booker can cancel');
      tx.delete(ref);
    });
    res.sendStatus(204);
  }),
);
