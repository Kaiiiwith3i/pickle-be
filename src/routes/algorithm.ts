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
import { ApiError, docId, handle, requireRole } from '../http';
import { loadScoringData } from '../matching';
import type { Explanation } from '../types';

export const router = Router();

router.get(
  '/algorithm/explain/:playerId',
  handle(async (req, res) => {
    const playerId = docId(req.params.playerId, 'playerId');
    if (playerId === req.uid) throw new ApiError('invalid', 'Pick another player to explain');
    const data = await loadScoringData(req.uid, [req.uid]);
    const seeker = data.scoringById.get(req.uid);
    if (!seeker) throw new ApiError('not_found', 'Complete onboarding before requesting matches');
    const candidate = data.optedInIds.includes(playerId) ? data.scoringById.get(playerId) : undefined;
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

router.get(
  '/algorithm/lab/:seekerId',
  handle(async (req, res) => {
    requireRole(req, 'admin');
    const seekerId = docId(req.params.seekerId, 'seekerId');
    const data = await loadScoringData(req.uid, [seekerId]);
    const seeker = data.scoringById.get(seekerId);
    if (!seeker) throw new ApiError('not_found', 'No such player');

    const config = { ...DEFAULT_CONFIG, tau: CALIBRATED_TAU };
    const candidates = data.optedInIds
      .filter((id) => id !== seeker.id)
      .map((id) => {
        const candidate = data.scoringById.get(id)!;
        const s = scorePair(seeker, candidate, data.matrix, config);
        return {
          profile: data.publicById.get(id)!,
          gate: evaluateGate(seeker, candidate, config),
          contentScore: s.content,
          cfScore: s.cfSim ?? 0,
          cfWeight: s.cfW,
          score: s.score,
        };
      });
    res.json({ seeker: data.publicById.get(seeker.id)!, config, candidates });
  }),
);

// `require` (not fs) so esbuild inlines the harness output into the single-file bundle.
const evaluation = require('../../thesis-artifacts/evaluation-summary.json');
router.get('/algorithm/evaluation', (_req, res) => {
  res.json(evaluation);
});
