import { Router, Request, Response } from "express";
import { normalizeOcmResponse } from "../normalize.js";
import type { ChargersApiResponse } from "../../src/types/station.js";

const router = Router();

const OCM_BASE_URL = "https://api.openchargemap.io/v3/poi";

interface ChargerQuery {
  latitude?: string;
  longitude?: string;
  distance?: string;
  maxresults?: string;
}

router.get("/", async (req: Request<{}, {}, {}, ChargerQuery>, res: Response) => {
  const apiKey = process.env.OPEN_CHARGE_MAP_API_KEY;

  if (!apiKey) {
    console.error("[chargers] OPEN_CHARGE_MAP_API_KEY is not set in .env");
    res.status(500).json({ error: "Server misconfiguration: API key not found." });
    return;
  }

  // Use the GoaMap center as defaults (matching GoaMap.tsx center: [74.124, 15.35])
  const latitude = req.query.latitude || "15.35";
  const longitude = req.query.longitude || "74.124";
  const distance = req.query.distance || "50";
  const maxresults = req.query.maxresults || "100";

  const params = new URLSearchParams({
    key: apiKey,
    latitude,
    longitude,
    distance,
    distanceunit: "KM",
    countrycode: "IN",
    maxresults,
    compact: "true",
    verbose: "false",
  });

  const url = `${OCM_BASE_URL}?${params.toString()}`;

  try {
    console.log(`[chargers] Fetching from OCM: lat=${latitude}, lng=${longitude}, dist=${distance}km`);

    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      console.error(`[chargers] OCM API error ${response.status}: ${text}`);
      res.status(response.status).json({
        error: "Open Charge Map API error",
        status: response.status,
        detail: text,
      });
      return;
    }

    const rawData = await response.json();
    const { stations, rawCount, filteredOut } = normalizeOcmResponse(rawData);

    console.log(
      `[chargers] OCM returned ${rawCount} stations, ` +
      `${filteredOut} filtered out (not in Goa), ` +
      `${stations.length} Goa stations served`
    );

    const apiResponse: ChargersApiResponse = {
      stations,
      count: stations.length,
      meta: {
        source: "openchargemap",
        rawCount,
        filteredOut,
        fetchedAt: new Date().toISOString(),
      },
    };

    res.json(apiResponse);
  } catch (err) {
    console.error("[chargers] Fetch failed:", err);
    res.status(502).json({ error: "Failed to reach Open Charge Map API" });
  }
});

export { router as chargersRouter };
