/**
 * Client-side service to fetch EV charging stations from our backend proxy.
 * The backend reads the Open Charge Map API key from .env — it is never
 * sent to the browser.
 *
 * Data is returned as normalized GoaChargeStation objects, not raw OCM JSON.
 */

import type { GoaChargeStation, ChargersApiResponse } from "../types/station";

export type { GoaChargeStation, ChargersApiResponse };

interface FetchChargersOptions {
  latitude?: number;
  longitude?: number;
  distance?: number;
  maxresults?: number;
}

/**
 * Fetches EV charging stations from the GoaCharge backend proxy.
 * Defaults to the Goa map center (lat 15.35, lng 74.124, 50 km radius).
 *
 * Returns the full API response including metadata.
 */
export async function fetchChargers(
  options: FetchChargersOptions = {}
): Promise<ChargersApiResponse> {
  const params = new URLSearchParams();

  if (options.latitude !== undefined) {
    params.set("latitude", String(options.latitude));
  }
  if (options.longitude !== undefined) {
    params.set("longitude", String(options.longitude));
  }
  if (options.distance !== undefined) {
    params.set("distance", String(options.distance));
  }
  if (options.maxresults !== undefined) {
    params.set("maxresults", String(options.maxresults));
  }

  const queryString = params.toString();
  const url = `/api/chargers${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(
      errorBody?.error || `Failed to fetch chargers (HTTP ${response.status})`
    );
  }

  return response.json();
}
