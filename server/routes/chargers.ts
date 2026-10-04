import { Router, Request, Response } from "express";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  normalizeOcmResponse,
  normalizeBeeData,
  deduplicateStations,
} from "../normalize.js";
import type { BeeRawStation } from "../normalize.js";
import type { ChargersApiResponse, GoaChargeStation } from "../../src/types/station.js";

const router = Router();

const OCM_BASE_URL = "https://api.openchargemap.io/v3/poi";

// ─── Load BEE dataset once at server startup ──────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BEE_JSON_PATH = path.resolve(__dirname, "..", "..", "public", "data", "bee-goa.json");

let beeStations: GoaChargeStation[] = [];
let beeRawCount = 0;

try {
  const raw = readFileSync(BEE_JSON_PATH, "utf-8");
  const beeRaw: BeeRawStation[] = JSON.parse(raw);
  beeRawCount = beeRaw.length;
  beeStations = normalizeBeeData(beeRaw);
  console.log(`[chargers] BEE dataset loaded: ${beeRawCount} records → ${beeStations.length} normalized stations`);
} catch (err) {
  console.error("[chargers] Failed to load BEE dataset:", err);
  // Non-fatal: the API will still serve OCM data
}

// ─── Route handler ────────────────────────────────────────────────────

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

  let ocmStations: GoaChargeStation[] = [];
  let ocmRawCount = 0;
  let ocmFilteredOut = 0;

  try {
    console.log(`[chargers] Fetching from OCM: lat=${latitude}, lng=${longitude}, dist=${distance}km`);

    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      console.error(`[chargers] OCM API error ${response.status}: ${text}`);
      // Non-fatal: continue with BEE data only
    } else {
      const rawData = await response.json();
      const normalized = normalizeOcmResponse(rawData);
      ocmStations = normalized.stations;
      ocmRawCount = normalized.rawCount;
      ocmFilteredOut = normalized.filteredOut;

      console.log(
        `[chargers] OCM returned ${ocmRawCount} stations, ` +
        `${ocmFilteredOut} filtered out (not in Goa), ` +
        `${ocmStations.length} Goa stations`
      );
    }
  } catch (err) {
    console.error("[chargers] OCM fetch failed:", err);
    // Non-fatal: continue with BEE data only
  }

  // Deduplicate across OCM and BEE
  const { stations, duplicatesDetected, mergedPairs } = deduplicateStations(
    ocmStations,
    beeStations
  );

  console.log(
    `[chargers] Combined: ${ocmStations.length} OCM + ${beeStations.length} BEE, ` +
    `${duplicatesDetected} duplicates detected, ` +
    `${stations.length} unique stations served`
  );

  if (mergedPairs.length > 0) {
    console.log(`[chargers] Merged pairs (sample up to 5):`);
    mergedPairs.slice(0, 5).forEach((p) => {
      console.log(`  OCM: "${p.ocmName}" ↔ BEE: "${p.beeName}" (${p.distanceM}m)`);
    });
  }

  const apiResponse: ChargersApiResponse = {
    stations,
    count: stations.length,
    meta: {
      source: "combined",
      ocm: {
        rawCount: ocmRawCount,
        filteredOut: ocmFilteredOut,
        goaCount: ocmStations.length,
      },
      bee: {
        totalRecords: beeRawCount,
      },
      duplicatesDetected,
      fetchedAt: new Date().toISOString(),
    },
  };

  res.json(apiResponse);
});

export { router as chargersRouter };

