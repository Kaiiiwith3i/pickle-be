import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';

import { auth } from './firebase';
import type { Role, SkillTier } from './types';

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

export const bad = (message: string) => new ApiError('invalid', message);

export const TIERS: SkillTier[] = ['beginner', 'intermediate', 'advanced'];

/**
 * Any id taken from a path, query or body before it reaches `.doc()`. Express decodes `%2F`, and Firestore
 * throws on `a/b`, `''` and `__x__` (or, worse, `<uid>/private/profile` addresses another document).
 */
export function docId(value: unknown, name: string): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 128 ||
    value.includes('/') ||
    value === '.' ||
    value === '..' ||
    /^__.*__$/.test(value)
  ) {
    throw bad(`${name} is not a valid id`);
  }
  return value;
}

/** `YYYY-MM-DD` that is a real calendar date. */
export function isDateISO(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}

export function text(value: unknown, field: string, max: number): string;
export function text(value: unknown, field: string, max: number, required: false): string | undefined;
export function text(value: unknown, field: string, max: number, required = true): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) {
    throw bad(`${field} must be a${required ? ' non-empty' : ''} string of at most ${max} characters`);
  }
  return value.trim();
}

export function int(value: unknown, field: string, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw bad(`${field} must be an integer between ${min} and ${max}`);
  }
  return value as number;
}

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
  } else if (err?.type === 'entity.too.large') {
    res.status(400).json({ error: { code: 'invalid', message: 'Request body is too large' } });
  } else if (err?.status >= 400 && err?.status < 500) {
    // Any other body-parser/client fault (unsupported charset, aborted request, ...).
    res.status(400).json({ error: { code: 'invalid', message: 'Request could not be read' } });
  } else {
    console.error(err);
    res.status(500).json({ error: { code: 'internal', message: 'Internal error' } });
  }
};
