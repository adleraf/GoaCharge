/**
 * Normalization layer: converts raw data-source responses into
 * GoaCharge's internal station model.
 *
 * Supported sources:
 *   - Open Charge Map (OCM) API
 *   - BEE Goa EV Public Charging Stations dataset
 *
 * Also provides:
 *   - Goa geographic filter (OCM stations)
 *   - Cross-source deduplication using geographic proximity,
 *     normalized operator names, and address similarity
 */

import type {
  GoaChargeStation,
  StationConnection,
  StationSourceRef,
} from "../src/types/station.js";

// ═══════════════════════════════════════════════════════════════════════
//  OCM raw types (compact=true, verbose=false)
// ═══════════════════════════════════════════════════════════════════════

/** Minimal type for the OCM compact response. Only fields we consume. */
interface OcmRawStation {
  ID: number;
  UUID: string;
  DataProviderID: number;
  OperatorID?: number | null;
  UsageTypeID?: number | null;
  UsageCost?: string | null;
  AddressInfo: {
    ID: number;
    Title: string;
    AddressLine1?: string | null;
    AddressLine2?: string | null;
    Town?: string | null;
    StateOrProvince?: string | null;
    Postcode?: string | null;
    CountryID: number;
    Latitude: number;
    Longitude: number;
    Distance?: number | null;
    DistanceUnit?: number | null;
  };
  Connections?: Array<{
    ID: number;
    ConnectionTypeID?: number | null;
    StatusTypeID?: number | null;
    LevelID?: number | null;
    PowerKW?: number | null;
    CurrentTypeID?: number | null;
    Quantity?: number | null;
  }> | null;
  NumberOfPoints?: number | null;
  StatusTypeID?: number | null;
  DateLastVerified?: string | null;
  DateLastStatusUpdate?: string | null;
  DateCreated?: string | null;
  IsRecentlyVerified?: boolean;
  DataQualityLevel?: number;
  SubmissionStatusTypeID?: number;
}

// ═══════════════════════════════════════════════════════════════════════
//  BEE raw types
// ═══════════════════════════════════════════════════════════════════════

export interface BeeRawStation {
  id: string;
  name: string;
  operator: string;
  ownership: string;
  district: string;
  cityOrVillage: string;
  address: string;
  latitude: number;
  longitude: number;
  connectorConfigurations: Array<{
    charger_connector: string;
    charger_rating: number;
    connector_rating: number;
    number_of_connectors: number;
  }>;
  source: string;
  sourcePages: number[];
  sourceRecordCount: number;
}

// ═══════════════════════════════════════════════════════════════════════
//  Goa bounding box
// ═══════════════════════════════════════════════════════════════════════

// Approximate bounding box for the state of Goa.
// This is a conservative rectangle — stations near borders may still be
// included if OCM reports their StateOrProvince as "Goa".
const GOA_BOUNDS = {
  latMin: 14.88,
  latMax: 15.82,
  lngMin: 73.68,
  lngMax: 74.35,
} as const;

/**
 * Determines whether an OCM station should be considered "in Goa".
 *
 * Strategy (ordered):
 * 1. If OCM provides StateOrProvince, check if it case-insensitively equals "Goa".
 * 2. As a fallback, check if the lat/lng falls within the Goa bounding box.
 */
function isInGoa(raw: OcmRawStation): boolean {
  const state = raw.AddressInfo.StateOrProvince?.trim().toLowerCase();

  // Explicit state match — most reliable
  if (state) {
    return state === "goa";
  }

  // Fallback: geographic bounding box
  const { Latitude: lat, Longitude: lng } = raw.AddressInfo;
  return (
    lat >= GOA_BOUNDS.latMin &&
    lat <= GOA_BOUNDS.latMax &&
    lng >= GOA_BOUNDS.lngMin &&
    lng <= GOA_BOUNDS.lngMax
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  OCM Normalization
// ═══════════════════════════════════════════════════════════════════════

function normalizeOcmConnection(raw: NonNullable<OcmRawStation["Connections"]>[number]): StationConnection {
  return {
    id: raw.ID,
    connectionTypeId: raw.ConnectionTypeID ?? null,
    powerKW: raw.PowerKW ?? null,
    quantity: raw.Quantity ?? null,
    statusTypeId: raw.StatusTypeID ?? null,
    levelId: raw.LevelID ?? null,
    currentTypeId: raw.CurrentTypeID ?? null,
  };
}

/**
 * Normalizes a single raw OCM station into the GoaCharge model.
 * Never invents values — missing OCM fields become null.
 */
function normalizeOcmStation(raw: OcmRawStation): GoaChargeStation {
  return {
    ocmId: raw.ID,
    uuid: raw.UUID,

    name: raw.AddressInfo.Title,
    latitude: raw.AddressInfo.Latitude,
    longitude: raw.AddressInfo.Longitude,
    addressLine1: raw.AddressInfo.AddressLine1 || null,
    addressLine2: raw.AddressInfo.AddressLine2 || null,
    town: raw.AddressInfo.Town || null,
    stateOrProvince: raw.AddressInfo.StateOrProvince || null,
    postcode: raw.AddressInfo.Postcode || null,
    distanceKM: raw.AddressInfo.Distance ?? null,

    operatorId: raw.OperatorID ?? null,

    connections: (raw.Connections ?? []).map(normalizeOcmConnection),
    numberOfPoints: raw.NumberOfPoints ?? null,
    usageCost: raw.UsageCost ?? null,
    usageTypeId: raw.UsageTypeID ?? null,

    statusTypeId: raw.StatusTypeID ?? null,

    source: "openchargemap",
    dataProviderId: raw.DataProviderID,
    dateLastVerified: raw.DateLastVerified ?? null,
    dateLastStatusUpdate: raw.DateLastStatusUpdate ?? null,
    dateCreated: raw.DateCreated ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  BEE Normalization
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generates a deterministic positive 32-bit integer from a string.
 * Used to create stable numeric IDs for BEE stations so they work
 * with the existing frontend that expects numeric `ocmId`.
 */
function stableHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  // Ensure positive and avoid collisions with likely OCM IDs (which are < 1M)
  return (Math.abs(hash) % 0x3FFFFFFF) + 1_000_000;
}

/**
 * Normalizes a BEE connector configuration into the GoaCharge model.
 * BEE connectors don't have OCM type IDs — we preserve the raw name
 * and set OCM-specific fields to null.
 */
function normalizeBeeConnection(
  raw: BeeRawStation["connectorConfigurations"][number],
  index: number
): StationConnection {
  const connectorName = raw.charger_connector.replace(/\n/g, " ").trim();

  // Attempt to infer current type from connector name
  let currentTypeId: number | null = null;
  const lower = connectorName.toLowerCase();
  if (lower.includes("dc") || lower.includes("ccs") || lower.includes("chademo") || lower.includes("gb/t")) {
    currentTypeId = 30; // DC
  } else if (lower.includes("ac") || lower.includes("type 2") || lower.includes("type-2")) {
    currentTypeId = 10; // AC (conservative: single-phase)
  }

  return {
    id: index + 1,
    connectionTypeId: null,
    powerKW: raw.connector_rating || null,
    quantity: raw.number_of_connectors || null,
    statusTypeId: null,
    levelId: null,
    currentTypeId,
    connectorTypeName: connectorName,
  };
}

/**
 * Extracts a town/locality from BEE address text.
 * Looks for the last recognizable place name before "Goa".
 */
function extractBeeLocality(address: string): string | null {
  // Clean up the address
  const cleaned = address.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

  // Try to extract from "City=X" pattern
  const cityMatch = cleaned.match(/City=([^,]+)/i);
  if (cityMatch) return cityMatch[1].trim();

  // Try to find a locality before "Goa" or a postcode
  const parts = cleaned.split(",").map((p) => p.trim());
  // Walk backwards to find a substantive place name
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]
      .replace(/goa\s*\d*/i, "")
      .replace(/\d{6}/, "")
      .trim();
    if (part.length > 2 && !/^\d+$/.test(part) && !/^(state|district)=/i.test(part)) {
      return part;
    }
  }
  return null;
}

/**
 * Extracts a postcode from BEE address text.
 */
function extractBeePostcode(address: string): string | null {
  const match = address.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

/**
 * Normalizes a single BEE station into the GoaCharge model.
 * Never invents values — BEE fields that don't exist become null.
 */
function normalizeBeeStation(raw: BeeRawStation): GoaChargeStation {
  const cleanAddress = raw.address.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const cleanName = raw.name.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

  const totalConnectors = raw.connectorConfigurations.reduce(
    (sum, c) => sum + (c.number_of_connectors || 0),
    0
  );

  return {
    ocmId: stableHash(raw.id),
    uuid: raw.id, // Use BEE ID as UUID equivalent

    name: cleanName,
    latitude: raw.latitude,
    longitude: raw.longitude,
    addressLine1: cleanAddress,
    addressLine2: null,
    town: extractBeeLocality(raw.address),
    stateOrProvince: "Goa",
    postcode: extractBeePostcode(raw.address),
    distanceKM: null,

    operatorId: null,
    operatorName: raw.operator || null,
    ownership: raw.ownership || null,
    district: raw.district || null,

    connections: raw.connectorConfigurations.map(normalizeBeeConnection),
    numberOfPoints: totalConnectors > 0 ? totalConnectors : null,
    usageCost: null,
    usageTypeId: null,

    statusTypeId: null,

    source: "bee",
    beeId: raw.id,
    dataProviderId: null,
    dateLastVerified: null,
    dateLastStatusUpdate: null,
    dateCreated: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  Deduplication
// ═══════════════════════════════════════════════════════════════════════

/** Haversine distance in meters between two lat/lng pairs */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Normalizes a string for fuzzy comparison:
 * lowercase, strip punctuation/diacritics, collapse whitespace.
 */
function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\n/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes a Jaccard-like token similarity between two strings.
 * Returns a value in [0, 1].
 */
function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeText(a).split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(normalizeText(b).split(" ").filter((t) => t.length > 2));
  if (tokensA.size === 0 && tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Known operator name aliases across OCM and BEE */
const OPERATOR_ALIASES: Record<string, string[]> = {
  ather: ["ather", "ather energy", "ather grid"],
  tata: ["tata", "tata power", "tata motors"],
  chargemod: ["chargemod"],
  statiq: ["statiq"],
  jio: ["jio", "jio-bp", "jio bp"],
  adani: ["adani", "adani total", "adani total energies"],
  glida: ["glida", "glida ev"],
  goec: ["goec", "goa energy", "goa electricity"],
  eesl: ["eesl"],
  bpcl: ["bpcl"],
  hpcl: ["hpcl"],
  iocl: ["iocl"],
  kazam: ["kazam"],
};

/**
 * Checks if two operator names likely refer to the same CPO.
 * Uses alias table and substring matching as fallback.
 */
function operatorsMatch(nameA: string | null | undefined, nameB: string | null | undefined): boolean {
  if (!nameA || !nameB) return false;
  const a = normalizeText(nameA);
  const b = normalizeText(nameB);
  if (a === b) return true;

  // Check alias groups
  for (const aliases of Object.values(OPERATOR_ALIASES)) {
    const aMatch = aliases.some((al) => a.includes(al));
    const bMatch = aliases.some((al) => b.includes(al));
    if (aMatch && bMatch) return true;
  }

  // Substring match (one contains the other)
  return a.includes(b) || b.includes(a);
}

/** Maximum distance in meters to consider two stations as potential duplicates */
const PROXIMITY_THRESHOLD_M = 100;

/** Minimum address token similarity for two nearby stations to be considered duplicates */
const ADDRESS_SIMILARITY_THRESHOLD = 0.2;

export interface DeduplicateResult {
  stations: GoaChargeStation[];
  duplicatesDetected: number;
  /** Array of [ocmStation, beeStation] pairs that were merged */
  mergedPairs: Array<{ ocmName: string; beeName: string; distanceM: number }>;
}

/**
 * Deduplicates stations across OCM and BEE sources.
 *
 * Strategy:
 * 1. For each BEE station, check all OCM stations for geographic proximity.
 * 2. If within PROXIMITY_THRESHOLD_M, check operator name match and address similarity.
 * 3. If matched, merge BEE metadata into the OCM station (which has richer data).
 * 4. Unmatched BEE stations are added as new entries.
 */
export function deduplicateStations(
  ocmStations: GoaChargeStation[],
  beeStations: GoaChargeStation[]
): DeduplicateResult {
  // Track which BEE stations have been matched
  const matchedBeeIndices = new Set<number>();
  const mergedPairs: DeduplicateResult["mergedPairs"] = [];

  // For each OCM station, try to find a matching BEE station
  const mergedOcm = ocmStations.map((ocm) => {
    let bestMatch: { index: number; distance: number; score: number } | null = null;

    for (let i = 0; i < beeStations.length; i++) {
      if (matchedBeeIndices.has(i)) continue;
      const bee = beeStations[i];

      // Step 1: Geographic proximity
      const dist = haversineMeters(ocm.latitude, ocm.longitude, bee.latitude, bee.longitude);
      if (dist > PROXIMITY_THRESHOLD_M) continue;

      // Step 2: Operator name check (if available on both sides)
      const ocmHasOperator = ocm.operatorName || ocm.operatorId;
      const beeHasOperator = bee.operatorName;
      const operatorCheckPassed =
        !ocmHasOperator || !beeHasOperator || operatorsMatch(ocm.operatorName, bee.operatorName);

      if (!operatorCheckPassed) continue;

      // Step 3: Address similarity
      const ocmAddr = [ocm.name, ocm.addressLine1, ocm.town].filter(Boolean).join(" ");
      const beeAddr = [bee.name, bee.addressLine1, bee.town].filter(Boolean).join(" ");
      const addrSim = tokenSimilarity(ocmAddr, beeAddr);

      // Within 100m and either operators match OR addresses are somewhat similar
      if (addrSim >= ADDRESS_SIMILARITY_THRESHOLD || operatorCheckPassed) {
        const score = (1 - dist / PROXIMITY_THRESHOLD_M) + addrSim;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { index: i, distance: dist, score };
        }
      }
    }

    if (bestMatch) {
      matchedBeeIndices.add(bestMatch.index);
      const bee = beeStations[bestMatch.index];

      mergedPairs.push({
        ocmName: ocm.name,
        beeName: bee.name,
        distanceM: Math.round(bestMatch.distance),
      });

      // Merge: OCM station is primary, enriched with BEE metadata
      const sources: StationSourceRef[] = [
        {
          source: "openchargemap",
          sourceId: String(ocm.ocmId),
          sourceLabel: `OCM #${ocm.ocmId}`,
        },
        {
          source: "bee",
          sourceId: bee.beeId || bee.uuid,
          sourceLabel: `BEE: ${bee.operatorName || "unknown"}`,
        },
      ];

      return {
        ...ocm,
        // Enrich with BEE data where OCM lacks it
        operatorName: ocm.operatorName || bee.operatorName,
        ownership: ocm.ownership || bee.ownership,
        district: ocm.district || bee.district,
        beeId: bee.beeId,
        sources,
      };
    }

    return ocm;
  });

  // Add unmatched BEE stations as new entries
  const unmatchedBee = beeStations.filter((_, i) => !matchedBeeIndices.has(i));

  return {
    stations: [...mergedOcm, ...unmatchedBee],
    duplicatesDetected: matchedBeeIndices.size,
    mergedPairs,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════════════════════════════

export interface NormalizeOcmResult {
  stations: GoaChargeStation[];
  rawCount: number;
  filteredOut: number;
}

/**
 * Takes the raw OCM API response array and returns normalized,
 * Goa-filtered GoaCharge stations.
 */
export function normalizeOcmResponse(rawStations: unknown): NormalizeOcmResult {
  if (!Array.isArray(rawStations)) {
    return { stations: [], rawCount: 0, filteredOut: 0 };
  }

  const rawCount = rawStations.length;
  const goaStations = (rawStations as OcmRawStation[])
    .filter(isInGoa)
    .map(normalizeOcmStation);

  return {
    stations: goaStations,
    rawCount,
    filteredOut: rawCount - goaStations.length,
  };
}

/**
 * Takes the raw BEE JSON array and returns normalized GoaCharge stations.
 */
export function normalizeBeeData(rawStations: BeeRawStation[]): GoaChargeStation[] {
  return rawStations.map(normalizeBeeStation);
}

