/** Tickets 08 and 09. */
import { Router } from 'express';

import { TAU_LADDER } from '../config';
import { CALIBRATED_TAU, DEFAULT_CONFIG, matchPlayers } from '../engine';
import type { MatchCandidate } from '../engine';
import { ApiError, handle, notImplemented } from '../http';
import { loadScoringData } from '../matching';

export const router = Router();

router.get(
  '/matchmake',
  handle(async (req, res) => {
    const tauParam = Number(req.query.tau);
    const tau = req.query.tau !== undefined && Number.isFinite(tauParam)
      ? Math.min(TAU_LADDER[TAU_LADDER.length - 1], Math.max(TAU_LADDER[0], tauParam))
      : CALIBRATED_TAU;

    const data = await loadScoringData([req.uid]);
    const seeker = data.preciseById.get(req.uid);
    if (!seeker) throw new ApiError('not_found', 'Complete onboarding before requesting matches');

    const result = matchPlayers(
      seeker,
      data.optedInIds.map((id) => data.preciseById.get(id)!),
      data.matrix,
      { ...DEFAULT_CONFIG, tau },
    );
    const toPublic = (c: MatchCandidate) => ({ ...c, profile: data.publicById.get(c.profile.id)! });
    res.json({ ...result, recommended: result.recommended.map(toPublic), scored: result.scored.map(toPublic) });
  }),
);

router.get('/matchmake/doubles', notImplemented);
