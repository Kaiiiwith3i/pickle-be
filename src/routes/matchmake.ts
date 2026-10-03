/** Tickets 08 and 09. */
import { Router } from 'express';

import { TAU_LADDER } from '../config';
import { CALIBRATED_TAU, DEFAULT_CONFIG, formOpposingTeams, matchDoublesTeams, matchPlayers } from '../engine';
import type { DoublesCandidate, DoublesTeam, MatchCandidate } from '../engine';
import { db } from '../firebase';
import { ApiError, docId, handle } from '../http';
import { loadScoringData } from '../matching';

export const router = Router();

router.get(
  '/matchmake',
  handle(async (req, res) => {
    const tauParam = Number(req.query.tau);
    const tau = req.query.tau !== undefined && Number.isFinite(tauParam)
      ? Math.min(TAU_LADDER[TAU_LADDER.length - 1], Math.max(TAU_LADDER[0], tauParam))
      : CALIBRATED_TAU;

    const data = await loadScoringData(req.uid, [req.uid]);
    const seeker = data.scoringById.get(req.uid);
    if (!seeker) throw new ApiError('not_found', 'Complete onboarding before requesting matches');

    const result = matchPlayers(
      seeker,
      data.optedInIds.map((id) => data.scoringById.get(id)!),
      data.matrix,
      { ...DEFAULT_CONFIG, tau },
    );
    const toPublic = (c: MatchCandidate) => ({ ...c, profile: data.publicById.get(c.profile.id)! });
    res.json({ ...result, recommended: result.recommended.map(toPublic), scored: result.scored.map(toPublic) });
  }),
);

router.get(
  '/matchmake/doubles',
  handle(async (req, res) => {
    const mine = await db.collection('users').doc(req.uid).get();
    if (!mine.exists) throw new ApiError('not_found', 'Complete onboarding before requesting matches');
    const partnerId = typeof req.query.partnerId === 'string' && req.query.partnerId
      ? docId(req.query.partnerId, 'partnerId')
      : (mine.data()!.doublesPartnerId as string | undefined);
    if (!partnerId) throw new ApiError('invalid', 'Pick a doubles partner first (PUT /me/partner or ?partnerId=)');
    if (partnerId === req.uid) throw new ApiError('invalid', 'You cannot be your own partner');

    const data = await loadScoringData(req.uid, [req.uid, partnerId]);
    const seeker = data.scoringById.get(req.uid)!;
    const partner = data.scoringById.get(partnerId);
    if (!partner) throw new ApiError('not_found', 'No such player');

    const config = { ...DEFAULT_CONFIG, tau: CALIBRATED_TAU };
    const seekerTeam: DoublesTeam = { id: `team_${seeker.id}_${partner.id}`, player1: seeker, player2: partner };
    const candidates = formOpposingTeams(
      data.optedInIds.map((id) => data.scoringById.get(id)!),
      [seeker.id, partner.id],
      config,
    );
    const result = matchDoublesTeams(seekerTeam, candidates, data.matrix, config);

    const toPublic = (c: DoublesCandidate) => ({
      ...c,
      team: {
        ...c.team,
        player1: data.publicById.get(c.team.player1.id)!,
        player2: data.publicById.get(c.team.player2.id)!,
      },
    });
    res.json({ ...result, recommended: result.recommended.map(toPublic), scored: result.scored.map(toPublic) });
  }),
);
