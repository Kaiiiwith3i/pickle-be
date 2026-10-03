/** Ticket 07: chat. Thread ids are deterministic (`chat_<sorted uids>`); `participantIds` is the only membership field. */
import { FieldValue } from 'firebase-admin/firestore';
import { Router } from 'express';

import { db } from '../firebase';
import { ApiError, docId, handle, isDateISO } from '../http';
import { loadTokens, sendPush } from '../push';
import type { ChatMessage, ChatThread, MatchProposal } from '../types';

export const router = Router();

const chats = db.collection('chats');
const DAY_MS = 86_400_000;
const STATUSES = ['accepted', 'declined', 'rescheduled'];

type Thread = Omit<ChatThread, 'id' | 'unreadCount'>;

/** The thread, once the caller is known to belong to it. */
async function threadFor(id: string, uid: string): Promise<Thread> {
  const snap = await chats.doc(docId(id, 'id')).get();
  if (!snap.exists) throw new ApiError('not_found', 'No such chat');
  const thread = snap.data() as Thread;
  if (!thread.participantIds.includes(uid)) throw new ApiError('forbidden', 'You are not in this chat');
  return thread;
}

/** Messages the caller has not read. ponytail: reads the other side's messages per thread; add a stored counter if threads get long. */
async function unreadCount(chatId: string, uid: string, others: string[]): Promise<number> {
  const snap = await chats.doc(chatId).collection('messages').where('senderId', 'in', others).get();
  return snap.docs.filter((d) => !(d.data().readBy as string[]).includes(uid)).length;
}

function proposalFrom(raw: any): MatchProposal {
  const p = raw ?? {};
  if (!isDateISO(p.dateISO)) throw new ApiError('invalid', 'proposal.dateISO must be a real YYYY-MM-DD date');
  if (typeof p.timeSlotLabel !== 'string' || !p.timeSlotLabel.trim() || p.timeSlotLabel.length > 60) {
    throw new ApiError('invalid', 'proposal.timeSlotLabel must be a non-empty string of at most 60 characters');
  }
  if (p.format !== undefined && p.format !== 'singles' && p.format !== 'doubles') throw new ApiError('invalid', 'proposal.format must be singles or doubles');
  return {
    courtId: p.courtId,
    dateISO: p.dateISO,
    timeSlotLabel: p.timeSlotLabel.trim(),
    ...(p.format ? { format: p.format } : {}),
    status: 'pending',
  };
}

async function requireCourt(courtId: unknown, field: string): Promise<string> {
  const id = docId(courtId, field);
  if (!(await db.collection('courts').doc(id).get()).exists) throw new ApiError('invalid', `${field} does not match a court`);
  return id;
}

router.get('/chats', handle(async (req, res) => {
  const snap = await chats.where('participantIds', 'array-contains', req.uid).get();
  const list: ChatThread[] = await Promise.all(
    snap.docs.map(async (d) => {
      const t = d.data() as Thread;
      return { ...t, id: d.id, unreadCount: await unreadCount(d.id, req.uid, t.participantIds.filter((u) => u !== req.uid)) };
    }),
  );
  res.json(list.sort((x, y) => y.lastMessageAt.localeCompare(x.lastMessageAt)));
}));

router.post('/chats', handle(async (req, res) => {
  const other = docId(req.body?.userId, 'userId');
  if (other === req.uid) throw new ApiError('invalid', 'userId must be another player');
  if (!(await db.collection('users').doc(other).get()).exists) throw new ApiError('invalid', 'userId is not a known player');
  const id = `chat_${[req.uid, other].sort().join('_')}`;
  const now = new Date().toISOString();
  const thread = await db.runTransaction(async (tx) => {
    const snap = await tx.get(chats.doc(id));
    if (snap.exists) return snap.data() as Thread;
    const created: Thread = {
      participantIds: [req.uid, other].sort(),
      lastMessage: 'Chat opened',
      lastMessageAt: now,
      createdAt: now,
      initiatedBy: req.uid,
    };
    tx.set(chats.doc(id), created);
    return created;
  });
  res.json({ ...thread, id, unreadCount: await unreadCount(id, req.uid, [other]) });
}));

router.get('/chats/:id/messages', handle(async (req, res) => {
  await threadFor(req.params.id, req.uid);
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const snap = await chats.doc(req.params.id).collection('messages').where('createdAt', '>=', since).orderBy('createdAt').get();
  res.json(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
}));

router.post('/chats/:id/messages', handle(async (req, res) => {
  const thread = await threadFor(req.params.id, req.uid);
  const b = req.body ?? {};
  if (typeof b.text !== 'string' || !b.text.trim() || b.text.length > 2000) {
    throw new ApiError('invalid', 'text must be a non-empty string of at most 2000 characters');
  }
  const courtId = b.courtId === undefined ? undefined : await requireCourt(b.courtId, 'courtId');
  const proposal = b.proposal === undefined ? undefined : proposalFrom({ ...b.proposal, courtId: await requireCourt(b.proposal?.courtId, 'proposal.courtId') });
  const text = b.text.trim();
  const createdAt = new Date().toISOString();
  const ref = chats.doc(req.params.id).collection('messages').doc();
  const message: ChatMessage = {
    id: ref.id,
    chatId: req.params.id,
    senderId: req.uid,
    text,
    createdAt,
    readBy: [req.uid],
    ...(courtId ? { courtId } : {}),
    ...(proposal ? { proposal } : {}),
  };
  const batch = db.batch();
  batch.set(ref, message);
  batch.update(chats.doc(req.params.id), {
    lastMessage: proposal ? `Match proposal: ${proposal.timeSlotLabel}` : text,
    lastMessageAt: createdAt,
  });
  await batch.commit();

  // Must never fail the request.
  try {
    const recipient = thread.participantIds.find((u) => u !== req.uid)!;
    const [tokens, sender] = await Promise.all([loadTokens([recipient]), db.collection('users').doc(req.uid).get()]);
    await sendPush(
      tokens.map((to) => ({
        to,
        title: `Message from ${sender.data()?.displayName ?? 'Match Partner'}`,
        body: text.slice(0, 120),
        data: { chatId: req.params.id },
      })),
    );
  } catch (err) {
    console.error('chat notification failed', err);
  }
  res.status(201).json(message);
}));

router.post('/chats/:id/messages/:messageId/proposal', handle(async (req, res) => {
  const status = req.body?.status;
  await threadFor(req.params.id, req.uid);
  if (!STATUSES.includes(status)) throw new ApiError('invalid', `status must be one of ${STATUSES.join(', ')}`);
  const ref = chats.doc(req.params.id).collection('messages').doc(docId(req.params.messageId, 'messageId'));
  const updated = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError('not_found', 'No such message');
    const m = { ...(snap.data() as ChatMessage), id: snap.id };
    if (!m.proposal) throw new ApiError('conflict', 'This message has no proposal');
    if (m.senderId === req.uid) throw new ApiError('forbidden', 'Only the other player can answer a proposal');
    if (m.proposal.status !== 'pending') throw new ApiError('conflict', `This proposal was already ${m.proposal.status}`);
    tx.update(ref, { 'proposal.status': status });
    return { ...m, proposal: { ...m.proposal, status } };
  });
  res.json(updated);
}));

router.post('/chats/:id/read', handle(async (req, res) => {
  const thread = await threadFor(req.params.id, req.uid);
  const others = thread.participantIds.filter((u) => u !== req.uid);
  const snap = await chats.doc(req.params.id).collection('messages').where('senderId', 'in', others).get();
  const unread = snap.docs.filter((d) => !(d.data().readBy as string[]).includes(req.uid));
  for (let i = 0; i < unread.length; i += 400) {
    const batch = db.batch();
    for (const d of unread.slice(i, i + 400)) batch.update(d.ref, { readBy: FieldValue.arrayUnion(req.uid) });
    await batch.commit();
  }
  res.sendStatus(204);
}));
