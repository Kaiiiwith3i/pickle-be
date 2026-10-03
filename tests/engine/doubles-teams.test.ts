import { evaluateGate } from '../../src/engine/deterministic';
import { formOpposingTeams } from '../../src/engine/doubles';
import { DEFAULT_CONFIG } from '../../src/engine/hybrid';
import { CALAMBA, LOS_BANOS, MANILA, SAT_EVENING, SAT_MORNING, makePlayer } from './fixtures';

describe('formOpposingTeams', () => {
  const a = makePlayer({ id: 'a' });
  const b = makePlayer({ id: 'b' });
  const c = makePlayer({ id: 'c', location: LOS_BANOS });
  const noOverlap = makePlayer({ id: 'd', availability: [SAT_EVENING] });
  const advanced = makePlayer({ id: 'e', tier: 'advanced' });
  const beginner = makePlayer({ id: 'h', tier: 'beginner' });
  const outside = makePlayer({ id: 'f', location: MANILA });
  const optedOut = makePlayer({ id: 'g', matchmakingOptIn: false });
  const pool = [a, b, c, noOverlap, advanced, beginner, outside, optedOut];

  it('only pairs players who pass the gate with each other', () => {
    const teams = formOpposingTeams(pool, []);
    expect(teams.length).toBeGreaterThan(0);
    for (const t of teams) {
      expect(evaluateGate(t.player1, t.player2, DEFAULT_CONFIG).passed).toBe(true);
      expect(evaluateGate(t.player2, t.player1, DEFAULT_CONFIG).passed).toBe(true);
    }
    const ids = teams.map((t) => t.id);
    expect(ids).toContain('team_a_b');
    expect(ids).not.toContain('team_a_d'); // no shared schedule
    expect(ids).not.toContain('team_e_h'); // beginner and advanced are two tiers apart
    expect(ids.some((id) => id.includes('_f') || id.includes('team_f'))).toBe(false); // outside the corridor
    expect(ids.some((id) => id.includes('g'))).toBe(false); // not opted in
  });

  it('never repeats a pair or pairs a player with themselves', () => {
    const ids = formOpposingTeams(pool, []).map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of formOpposingTeams(pool, [])) expect(t.player1.id).not.toBe(t.player2.id);
  });

  it('leaves out the excluded seeker and partner', () => {
    const teams = formOpposingTeams(pool, ['a', 'b']);
    for (const t of teams) {
      expect(['a', 'b']).not.toContain(t.player1.id);
      expect(['a', 'b']).not.toContain(t.player2.id);
    }
  });

  it('returns nothing when fewer than two players qualify', () => {
    expect(formOpposingTeams([a], [])).toEqual([]);
  });
});
