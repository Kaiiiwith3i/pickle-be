import {
  formatScoreLine,
  parseScoreLine,
  validateGameScore,
  validateMatchScore,
} from '../../src/engine/score';

describe('Pickleball Score Validation Engine', () => {
  describe('validateGameScore', () => {
    it('accepts standard winning scores to 11', () => {
      const res1 = validateGameScore(11, 9);
      expect(res1.valid).toBe(true);
      expect(res1.winner).toBe('player1');

      const res2 = validateGameScore(4, 11);
      expect(res2.valid).toBe(true);
      expect(res2.winner).toBe('player2');

      const res3 = validateGameScore(11, 0);
      expect(res3.valid).toBe(true);
      expect(res3.winner).toBe('player1');
    });

    it('accepts extra point deuce victories with exact win-by-2 margin', () => {
      const res1 = validateGameScore(12, 10);
      expect(res1.valid).toBe(true);
      expect(res1.winner).toBe('player1');

      const res2 = validateGameScore(13, 15, 15);
      expect(res2.valid).toBe(true);
      expect(res2.winner).toBe('player2');

      const res3 = validateGameScore(14, 12);
      expect(res3.valid).toBe(true);
      expect(res3.winner).toBe('player1');
    });

    it('rejects incomplete games where target points are not reached', () => {
      const res = validateGameScore(8, 6, 11);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('must reach at least 11 points');
    });

    it('rejects games without win-by-2 margin', () => {
      const res1 = validateGameScore(11, 10);
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('Must win by at least 2 points');

      const res2 = validateGameScore(15, 14, 15);
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain('Must win by at least 2 points');
    });

    it('rejects tied games', () => {
      const res = validateGameScore(11, 11);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('cannot end in a tie');
    });

    it('enforces game termination invariant (rejects runaway scores past deuce)', () => {
      // If winner scored 12, opponent MUST have scored 10.
      // A score of 12-8 is impossible under pickleball rules because the game ended at 11-8.
      const res1 = validateGameScore(12, 8);
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('In extra points, game terminates immediately at a 2-point lead');

      // Score of 14-10 is impossible because at 12-10 game would have ended.
      const res2 = validateGameScore(14, 10);
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain('In extra points, game terminates immediately at a 2-point lead');
    });

    it('rejects invalid inputs like negative numbers or non-integers', () => {
      expect(validateGameScore(-1, 11).valid).toBe(false);
      expect(validateGameScore(11.5, 9).valid).toBe(false);
    });
  });

  describe('parseScoreLine & formatScoreLine', () => {
    it('parses standard dot-separated scorelines', () => {
      const games = parseScoreLine('11-9 · 11-7');
      expect(games).toEqual([
        { p1: 11, p2: 9 },
        { p1: 11, p2: 7 },
      ]);
    });

    it('parses 3-set scorelines with comma or slash delimiters', () => {
      const games = parseScoreLine('11-8, 9-11, 11-7');
      expect(games).toEqual([
        { p1: 11, p2: 8 },
        { p1: 9, p2: 11 },
        { p1: 11, p2: 7 },
      ]);
    });

    it('parses single game format', () => {
      const games = parseScoreLine('15-13');
      expect(games).toEqual([{ p1: 15, p2: 13 }]);
    });

    it('formats games to canonical dot-separated string', () => {
      const formatted = formatScoreLine([
        { p1: 11, p2: 8 },
        { p1: 9, p2: 11 },
        { p1: 11, p2: 7 },
      ]);
      expect(formatted).toBe('11-8 · 9-11 · 11-7');
    });
  });

  describe('validateMatchScore', () => {
    it('validates a clean 2-0 Best of 3 match', () => {
      const games = parseScoreLine('11-9 · 11-7');
      const res = validateMatchScore(games);
      expect(res.valid).toBe(true);
      expect(res.winner).toBe('player1');
      expect(res.gamesP1).toBe(2);
      expect(res.gamesP2).toBe(0);
    });

    it('validates a 3-set Best of 3 comeback match (2-1)', () => {
      const games = parseScoreLine('9-11 · 11-6 · 11-8');
      const res = validateMatchScore(games);
      expect(res.valid).toBe(true);
      expect(res.winner).toBe('player1');
      expect(res.gamesP1).toBe(2);
      expect(res.gamesP2).toBe(1);
    });

    it('rejects a 3rd set if the match was already won 2-0 in Set 2', () => {
      const games = parseScoreLine('11-9 · 11-7 · 11-4');
      const res = validateMatchScore(games);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Match was decided 2-0 after Set 2. Set 3 should not be played');
    });

    it('rejects incomplete Best of 3 match if split 1-1 without deciding 3rd set', () => {
      const games = parseScoreLine('11-8 · 9-11');
      const res = validateMatchScore(games);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('In Best of 3, a player must win 2 sets');
    });

    it('validates single game match to 15', () => {
      const games = parseScoreLine('15-13');
      const res = validateMatchScore(games);
      expect(res.valid).toBe(true);
      expect(res.winner).toBe('player1');
    });

    it('enforces consistency between declared match winner and scoreline', () => {
      // Scoreline: Player 1 won 2-0
      const games = parseScoreLine('11-9 · 11-7');

      // User claims player2 (opponent) won -> INCONSISTENCY DETECTED!
      const mismatch = validateMatchScore(games, { declaredWinner: 'player2' });
      expect(mismatch.valid).toBe(false);
      expect(mismatch.error).toContain('Winner mismatch');

      // User correctly claims player1 won -> VALID
      const match = validateMatchScore(games, { declaredWinner: 'player1' });
      expect(match.valid).toBe(true);
    });

    it('validates a clean 3-0 Best of 5 match', () => {
      const games = parseScoreLine('11-7 · 11-8 · 11-6');
      const res = validateMatchScore(games, { format: 'best_of_5' });
      expect(res.valid).toBe(true);
      expect(res.winner).toBe('player1');
      expect(res.gamesP1).toBe(3);
      expect(res.gamesP2).toBe(0);
    });

    it('validates a 5-set Best of 5 battle (3-2)', () => {
      const games = parseScoreLine('11-9 · 8-11 · 11-7 · 9-11 · 11-8');
      const res = validateMatchScore(games, { format: 'best_of_5' });
      expect(res.valid).toBe(true);
      expect(res.winner).toBe('player1');
      expect(res.gamesP1).toBe(3);
      expect(res.gamesP2).toBe(2);
    });

    it('rejects a 4th set in Best of 5 if match was already decided 3-0', () => {
      const games = parseScoreLine('11-7 · 11-8 · 11-6 · 11-4');
      const res = validateMatchScore(games, { format: 'best_of_5' });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Match was decided 3-0 after Set 3. Subsequent sets should not be played');
    });

    it('rejects incomplete Best of 5 match (e.g. 2-2)', () => {
      const games = parseScoreLine('11-9 · 8-11 · 11-7 · 9-11');
      const res = validateMatchScore(games, { format: 'best_of_5' });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('In Best of 5, a player must win 3 sets');
    });

    it('validates custom format with mixed target points per set', () => {
      const games = [
        { p1: 11, p2: 9, targetPoints: 11 },
        { p1: 9, p2: 11, targetPoints: 11 },
        { p1: 15, p2: 13, targetPoints: 15 }, // deciding set played to 15!
      ];
      const res = validateMatchScore(games, { format: 'custom' });
      expect(res.valid).toBe(true);
      expect(res.winner).toBe('player1');
      expect(res.gamesP1).toBe(2);
      expect(res.gamesP2).toBe(1);
    });

    it('rejects tied custom match when sets are split evenly', () => {
      const games = parseScoreLine('11-9 · 8-11');
      const res = validateMatchScore(games, { format: 'custom' });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Match sets are tied (1-1)');
    });
  });
});
