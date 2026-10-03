/** Ticket 06: community feed and match results. */
import { Router } from 'express';

import { notImplemented } from '../http';

export const router = Router();

router.get('/posts', notImplemented);
router.post('/posts', notImplemented);
router.post('/posts/:id/like', notImplemented);
router.post('/posts/:id/confirm', notImplemented);
router.post('/posts/:id/dispute', notImplemented);
router.post('/posts/:id/counter-score', notImplemented);
router.post('/posts/:id/accept-counter', notImplemented);
router.post('/posts/:id/resolve', notImplemented);
