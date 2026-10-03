import { Router } from 'express';

import { AREAS } from '../config';
import { CALAMBA_LOS_BANOS_BOUNDARY, haversineKm, inBoundary } from '../engine';
import { ApiError } from '../http';

export const router = Router();

const inRange = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;

/** Classifies a GPS fix: is it in the corridor, and which home area is nearest. */
router.post('/geo/resolve', (req, res) => {
  const { lat, lng } = req.body ?? {};
  if (!inRange(lat, 90) || !inRange(lng, 180)) throw new ApiError('invalid', 'lat and lng must be numbers in range');
  const point = { lat, lng };
  const inCorridor = inBoundary(point, CALAMBA_LOS_BANOS_BOUNDARY);
  const nearestArea = inCorridor
    ? AREAS.reduce((best, a) => (haversineKm(point, a) < haversineKm(point, best) ? a : best))
    : null;
  res.json({ inCorridor, nearestArea });
});
