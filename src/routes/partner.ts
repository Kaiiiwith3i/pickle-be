/** Tickets 09 and 10: saved doubles partner and partner invites. */
import { Router } from 'express';

import { FieldValue } from 'firebase-admin/firestore';

import { db } from '../firebase';
import { ApiError, handle } from '../http';
import type { AppUser, PartnerInvite } from '../types';

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
const invites = db.collection('partnerInvites');
const asInvite = (d: FirebaseFirestore.DocumentSnapshot) => ({ ...d.data(), id: d.id }) as PartnerInvite;
const newestFirst = (a: PartnerInvite, b: PartnerInvite) => b.createdAt.localeCompare(a.createdAt);

router.get(
  '/partner-invites',
  handle(async (req, res) => {
    const [incoming, outgoing] = await Promise.all([
      invites.where('toId', '==', req.uid).get(),
      invites.where('fromId', '==', req.uid).get(),
    ]);
    res.json({ incoming: incoming.docs.map(asInvite).sort(newestFirst), outgoing: outgoing.docs.map(asInvite).sort(newestFirst) });
  }),
);

router.post(
  '/partner-invites',
  handle(async (req, res) => {
    const { toId } = req.body ?? {};
    if (typeof toId !== 'string' || toId === '') throw new ApiError('invalid', 'toId must be a player id');
    if (toId === req.uid) throw new ApiError('invalid', 'You cannot invite yourself');

    const users = db.collection('users');
    const [me, them] = await Promise.all([users.doc(req.uid).get(), users.doc(toId).get()]);
    if (!me.exists) throw new ApiError('not_found', 'Complete onboarding first');
    if (!them.exists) throw new ApiError('not_found', 'No such player');

    const pending = (from: string, to: string) =>
      invites.where('fromId', '==', from).where('toId', '==', to).where('status', '==', 'pending').limit(1).get();
    const [out, back] = await Promise.all([pending(req.uid, toId), pending(toId, req.uid)]);
    // ponytail: check-then-create is not atomic; two simultaneous sends could both pass. Fine for an invite flow.
    if (!out.empty || !back.empty) throw new ApiError('conflict', 'A pending invite between you two already exists');

    const ref = invites.doc();
    const invite: PartnerInvite = { id: ref.id, fromId: req.uid, toId, status: 'pending', createdAt: new Date().toISOString() };
    await ref.set(invite);
    res.status(201).json(invite);
  }),
);

router.post(
  '/partner-invites/:id/respond',
  handle(async (req, res) => {
    const { accept } = req.body ?? {};
    if (typeof accept !== 'boolean') throw new ApiError('invalid', 'accept must be true or false');

    const ref = invites.doc(req.params.id);
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiError('not_found', 'No such invite');
      const invite = asInvite(snap);
      if (invite.toId !== req.uid) throw new ApiError('forbidden', 'Only the invited player can respond');
      if (invite.status !== 'pending') throw new ApiError('conflict', `This invite was already ${invite.status}`);

      tx.update(ref, { status: accept ? 'accepted' : 'declined' });
      if (accept) {
        tx.update(db.collection('users').doc(invite.fromId), { doublesPartnerId: invite.toId, partnerConfirmed: true });
        tx.update(db.collection('users').doc(invite.toId), { doublesPartnerId: invite.fromId, partnerConfirmed: true });
      }
      return { ...invite, status: accept ? 'accepted' : 'declined' };
    });
    res.json(updated);
  }),
);
