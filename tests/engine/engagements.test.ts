import { InteractionMatrix, deriveEngagements } from '../../src/engine';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const session = (id: string, startsAt: string, attendeeIds: string[]) => ({
  id,
  startsAt,
  durationMin: 120,
  attendeeIds,
});
const match = (id: string, over: object = {}) => ({
  id,
  kind: 'match_summary',
  authorId: 'a',
  opponentId: 'b',
  confirmed: true,
  ...over,
});

describe('deriveEngagements', () => {
  it('counts attendance only for sessions that have ended', () => {
    const records = deriveEngagements(
      [
        session('past', '2026-10-03T08:00:00Z', ['a', 'b']),
        session('running', '2026-10-04T11:00:00Z', ['a', 'c']),
        session('future', '2026-10-05T08:00:00Z', ['a', 'd']),
      ],
      [],
      NOW,
    );
    expect(records).toEqual([
      { playerId: 'a', itemId: 'past' },
      { playerId: 'b', itemId: 'past' },
    ]);
  });

  it('counts a match for both players only when confirmed and undisputed', () => {
    const records = deriveEngagements(
      [],
      [
        match('ok'),
        match('pending', { confirmed: false }),
        match('disputed', { disputed: true }),
        { id: 'chatter', kind: 'post', authorId: 'a' },
      ],
      NOW,
    );
    expect(records).toEqual([
      { playerId: 'a', itemId: 'ok' },
      { playerId: 'b', itemId: 'ok' },
    ]);
  });

  it('feeds the interaction matrix: a confirmed match creates shared history', () => {
    const before = new InteractionMatrix(deriveEngagements([], [match('m', { confirmed: false })], NOW));
    const after = new InteractionMatrix(deriveEngagements([], [match('m')], NOW));
    expect(before.similarity('a', 'b')).toBeNull();
    expect(after.similarity('a', 'b')).toBe(1);
  });
});
