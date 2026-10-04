/**
 * Geographic utility functions for GoaCharge.
 *
 * Uses the Haversine formula to compute real-world distances
 * and find the nearest charging station from the existing dataset.
 */

import type { GoaChargeStation } from "../types/station";

const EARTH_RADIUS_KM = 6371;

/** Convert degrees to radians. */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine distance between two (lat, lng) points.
 * @returns Distance in kilometres.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Format a distance for display.
 * < 1 km  → "850 m"
 * >= 1 km → "3.2 km"
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

export interface NearestResult {
  station: GoaChargeStation;
  distanceKm: number;
}

/**
 * Find the single geographically nearest station to a given lat/lng.
 * Returns null if the stations array is empty.
 */
export function findNearestStation(
  userLat: number,
  userLng: number,
  stations: GoaChargeStation[]
): NearestResult | null {
  if (stations.length === 0) return null;

  let nearest: GoaChargeStation = stations[0];
  let minDist = haversineDistanceKm(userLat, userLng, nearest.latitude, nearest.longitude);

  for (let i = 1; i < stations.length; i++) {
    const d = haversineDistanceKm(userLat, userLng, stations[i].latitude, stations[i].longitude);
    if (d < minDist) {
      minDist = d;
      nearest = stations[i];
    }
  }

  return { station: nearest, distanceKm: minDist };
}
