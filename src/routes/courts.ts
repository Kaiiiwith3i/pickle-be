/** Ticket 04. */
import { Router } from 'express';

import { notImplemented } from '../http';

export const router = Router();

router.get('/courts', notImplemented);
router.post('/courts', notImplemented);
router.post('/courts/status', notImplemented);
router.patch('/courts/:id', notImplemented);
router.get('/courts/:id/bookings', notImplemented);
