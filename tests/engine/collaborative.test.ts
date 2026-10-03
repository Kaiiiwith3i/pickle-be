import { InteractionMatrix } from '../../src/engine/collaborative';

describe('InteractionMatrix', () => {
  it('returns null (CF unavailable) when either player has no history', () => {
    const m = new InteractionMatrix([{ playerId: 'a', itemId: 's1' }]);
    expect(m.similarity('a', 'b')).toBeNull();
    expect(m.similarity('b', 'c')).toBeNull();
  });

  it('scores identical engagement histories at 1', () => {
    const m = new InteractionMatrix([
      { playerId: 'a', itemId: 's1' },
      { playerId: 'a', itemId: 's2' },
      { playerId: 'b', itemId: 's1' },
      { playerId: 'b', itemId: 's2' },
    ]);
    expect(m.similarity('a', 'b')).toBeCloseTo(1);
  });

  it('scores disjoint histories at 0', () => {
    const m = new InteractionMatrix([
      { playerId: 'a', itemId: 's1' },
      { playerId: 'b', itemId: 's2' },
    ]);
    expect(m.similarity('a', 'b')).toBe(0);
  });

  it('accumulates weights for repeated engagement', () => {
    const m = new InteractionMatrix();
    m.add({ playerId: 'a', itemId: 's1' });
    m.add({ playerId: 'a', itemId: 's1' });
    m.add({ playerId: 'a', itemId: 's2', weight: 3 });
    expect(m.interactionCount('a')).toBe(5);
    expect(m.interactionCount('ghost')).toBe(0);
  });

  it('ranks partially-shared histories between disjoint and identical', () => {
    const m = new InteractionMatrix([
      { playerId: 'a', itemId: 's1' },
      { playerId: 'a', itemId: 's2' },
      { playerId: 'b', itemId: 's2' },
      { playerId: 'b', itemId: 's3' },
    ]);
    const sim = m.similarity('a', 'b')!;
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});
