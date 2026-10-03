import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';

import { auth } from './firebase';
import type { Role } from './types';

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireAuth`. */
      uid: string;
      role: Role;
    }
  }
}

const STATUS = {
  invalid: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  not_implemented: 501,
} as const;

/** Thrown anywhere in a handler; `errorHandler` turns it into the contract's error body. */
export class ApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: keyof typeof STATUS,
    message: string,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

/** Express 4 does not catch rejected promises; every async handler goes through this. */
export const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

/** Placeholder for a route whose ticket has not landed. */
export const notImplemented: RequestHandler = (_req, _res, next) =>
  next(new ApiError('not_implemented', 'This route is not implemented yet'));

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    next(new ApiError('unauthenticated', 'Missing bearer token'));
    return;
  }
  auth.verifyIdToken(header.slice(7)).then(
    (decoded) => {
      req.uid = decoded.uid;
      req.role = decoded.admin === true ? 'admin' : decoded.caretaker === true ? 'caretaker' : 'player';
      next();
    },
    () => next(new ApiError('unauthenticated', 'Invalid or expired token')),
  );
};

/** Use inside a handler: `requireRole(req, 'admin', 'caretaker')`. */
export function requireRole(req: Request, ...roles: Role[]): void {
  if (!roles.includes(req.role)) throw new ApiError('forbidden', `Requires role: ${roles.join(' or ')}`);
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
  } else if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'invalid', message: 'Request body is not valid JSON' } });
  } else {
    console.error(err);
    res.status(500).json({ error: { code: 'internal', message: 'Internal error' } });
  }
};
