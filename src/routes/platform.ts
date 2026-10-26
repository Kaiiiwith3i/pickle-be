/** Platform routes: Leaderboard and Telemetry. */
import { Router } from 'express';

import { db } from '../firebase';
import { handle } from '../http';
import type { Court, LeaderboardEntry, PlatformTelemetry, Post, PublicPlayer } from '../types';

export const router = Router();

router.get(
  '/leaderboard',
  handle(async (_req, res) => {
    const [postsSnap, usersSnap] = await Promise.all([
      db.collection('posts').where('kind', '==', 'match_summary').get(),
      db.collection('users').get(),
    ]);

    const usersMap = new Map<string, PublicPlayer>();
    for (const doc of usersSnap.docs) {
      const u = doc.data() as PublicPlayer;
      if (!u.deactivated) {
        usersMap.set(doc.id, { ...u, id: doc.id });
      }
    }

    const stats = new Map<string, { wins: number; losses: number; matchesPlayed: number }>();
    const getStats = (id: string) => {
      let s = stats.get(id);
      if (!s) {
        s = { wins: 0, losses: 0, matchesPlayed: 0 };
        stats.set(id, s);
      }
      return s;
    };

    for (const doc of postsSnap.docs) {
      const p = doc.data() as Post;
      // Exclude sample records, unconfirmed, or disputed matches
      if (p.isSample || !p.confirmed || p.disputed) continue;
      if (!p.authorId || !p.opponentId || !p.winnerId) continue;

      const authorStats = getStats(p.authorId);
      const opponentStats = getStats(p.opponentId);

      authorStats.matchesPlayed += 1;
      opponentStats.matchesPlayed += 1;

      if (p.winnerId === p.authorId) {
        authorStats.wins += 1;
        opponentStats.losses += 1;
      } else if (p.winnerId === p.opponentId) {
        opponentStats.wins += 1;
        authorStats.losses += 1;
      }
    }

    const leaderboard: LeaderboardEntry[] = [];
    for (const [userId, userStats] of stats.entries()) {
      const user = usersMap.get(userId);
      if (!user) continue;
      const winRate = userStats.matchesPlayed > 0 ? userStats.wins / userStats.matchesPlayed : 0;
      leaderboard.push({
        userId,
        displayName: user.displayName,
        tier: user.tier,
        rating: user.rating,
        homeCourtId: user.homeCourtId,
        matchesPlayed: userStats.matchesPlayed,
        wins: userStats.wins,
        losses: userStats.losses,
        winRate: Math.round(winRate * 1000) / 1000,
      });
    }

    leaderboard.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
    res.json(leaderboard);
  }),
);

router.get(
  '/platform/telemetry',
  handle(async (_req, res) => {
    const [usersSnap, courtsSnap, postsSnap, sessionsSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('courts').get(),
      db.collection('posts').get(),
      db.collection('sessions').get(),
    ]);

    let totalPlayers = 0;
    for (const d of usersSnap.docs) {
      const data = d.data();
      if (!data.deactivated && !data.isSample) totalPlayers++;
    }

    let totalCourts = 0;
    let verifiedCourts = 0;
    let indoorCourts = 0;
    let outdoorCourts = 0;

    for (const d of courtsSnap.docs) {
      const c = d.data() as Court;
      if (c.isSample) continue;
      totalCourts++;
      if (c.verified) verifiedCourts++;
      if (c.indoor) indoorCourts++;
      else outdoorCourts++;
    }

    let totalMatches = 0;
    let confirmedMatches = 0;
    let disputedMatches = 0;

    for (const d of postsSnap.docs) {
      const p = d.data() as Post;
      if (p.isSample) continue;
      if (p.kind === 'match_summary') {
        totalMatches++;
        if (p.confirmed) confirmedMatches++;
        if (p.disputed) disputedMatches++;
      }
    }

    let totalSessions = 0;
    for (const d of sessionsSnap.docs) {
      const s = d.data();
      if (!s.isSample) totalSessions++;
    }

    const telemetry: PlatformTelemetry = {
      totalPlayers,
      totalCourts,
      verifiedCourts,
      indoorCourts,
      outdoorCourts,
      totalMatches,
      confirmedMatches,
      disputedMatches,
      totalSessions,
    };

    res.json(telemetry);
  }),
);
