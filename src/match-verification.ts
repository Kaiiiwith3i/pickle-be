/**
 * Match-result state machine. Pure: each function takes the stored post and
 * returns the fields to change (`undefined` = delete the field), or throws.
 * Who may call it is checked here too, so the rules live in one place.
 *
 * pending -> approved (opponent confirms / author accepts a counter / admin confirms)
 * pending -> rejected (opponent disputes / admin dismisses)
 * pending|rejected|approved -> expired (admin voids); pending|rejected -> pending (admin re_entry)
 */
import { formatScoreLine, parseScoreLine, validateMatchScore } from './engine';
import type { Post } from './types';

/** Same codes as `ApiError`; the route converts. Kept separate so this file stays free of Firebase. */
export class RuleError extends Error {
  constructor(
    readonly code: 'invalid' | 'forbidden' | 'conflict',
    message: string,
  ) {
    super(message);
  }
}

export type Patch = Partial<Record<keyof Post, unknown>>;
export type ResolveAction = 'confirm' | 'dismiss' | 'void' | 're_entry';

const CLEAR_COUNTER = { counterScoreLine: undefined, counterProposedBy: undefined };

/** Validates a score line written author-first and returns the canonical text and who won it. */
export function checkScoreLine(scoreLine: unknown, declared?: 'author' | 'opponent') {
  if (typeof scoreLine !== 'string' || scoreLine.length > 100) {
    throw new RuleError('invalid', 'scoreLine must be a string such as "11-7, 9-11, 11-8"');
  }
  const games = parseScoreLine(scoreLine);
  if (games.length === 0) throw new RuleError('invalid', 'scoreLine must look like "11-9 · 11-7"');
  const result = validateMatchScore(games, {
    declaredWinner: declared && (declared === 'author' ? 'player1' : 'player2'),
  });
  if (!result.valid) throw new RuleError('invalid', result.error ?? 'Invalid score line');
  return { scoreLine: formatScoreLine(games), winner: result.winner === 'player1' ? ('author' as const) : ('opponent' as const) };
}

function matchOf(post: Post, allowed: Array<Post['verificationStatus']>): void {
  if (post.kind !== 'match_summary') throw new RuleError('conflict', 'This post is not a match result');
  if (!allowed.includes(post.verificationStatus)) {
    throw new RuleError('conflict', `A result that is ${post.verificationStatus} cannot be changed this way`);
  }
}

function asOpponent(post: Post, uid: string): void {
  if (post.opponentId !== uid) throw new RuleError('forbidden', 'Only the tagged opponent can do this');
}

export function confirm(post: Post, uid: string): Patch {
  asOpponent(post, uid);
  matchOf(post, ['pending']);
  return { confirmed: true, disputed: false, verificationStatus: 'approved', ...CLEAR_COUNTER };
}

export function dispute(post: Post, uid: string): Patch {
  asOpponent(post, uid);
  matchOf(post, ['pending']);
  return { confirmed: false, disputed: true, verificationStatus: 'rejected', ...CLEAR_COUNTER };
}

export function counterScore(post: Post, uid: string, scoreLine: unknown): Patch {
  asOpponent(post, uid);
  matchOf(post, ['pending']);
  return { counterScoreLine: checkScoreLine(scoreLine).scoreLine, counterProposedBy: uid };
}

export function acceptCounter(post: Post, uid: string): Patch {
  if (post.authorId !== uid) throw new RuleError('forbidden', 'Only the author can accept a counter-score');
  matchOf(post, ['pending']);
  if (!post.counterScoreLine) throw new RuleError('conflict', 'There is no counter-score to accept');
  const { scoreLine, winner } = checkScoreLine(post.counterScoreLine);
  return {
    scoreLine,
    winnerId: winner === 'author' ? post.authorId : post.opponentId,
    confirmed: true,
    disputed: false,
    verificationStatus: 'approved',
    ...CLEAR_COUNTER,
  };
}

/** Admin only (checked by the route). */
export function resolve(post: Post, action: ResolveAction): Patch {
  switch (action) {
    case 'confirm':
      matchOf(post, ['pending', 'rejected']);
      return { confirmed: true, disputed: false, verificationStatus: 'approved', ...CLEAR_COUNTER };
    case 'dismiss':
      matchOf(post, ['pending', 'rejected']);
      return { confirmed: false, disputed: true, verificationStatus: 'rejected', ...CLEAR_COUNTER };
    case 'void':
      matchOf(post, ['pending', 'rejected', 'approved']);
      return { confirmed: false, disputed: false, verificationStatus: 'expired', ...CLEAR_COUNTER };
    case 're_entry':
      matchOf(post, ['pending', 'rejected']);
      return { confirmed: false, disputed: false, verificationStatus: 'pending', ...CLEAR_COUNTER };
  }
}
