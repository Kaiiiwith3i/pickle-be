/**
 * Sample players, sessions and posts, ported from the monolith's seed. Everything is labelled `isSample`,
 * ids are prefixed `sample-`, and dates are relative to the seed time so the data never goes stale.
 */
import { AREAS } from '../config';
import type { AppUser, AvailabilityWindow, OpenPlaySession, Post } from '../types';

const id = (s: string) => `sample-${s}`;
const W = (day: number, startMin: number, endMin: number): AvailabilityWindow => ({ day: day as AvailabilityWindow['day'], startMin, endMin });
const EVENINGS = [W(1, 1080, 1260), W(3, 1080, 1260), W(5, 1080, 1320)];
const WEEKEND_AM = [W(6, 360, 600), W(0, 360, 600)];
const WEEKEND_PM = [W(6, 960, 1200), W(0, 900, 1140)];
const MORNINGS = [W(2, 360, 540), W(4, 360, 540), ...WEEKEND_AM];

type Row = [string, string, AppUser['tier'], number, string, AvailabilityWindow[], AppUser['format'], AppUser['intent'], string | undefined, string];
// [key, name, tier, rating, area label, availability, format, intent, bio, home court]
const PLAYERS: Row[] = [
  ['marco', 'Marco Villanueva', 'intermediate', 3.25, 'Halang, Calamba', EVENINGS.concat(WEEKEND_AM), 'doubles', 'competitive', 'Weeknight grinder. DUPR curious.', 'court-halang'],
  ['liza', 'Liza Ramos', 'intermediate', 3.5, 'Real, Calamba', EVENINGS.concat(WEEKEND_PM), 'both', 'both', 'Happy to drill or play games.', 'court-halang'],
  ['jomar', 'Jomar Dizon', 'beginner', 2.5, 'Mayapa, Calamba', WEEKEND_AM.concat(WEEKEND_PM), 'doubles', 'casual', 'Started March 2026. Loves open play.', 'court-mayapa'],
  ['ana', 'Ana Katrina Lim', 'advanced', 4.25, 'Batong Malake, Los Baños', EVENINGS.concat(WEEKEND_AM), 'both', 'competitive', 'Ex-varsity tennis. Tournament-bound.', 'court-lb-sports'],
  ['paolo', 'Paolo Mercado', 'beginner', 2.25, 'Pansol, Calamba', WEEKEND_AM, 'doubles', 'casual', undefined, 'court-pansol'],
  ['grace', 'Grace Salvador', 'intermediate', 3.0, 'Anos, Los Baños', MORNINGS, 'doubles', 'casual', 'Morning player, retired teacher.', 'court-anos'],
  ['dennis', 'Dennis Aquino', 'advanced', 4.0, 'Canlubang, Calamba', EVENINGS, 'singles', 'competitive', undefined, 'court-canlubang'],
  ['mika', 'Mika Fernandez', 'intermediate', 3.25, 'UPLB, Los Baños', MORNINGS.concat(EVENINGS), 'both', 'both', 'Grad student, flexible sched.', 'court-uplb'],
  ['ramon', 'Ramon Bautista', 'beginner', 2.75, 'Halang, Calamba', WEEKEND_PM, 'doubles', 'casual', undefined, 'court-halang'],
  ['cheska', 'Cheska Uy', 'intermediate', 3.5, 'Real, Calamba', EVENINGS.concat(WEEKEND_AM), 'doubles', 'competitive', undefined, 'court-halang'],
  ['bong', 'Bong Reyes', 'advanced', 4.5, 'Batong Malake, Los Baños', WEEKEND_AM.concat(EVENINGS), 'both', 'competitive', 'Happy to coach 3.0s before games.', 'court-lb-sports'],
  ['tina', 'Tina Manalo', 'beginner', 2.0, 'Mayapa, Calamba', WEEKEND_AM, 'doubles', 'casual', 'First paddle bought last week!', 'court-mayapa'],
];

/** Public profiles only; sample players have no email, phone or sign-in account. */
export function samplePlayers(now: Date): AppUser[] {
  return PLAYERS.map(([key, displayName, tier, rating, areaLabel, availability, format, intent, bio, court], i) => {
    const area = AREAS.find((a) => a.label === areaLabel)!;
    return {
      id: id(key),
      displayName,
      username: key,
      tier,
      rating,
      location: { lat: area.lat, lng: area.lng },
      areaLabel,
      availability,
      format,
      intent,
      matchmakingOptIn: true,
      bio,
      homeCourtId: id(court),
      communityRole: 'player',
      joinedAt: new Date(now.getTime() - (30 + i * 3) * 86_400_000).toISOString(),
      onboarded: true,
      role: 'player',
      isSample: true,
    };
  });
}

/** `days` from `now` (negative = past) at `hourPHT` o'clock Philippine time. */
function at(now: Date, days: number, hourPHT: number): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hourPHT - 8, 0, 0, 0);
  return d.toISOString();
}

export function sampleSessions(now: Date): OpenPlaySession[] {
  const s = (key: string, court: string, host: string, title: string, day: number, hour: number, durationMin: number, capacity: number, attendees: string[], tierRestriction: OpenPlaySession['tierRestriction'], notes: string, paymentInstructions?: string): OpenPlaySession => ({
    id: id(key), courtId: id(court), hostId: id(host), title, startsAt: at(now, day, hour), durationMin, capacity,
    attendeeIds: attendees.map(id), tierRestriction, notes, paymentInstructions, isSample: true,
  });
  return [
    s('halang-night', 'court-halang', 'marco', 'Halang Night OpenPlay', 1, 18, 180, 12, ['marco', 'liza', 'cheska', 'ramon'], ['beginner', 'intermediate'], 'Round-robin rotation every 11 points.'),
    s('lb-sunrise', 'court-lb-sports', 'ana', 'Saturday Sunrise Games', 2, 6, 240, 16, ['ana', 'bong', 'mika', 'grace', 'dennis'], null, 'All levels.'),
    s('mayapa-clinic', 'court-mayapa', 'jomar', 'Beginners Clinic + Play', 2, 8, 120, 8, ['jomar', 'tina', 'paolo'], ['beginner'], 'First 30 mins: dinking drills. Bring water!'),
    s('canlubang-ladder', 'court-canlubang', 'dennis', 'Competitive Sunday Ladder', 3, 16, 180, 12, ['dennis', 'bong', 'ana'], ['intermediate', 'advanced'], 'Ladder format, winners stay.'),
    s('uplb-rally', 'court-uplb', 'mika', 'Midweek Morning Rally', 5, 7, 120, 8, ['mika', 'grace'], null, 'Student-friendly rates.'),
  ];
}

export function samplePosts(now: Date): Post[] {
  const post = (key: string, author: string, body: string, day: number, hour: number, likedBy: string[]): Post => ({
    id: id(key), authorId: id(author), body, createdAt: at(now, day, hour), likedBy: likedBy.map(id), kind: 'post', isSample: true,
  });
  const match = (key: string, author: string, opponent: string, winner: string, court: string, scoreLine: string, body: string, day: number, hour: number, likedBy: string[], state: 'approved' | 'pending' | 'rejected'): Post => ({
    ...post(key, author, body, day, hour, likedBy),
    kind: 'match_summary', scoreLine, opponentId: id(opponent), winnerId: id(winner), courtId: id(court),
    confirmed: state === 'approved', ...(state === 'rejected' ? { disputed: true } : {}), verificationStatus: state,
  });
  return [
    post('p1', 'ana', 'Huge turnout at LB Sports Complex this morning: 18 players across 4 courts. See you all Saturday!', -1, 10, ['bong', 'mika', 'liza', 'marco', 'grace']),
    post('p3', 'tina', 'Complete beginner here from Mayapa. Is the Saturday clinic okay for someone who has never played?', 0, 1, ['jomar', 'grace', 'paolo']),
    post('p4', 'dennis', 'Canlubang Sports Hub just resurfaced courts 1-2 with cushioned acrylic. Night games feel great now.', -2, 19, ['bong', 'ana', 'marco']),
    post('p5', 'grace', 'Morning crew at Anos keeps growing: 3 full courts of retirees and students playing together.', -3, 8, ['mika', 'tina']),
    match('m2', 'marco', 'liza', 'marco', 'court-halang', '11-8, 9-11, 11-7', 'Great 3-set battle with Liza at Halang!', -1, 20, ['cheska', 'liza'], 'approved'),
    match('m6', 'ana', 'dennis', 'ana', 'court-canlubang', '11-9, 11-8', 'Competitive singles drill with Dennis under the lights.', -3, 21, ['bong', 'dennis', 'mika'], 'approved'),
    match('m7', 'jomar', 'bong', 'jomar', 'court-mayapa', '11-6, 11-9', 'Quick singles at Mayapa, backhand was on fire today!', 0, 2, [], 'pending'),
    match('m8', 'dennis', 'paolo', 'dennis', 'court-uplb', '11-8, 8-11, 11-9', 'Singles showdown at Copeland Gym, intense third set!', -1, 5, [], 'rejected'),
    match('m9', 'dennis', 'marco', 'dennis', 'court-canlubang', '11-7, 11-8', 'Solid 2-set match vs Marco at Canlubang.', -4, 18, ['marco', 'ana'], 'approved'),
    match('m10', 'liza', 'cheska', 'liza', 'court-halang', '11-9, 11-6', 'Friendly rally session and match with Cheska at Halang.', -2, 19, ['cheska', 'marco'], 'approved'),
    match('m11', 'jomar', 'ramon', 'jomar', 'court-mayapa', '11-8, 11-9', 'Mayapa morning singles vs Ramon.', -1, 9, ['ramon', 'tina'], 'approved'),
    match('m12', 'bong', 'paolo', 'bong', 'court-lb-sports', '11-5, 11-4', 'Weekend singles at LB Sports Complex with Paolo.', -2, 10, ['ana', 'paolo'], 'approved'),
    match('m13', 'grace', 'paolo', 'grace', 'court-anos', '11-7, 11-9', 'Morning singles drill at Anos Community Court!', -3, 8, ['mika', 'paolo'], 'approved'),
  ];
}
