/**
 * Client service for driving route calculation and browser geolocation.
 * Proxies through Express `/api/route`.
 */

export interface RouteData {
  distanceKm: number;
  durationMin: number;
  geometry: {
    type: "LineString";
    coordinates: [number, number][]; // [lng, lat]
  };
  origin: [number, number]; // [lng, lat]
  destination: [number, number]; // [lng, lat]
}

interface ApiRouteResponse {
  success: boolean;
  route: RouteData;
  error?: string;
}

/**
 * Requests the user's current GPS position via the browser Geolocation API.
 * Returns [longitude, latitude] in MapLibre coordinate order.
 */
export function getUserLocation(): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        resolve([longitude, latitude]);
      },
      (error) => {
        let message = "Unable to determine your location.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message =
              "Location permission denied. Please allow location access in your browser to preview the driving route.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location information is unavailable on your device.";
            break;
          case error.TIMEOUT:
            message = "Location request timed out. Please try again.";
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * Fetches a driving route from the Express backend proxy.
 *
 * @param origin [longitude, latitude]
 * @param destination [longitude, latitude]
 */
export async function fetchDrivingRoute(
  origin: [number, number],
  destination: [number, number]
): Promise<RouteData> {
  const [oLng, oLat] = origin;
  const [dLng, dLat] = destination;

  const params = new URLSearchParams({
    originLat: String(oLat),
    originLng: String(oLng),
    destinationLat: String(dLat),
    destinationLng: String(dLng),
  });

  const response = await fetch(`/api/route?${params.toString()}`);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(
      errorBody?.error || `Failed to calculate route (HTTP ${response.status})`
    );
  }

  const data = (await response.json()) as ApiRouteResponse;

  if (!data.success || !data.route) {
    throw new Error(data.error || "No route found to destination.");
  }

  return data.route;
}
