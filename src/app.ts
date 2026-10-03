import express from 'express';

import { CONFIG } from './config';
import { ApiError, errorHandler, requireAuth } from './http';
import { router as algorithm } from './routes/algorithm';
import { router as auth } from './routes/auth';
import { router as bookings } from './routes/bookings';
import { router as chats } from './routes/chats';
import { router as courts } from './routes/courts';
import { router as geo } from './routes/geo';
import { router as matchmake } from './routes/matchmake';
import { router as me } from './routes/me';
import { router as partner } from './routes/partner';
import { router as posts } from './routes/posts';
import { router as sessions } from './routes/sessions';

/** The whole API. Route files declare full paths, so they are all mounted at the root. */
export function createApp(): express.Express {
  const app = express();

  // The Expo web build runs on another origin. Tokens travel in a header, not a cookie, so `*` is safe.
  app.use((req, res, next) => {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
    });
    if (req.method === 'OPTIONS') res.sendStatus(204);
    else next();
  });
  app.use(express.json());

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/config', (_req, res) => {
    res.json(CONFIG);
  });
  app.use(auth);

  app.use(requireAuth);
  app.use(geo, me, partner, courts, bookings, sessions, posts, chats, matchmake, algorithm);

  app.use((_req, _res, next) => next(new ApiError('not_found', 'No such route')));
  app.use(errorHandler);
  return app;
}
