import type { BoundaryRegion, GeoPoint } from './types';

/** Mean Earth radius (IUGG), km. */
export const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two WGS-84 points via the Haversine formula
 * (Sinnott, 1984). Numerically stable for the short distances in the corridor.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when the point lies inside at least one boundary region. */
export function inBoundary(point: GeoPoint, boundary: BoundaryRegion[]): boolean {
  return boundary.some((r) => haversineKm(point, r.center) <= r.radiusKm);
}

/** Default operational corridor: Calamba and Los Baños anchor regions. */
export const CALAMBA_LOS_BANOS_BOUNDARY: BoundaryRegion[] = [
  { center: { lat: 14.2117, lng: 121.1653 }, radiusKm: 12 }, // Calamba
  { center: { lat: 14.1699, lng: 121.2441 }, radiusKm: 10 }, // Los Baños
];
