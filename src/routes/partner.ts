/** Tickets 09 and 10: saved doubles partner and partner invites. */
import { Router } from 'express';

import { FieldValue } from 'firebase-admin/firestore';

import { db } from '../firebase';
import { ApiError, handle, notImplemented } from '../http';
import type { AppUser } from '../types';

export const router = Router();

router.put(
  '/me/partner',
  handle(async (req, res) => {
    const { partnerId } = req.body ?? {};
    if (partnerId !== null && (typeof partnerId !== 'string' || partnerId === '')) {
      throw new ApiError('invalid', 'partnerId must be a player id or null');
    }
    if (partnerId === req.uid) throw new ApiError('invalid', 'You cannot be your own partner');

    const me = db.collection('users').doc(req.uid);
    const [mine, theirs] = await Promise.all([me.get(), partnerId ? db.collection('users').doc(partnerId).get() : null]);
    if (!mine.exists) throw new ApiError('not_found', 'Complete onboarding first');
    if (theirs && !theirs.exists) throw new ApiError('not_found', 'No such player');

    await me.update(
      partnerId
        ? { doublesPartnerId: partnerId, partnerConfirmed: false }
        : { doublesPartnerId: FieldValue.delete(), partnerConfirmed: FieldValue.delete() },
    );
    // The caller's own record, so the private fields are theirs to see (same shape as `GET /me`).
    const [fresh, priv] = await Promise.all([me.get(), me.collection('private').doc('profile').get()]);
    res.json({ ...fresh.data(), ...priv.data(), id: req.uid } as AppUser);
  }),
);
router.get('/partner-invites', notImplemented);
router.post('/partner-invites', notImplemented);
router.post('/partner-invites/:id/respond', notImplemented);
