import { Router, Request, Response } from "express";

const router = Router();

interface RouteQuery {
  originLat?: string;
  originLng?: string;
  destinationLat?: string;
  destinationLng?: string;
}

interface OsrmRouteResponse {
  code: string;
  message?: string;
  routes?: Array<{
    geometry: {
      type: "LineString";
      coordinates: [number, number][];
    };
    distance: number; // in meters
    duration: number; // in seconds
  }>;
}

/**
 * GET /api/route
 *
 * Query params:
 * - originLat: number
 * - originLng: number
 * - destinationLat: number
 * - destinationLng: number
 *
 * Calls OSRM (Open Source Routing Machine) or a configured provider
 * and returns GeoJSON LineString + distanceKm + durationMin.
 */
router.get("/", async (req: Request<{}, {}, {}, RouteQuery>, res: Response) => {
  const { originLat, originLng, destinationLat, destinationLng } = req.query;

  if (!originLat || !originLng || !destinationLat || !destinationLng) {
    res.status(400).json({
      error: "Missing required query parameters: originLat, originLng, destinationLat, destinationLng",
    });
    return;
  }

  const oLat = parseFloat(originLat);
  const oLng = parseFloat(originLng);
  const dLat = parseFloat(destinationLat);
  const dLng = parseFloat(destinationLng);

  if (
    Number.isNaN(oLat) ||
    Number.isNaN(oLng) ||
    Number.isNaN(dLat) ||
    Number.isNaN(dLng)
  ) {
    res.status(400).json({
      error: "Invalid coordinates provided. Must be valid finite numbers.",
    });
    return;
  }

  // Validate latitude [-90, 90] and longitude [-180, 180]
  if (
    oLat < -90 || oLat > 90 ||
    dLat < -90 || dLat > 90 ||
    oLng < -180 || oLng > 180 ||
    dLng < -180 || dLng > 180
  ) {
    res.status(400).json({
      error: "Coordinates out of bounds. Latitude must be between -90 and 90, longitude between -180 and 180.",
    });
    return;
  }

  try {
    // Construct OSRM driving route URL: coordinates are [longitude, latitude]
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson`;

    console.log(
      `[route] Requesting route: [${oLat}, ${oLng}] -> [${dLat}, ${dLng}]`
    );

    const response = await fetch(osrmUrl, {
      headers: {
        "User-Agent": "GoaCharge-App/1.0",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[route] Routing provider error (${response.status}):`, errText);
      res.status(502).json({
        error: "Routing provider returned an error",
        status: response.status,
      });
      return;
    }

    const data = (await response.json()) as OsrmRouteResponse;

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      console.warn("[route] No route found:", data.code, data.message);
      res.status(404).json({
        error: "No driving route could be found between these coordinates.",
        code: data.code,
      });
      return;
    }

    const primaryRoute = data.routes[0];
    const distanceKm = parseFloat((primaryRoute.distance / 1000).toFixed(1));
    const durationMin = Math.max(1, Math.round(primaryRoute.duration / 60));

    console.log(
      `[route] Route found: ${distanceKm} km, ~${durationMin} min, ${primaryRoute.geometry.coordinates.length} waypoints`
    );

    res.json({
      success: true,
      route: {
        distanceKm,
        durationMin,
        geometry: primaryRoute.geometry,
        origin: [oLng, oLat],
        destination: [dLng, dLat],
      },
    });
  } catch (err) {
    console.error("[route] Failed to fetch driving route:", err);
    res.status(502).json({ error: "Failed to connect to routing service" });
  }
});

export { router as routeRouter };
