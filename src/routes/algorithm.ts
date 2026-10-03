/** Tickets 08 and 11: why-this-match and the Algorithm Lab. */
import { Router } from 'express';

import {
  CALIBRATED_TAU,
  CONTENT_WEIGHTS,
  DEFAULT_CONFIG,
  distanceAgreement,
  effectiveRating,
  evaluateGate,
  formatAgreement,
  intentAgreement,
  scheduleAgreement,
  scorePair,
  sharedAvailability,
  skillAgreement,
} from '../engine';
import { ApiError, handle, notImplemented } from '../http';
import { loadScoringData } from '../matching';
import type { Explanation } from '../types';

export const router = Router();

router.get(
  '/algorithm/explain/:playerId',
  handle(async (req, res) => {
    const { playerId } = req.params;
    if (playerId === req.uid) throw new ApiError('invalid', 'Pick another player to explain');
    const data = await loadScoringData([req.uid]);
    const seeker = data.preciseById.get(req.uid);
    if (!seeker) throw new ApiError('not_found', 'Complete onboarding before requesting matches');
    const candidate = data.optedInIds.includes(playerId) ? data.preciseById.get(playerId) : undefined;
    if (!candidate) throw new ApiError('not_found', 'No such player');

    const gate = evaluateGate(seeker, candidate, DEFAULT_CONFIG);
    const s = scorePair(seeker, candidate, data.matrix, DEFAULT_CONFIG);
    const items = (id: string) => new Set(data.engagements.filter((e) => e.playerId === id).map((e) => e.itemId));
    const theirs = items(playerId);
    const body: Explanation = {
      gate,
      content: {
        skill: skillAgreement(Math.abs(effectiveRating(seeker) - effectiveRating(candidate))),
        schedule: scheduleAgreement(sharedAvailability(seeker.availability, candidate.availability).totalMinutes),
        distance: distanceAgreement(gate.distanceKm),
        intent: intentAgreement(seeker, candidate),
        format: formatAgreement(seeker, candidate),
        weights: { ...CONTENT_WEIGHTS },
        total: s.content,
      },
      cf: { similarity: s.cfSim, weight: s.cfW, sharedItems: [...items(req.uid)].filter((i) => theirs.has(i)).length },
      score: s.score,
      tau: CALIBRATED_TAU,
      recommended: gate.passed && s.score >= CALIBRATED_TAU,
    };
    res.json(body);
  }),
);

router.get('/algorithm/lab/:seekerId', notImplemented);
router.get('/algorithm/evaluation', notImplemented);
