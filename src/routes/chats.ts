/** Ticket 07. */
import { Router } from 'express';

import { notImplemented } from '../http';

export const router = Router();

router.get('/chats', notImplemented);
router.post('/chats', notImplemented);
router.get('/chats/:id/messages', notImplemented);
router.post('/chats/:id/messages', notImplemented);
router.post('/chats/:id/messages/:messageId/proposal', notImplemented);
router.post('/chats/:id/read', notImplemented);
