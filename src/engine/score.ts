/**
 * Pure Engine Pickleball Score Validation & Parsing Layer.
 *
 * Invariants (USA Pickleball / International Standards):
 * 1. Standard game targets T in {11, 15, 21}.
 * 2. Win-by-2 margin: Max score >= T and (Max - Min) >= 2.
 * 3. Game Termination Invariant: If W == T, 0 <= L <= T-2.
 *    If W > T (extra points / deuce), L == W - 2 (the game terminates
 *    as soon as a 2-point lead is achieved; scores like 12-8 or 14-10 are impossible).
 * 4. Best of 3: First to win 2 games wins match. Game 3 is played iff 1-1 split.
 * 5. Single Game: Exactly 1 game determines the match winner.
 * 6. Match Winner Synchronization: Declared match winner must strictly match
 *    the sets won.
 */

export interface GameScore {
  p1: number;
  p2: number;
  targetPoints?: number;
}

export type MatchFormat =
  | 'best_of_3'
  | 'best_of_5'
  | 'single_11'
  | 'single_15'
  | 'single_21'
  | 'custom';

export interface GameValidationResult {
  valid: boolean;
  winner: 'player1' | 'player2' | null;
  error?: string;
  isComplete: boolean;
}

export interface MatchValidationResult {
  valid: boolean;
  winner: 'player1' | 'player2' | null;
  gamesP1: number;
  gamesP2: number;
  error?: string;
  canonicalScoreLine: string;
}

/**
 * Validates an individual pickleball game score.
 */
export function validateGameScore(
  p1: number,
  p2: number,
  targetPoints: number = 11,
): GameValidationResult {
  if (!Number.isInteger(p1) || !Number.isInteger(p2) || p1 < 0 || p2 < 0) {
    return {
      valid: false,
      winner: null,
      error: 'Scores must be non-negative integers.',
      isComplete: false,
    };
  }

  if (p1 === p2) {
    return {
      valid: false,
      winner: null,
      error: `Game is tied (${p1}-${p2}). Pickleball games cannot end in a tie.`,
      isComplete: false,
    };
  }

  const w = Math.max(p1, p2);
  const l = Math.min(p1, p2);
  const winner: 'player1' | 'player2' = p1 > p2 ? 'player1' : 'player2';

  if (w < targetPoints) {
    return {
      valid: false,
      winner: null,
      error: `Game incomplete (${p1}-${p2}). Winning score must reach at least ${targetPoints} points.`,
      isComplete: false,
    };
  }

  const diff = w - l;

  if (diff < 2) {
    return {
      valid: false,
      winner: null,
      error: `Must win by at least 2 points (${p1}-${p2}). A 1-point margin is not a complete game.`,
      isComplete: false,
    };
  }

  // Game termination invariant:
  // If winner scored targetPoints, loser must have at most targetPoints - 2.
  // If winner scored > targetPoints, loser must be exactly winner - 2.
  if (w > targetPoints && diff > 2) {
    return {
      valid: false,
      winner: null,
      error: `Invalid score (${p1}-${p2}). In extra points, game terminates immediately at a 2-point lead (expected ${w}-${w - 2}).`,
      isComplete: false,
    };
  }

  return {
    valid: true,
    winner,
    isComplete: true,
  };
}

/**
 * Parses a scoreline string (e.g. "11-9 · 11-7", "11-8, 9-11, 11-7", "15-13")
 * into structured GameScore objects.
 */
export function parseScoreLine(scoreLine: string): GameScore[] {
  if (!scoreLine || typeof scoreLine !== 'string') return [];

  // Split by common delimiters: '·', ',', '/', ';', or multiple spaces
  const parts = scoreLine
    .trim()
    .split(/[\s·,/;&]+/)
    .filter(Boolean);

  const games: GameScore[] = [];

  for (const part of parts) {
    // Match pattern like "11-9" or "11:9"
    const match = part.match(/^(\d+)[-:](\d+)$/);
    if (match) {
      games.push({
        p1: parseInt(match[1], 10),
        p2: parseInt(match[2], 10),
      });
    }
  }

  return games;
}

/**
 * Formats structured games into canonical scoreline string e.g. "11-9 · 11-7"
 */
export function formatScoreLine(games: GameScore[]): string {
  return games.map((g) => `${g.p1}-${g.p2}`).join(' · ');
}

/**
 * Validates a full match scoreline against pickleball rules and optional declared winner.
 */
export function validateMatchScore(
  games: GameScore[],
  options?: {
    format?: MatchFormat;
    declaredWinner?: 'player1' | 'player2';
  },
): MatchValidationResult {
  if (!games || games.length === 0) {
    return {
      valid: false,
      winner: null,
      gamesP1: 0,
      gamesP2: 0,
      error: 'Match score cannot be empty.',
      canonicalScoreLine: '',
    };
  }

  const format =
    options?.format ??
    (games.length === 1 && Math.max(games[0].p1, games[0].p2) >= 20
      ? 'single_21'
      : games.length === 1 && Math.max(games[0].p1, games[0].p2) >= 14
        ? 'single_15'
        : games.length === 1
          ? 'single_11'
          : games.length > 3
            ? 'best_of_5'
            : 'best_of_3');
  const defaultTargetPoints =
    format === 'single_15' ? 15 : format === 'single_21' ? 21 : 11;

  let gamesP1 = 0;
  let gamesP2 = 0;

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const gameTarget = game.targetPoints ?? defaultTargetPoints;
    const gameVal = validateGameScore(game.p1, game.p2, gameTarget);
    if (!gameVal.valid) {
      return {
        valid: false,
        winner: null,
        gamesP1,
        gamesP2,
        error: `Set ${i + 1}: ${gameVal.error}`,
        canonicalScoreLine: formatScoreLine(games),
      };
    }

    if (gameVal.winner === 'player1') gamesP1++;
    if (gameVal.winner === 'player2') gamesP2++;

    // In Best of 3, check if match was already decided
    if (format === 'best_of_3') {
      if (i === 1 && (gamesP1 === 2 || gamesP2 === 2) && games.length > 2) {
        return {
          valid: false,
          winner: gamesP1 === 2 ? 'player1' : 'player2',
          gamesP1,
          gamesP2,
          error: `Match was decided 2-0 after Set 2. Set 3 should not be played.`,
          canonicalScoreLine: formatScoreLine(games),
        };
      }
    }

    // In Best of 5, check if match was already decided
    if (format === 'best_of_5') {
      if ((gamesP1 === 3 || gamesP2 === 3) && i < games.length - 1) {
        return {
          valid: false,
          winner: gamesP1 === 3 ? 'player1' : 'player2',
          gamesP1,
          gamesP2,
          error: `Match was decided ${gamesP1}-${gamesP2} after Set ${i + 1}. Subsequent sets should not be played.`,
          canonicalScoreLine: formatScoreLine(games),
        };
      }
    }
  }

  // Check match completion
  let matchWinner: 'player1' | 'player2' | null = null;

  if (format === 'best_of_3') {
    if (gamesP1 === 2) matchWinner = 'player1';
    else if (gamesP2 === 2) matchWinner = 'player2';
    else {
      return {
        valid: false,
        winner: null,
        gamesP1,
        gamesP2,
        error: `Match is incomplete (${gamesP1}-${gamesP2}). In Best of 3, a player must win 2 sets.`,
        canonicalScoreLine: formatScoreLine(games),
      };
    }
  } else if (format === 'best_of_5') {
    if (gamesP1 === 3) matchWinner = 'player1';
    else if (gamesP2 === 3) matchWinner = 'player2';
    else {
      return {
        valid: false,
        winner: null,
        gamesP1,
        gamesP2,
        error: `Match is incomplete (${gamesP1}-${gamesP2}). In Best of 5, a player must win 3 sets.`,
        canonicalScoreLine: formatScoreLine(games),
      };
    }
  } else if (format === 'custom') {
    if (gamesP1 === gamesP2) {
      return {
        valid: false,
        winner: null,
        gamesP1,
        gamesP2,
        error: `Match sets are tied (${gamesP1}-${gamesP2}). Play a deciding set to determine the winner.`,
        canonicalScoreLine: formatScoreLine(games),
      };
    }
    matchWinner = gamesP1 > gamesP2 ? 'player1' : 'player2';
  } else {
    // Single game format
    if (games.length > 1) {
      return {
        valid: false,
        winner: null,
        gamesP1,
        gamesP2,
        error: `Single game format only allows 1 set, but ${games.length} sets were provided.`,
        canonicalScoreLine: formatScoreLine(games),
      };
    }
    matchWinner = gamesP1 > gamesP2 ? 'player1' : 'player2';
  }

  // Check declared winner consistency
  if (options?.declaredWinner && matchWinner !== options.declaredWinner) {
    const expected = options.declaredWinner === 'player1' ? 'Player 1' : 'Player 2';
    const actual = matchWinner === 'player1' ? 'Player 1' : 'Player 2';
    return {
      valid: false,
      winner: matchWinner,
      gamesP1,
      gamesP2,
      error: `Winner mismatch: match winner is declared as ${expected}, but score shows ${actual} won (${gamesP1}-${gamesP2}).`,
      canonicalScoreLine: formatScoreLine(games),
    };
  }

  return {
    valid: true,
    winner: matchWinner,
    gamesP1,
    gamesP2,
    canonicalScoreLine: formatScoreLine(games),
  };
}
