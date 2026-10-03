/** Ticket 06: community feed and match results. */
import { FieldValue } from 'firebase-admin/firestore';
import { Router } from 'express';

import { db } from '../firebase';
import { ApiError, docId, handle, requireRole } from '../http';
import * as verify from '../match-verification';
import type { Patch, ResolveAction } from '../match-verification';
import type { Post } from '../types';

export const router = Router();

const posts = db.collection('posts');
const ACTIONS: ResolveAction[] = ['confirm', 'dismiss', 'void', 're_entry'];

/** Reads the post, lets `change` return the fields to update, writes them atomically. */
async function mutate(id: string, change: (post: Post) => Patch): Promise<Post> {
  const ref = posts.doc(docId(id, 'id'));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError('not_found', 'No such post');
    const post = { ...(snap.data() as Post), id: snap.id };
    let patch: Patch;
    try {
      patch = change(post);
    } catch (err) {
      throw err instanceof verify.RuleError ? new ApiError(err.code, err.message) : err;
    }
    // `undefined` means "remove the field"; the Admin SDK would otherwise skip it.
    tx.update(ref, Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? FieldValue.delete() : v])));
    const merged: Record<string, unknown> = { ...post, ...patch };
    for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
    return merged as unknown as Post;
  });
}

router.get('/posts', handle(async (_req, res) => {
  const snap = await posts.get();
  const list = snap.docs.map((d) => ({ ...(d.data() as Post), id: d.id }));
  res.json(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}));

router.post('/posts', handle(async (req, res) => {
  const b = req.body ?? {};
  if (b.kind !== 'post' && b.kind !== 'match_summary') throw new ApiError('invalid', 'kind must be post or match_summary');
  if (typeof b.body !== 'string' || b.body.length > 1000 || (b.kind === 'post' && !b.body.trim())) {
    throw new ApiError('invalid', 'body must be a string of at most 1000 characters (required for a post)');
  }
  const post: Omit<Post, 'id'> = {
    authorId: req.uid,
    body: b.body.trim(),
    createdAt: new Date().toISOString(),
    likedBy: [],
    kind: b.kind,
  };
  if (b.courtId !== undefined) {
    if (!(await db.collection('courts').doc(docId(b.courtId, 'courtId')).get()).exists) {
      throw new ApiError('invalid', 'courtId does not match a court');
    }
    post.courtId = b.courtId;
  }
  if (b.kind === 'match_summary') {
    if (docId(b.opponentId, 'opponentId') === req.uid) throw new ApiError('invalid', 'opponentId must be another player');
    if (!(await db.collection('users').doc(b.opponentId).get()).exists) throw new ApiError('invalid', 'opponentId is not a known player');
    if (b.winnerId !== req.uid && b.winnerId !== b.opponentId) throw new ApiError('invalid', 'winnerId must be you or the opponent');
    try {
      post.scoreLine = verify.checkScoreLine(b.scoreLine, b.winnerId === req.uid ? 'author' : 'opponent').scoreLine;
    } catch (err) {
      throw err instanceof verify.RuleError ? new ApiError(err.code, err.message) : err;
    }
    Object.assign(post, {
      opponentId: b.opponentId,
      winnerId: b.winnerId,
      confirmed: false,
      disputed: false,
      verificationStatus: 'pending',
    });
  }
  const ref = await posts.add(post);
  res.status(201).json({ ...post, id: ref.id });
}));

router.post('/posts/:id/like', handle(async (req, res) => {
  res.json(
    await mutate(req.params.id, (p) => ({
      likedBy: p.likedBy.includes(req.uid) ? p.likedBy.filter((u) => u !== req.uid) : [...p.likedBy, req.uid],
    })),
  );
}));

router.post('/posts/:id/confirm', handle(async (req, res) => {
  res.json(await mutate(req.params.id, (p) => verify.confirm(p, req.uid)));
}));

router.post('/posts/:id/dispute', handle(async (req, res) => {
  res.json(await mutate(req.params.id, (p) => verify.dispute(p, req.uid)));
}));

router.post('/posts/:id/counter-score', handle(async (req, res) => {
  res.json(await mutate(req.params.id, (p) => verify.counterScore(p, req.uid, req.body?.scoreLine)));
}));

router.post('/posts/:id/accept-counter', handle(async (req, res) => {
  res.json(await mutate(req.params.id, (p) => verify.acceptCounter(p, req.uid)));
}));

router.post('/posts/:id/resolve', handle(async (req, res) => {
  requireRole(req, 'admin');
  const action = req.body?.action;
  if (!ACTIONS.includes(action)) throw new ApiError('invalid', `action must be one of ${ACTIONS.join(', ')}`);
  res.json(await mutate(req.params.id, (p) => verify.resolve(p, action)));
}));
