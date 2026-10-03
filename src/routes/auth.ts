/** Ticket 03. Public: mounted before the token check. */
import { Router } from 'express';

import { notImplemented } from '../http';

export const router = Router();

router.post('/auth/register', notImplemented);
router.post('/auth/login', notImplemented);
router.post('/auth/refresh', notImplemented);
