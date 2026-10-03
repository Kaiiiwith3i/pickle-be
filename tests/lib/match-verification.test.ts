import { acceptCounter, checkScoreLine, confirm, counterScore, dispute, resolve } from '../../src/match-verification';
import type { Post } from '../../src/types';

const post = (extra: Partial<Post> = {}): Post => ({
  id: 'p', authorId: 'a', opponentId: 'o', winnerId: 'a', body: '', createdAt: '', likedBy: [],
  kind: 'match_summary', scoreLine: '11-7 · 11-9', confirmed: false, disputed: false, verificationStatus: 'pending',
  ...extra,
});

describe('checkScoreLine', () => {
  it('canonicalises and names the winner', () => {
    expect(checkScoreLine('11-7, 9-11, 11-8')).toEqual({ scoreLine: '11-7 · 9-11 · 11-8', winner: 'author' });
    expect(checkScoreLine('7-11 5-11').winner).toBe('opponent');
  });
  it.each(['', 'abc', '11-10', '10-8', '11-7 · 11-9 · 11-1', '11-7 · 7-11'])('rejects %j', (s) => {
    expect(() => checkScoreLine(s)).toThrow();
  });
  it('rejects a declared winner that contradicts the score', () => {
    expect(() => checkScoreLine('11-7 · 11-9', 'opponent')).toThrow();
    expect(() => checkScoreLine('11-7 · 11-9', 'author')).not.toThrow();
  });
});

describe('state machine', () => {
  it('only the opponent confirms or disputes', () => {
    for (const fn of [confirm, dispute]) {
      expect(() => fn(post(), 'a')).toThrow(expect.objectContaining({ code: 'forbidden' }));
      expect(() => fn(post(), 'x')).toThrow(expect.objectContaining({ code: 'forbidden' }));
    }
    expect(confirm(post(), 'o')).toMatchObject({ confirmed: true, verificationStatus: 'approved' });
    expect(dispute(post(), 'o')).toMatchObject({ disputed: true, verificationStatus: 'rejected' });
  });
  it('refuses illegal transitions with 409', () => {
    for (const s of ['approved', 'rejected', 'expired'] as const) {
      expect(() => confirm(post({ verificationStatus: s }), 'o')).toThrow(expect.objectContaining({ code: 'conflict' }));
    }
    expect(() => confirm(post({ kind: 'post' }), 'o')).toThrow(expect.objectContaining({ code: 'conflict' }));
  });
  it('accepting a counter-score rewrites the score and winner, author only', () => {
    const p = post({ counterScoreLine: '9-11 · 9-11', counterProposedBy: 'o' });
    expect(() => acceptCounter(p, 'o')).toThrow(expect.objectContaining({ code: 'forbidden' }));
    expect(() => acceptCounter(post(), 'a')).toThrow(expect.objectContaining({ code: 'conflict' }));
    expect(acceptCounter(p, 'a')).toMatchObject({ scoreLine: '9-11 · 9-11', winnerId: 'o', confirmed: true });
  });
  it('validates the counter-score', () => {
    expect(() => counterScore(post(), 'o', '11-10')).toThrow(expect.objectContaining({ code: 'invalid' }));
    expect(counterScore(post(), 'o', '11-9 · 11-8')).toMatchObject({ counterProposedBy: 'o' });
  });
  it('admin resolve covers each action and blocks voided results', () => {
    expect(resolve(post({ verificationStatus: 'rejected' }), 'confirm')).toMatchObject({ verificationStatus: 'approved' });
    expect(resolve(post(), 'dismiss')).toMatchObject({ verificationStatus: 'rejected' });
    expect(resolve(post({ verificationStatus: 'approved' }), 'void')).toMatchObject({ verificationStatus: 'expired' });
    expect(resolve(post({ verificationStatus: 'rejected' }), 're_entry')).toMatchObject({ verificationStatus: 'pending' });
    expect(() => resolve(post({ verificationStatus: 'expired' }), 'confirm')).toThrow(expect.objectContaining({ code: 'conflict' }));
    expect(() => resolve(post({ verificationStatus: 'approved' }), 'dismiss')).toThrow(expect.objectContaining({ code: 'conflict' }));
  });
});
