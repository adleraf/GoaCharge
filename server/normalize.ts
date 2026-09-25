/**
 * Normalization layer: converts raw Open Charge Map (OCM) API responses
 * into GoaCharge's internal station model.
 *
 * Also provides the Goa geographic filter so we only return stations
 * that are actually within the state of Goa.
 */

import type { GoaChargeStation, StationConnection } from "../src/types/station.js";

// ─── OCM raw types (compact=true, verbose=false) ──────────────────────

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

// ─── Goa bounding box ─────────────────────────────────────────────────
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

// ─── Normalization ────────────────────────────────────────────────────

function normalizeConnection(raw: NonNullable<OcmRawStation["Connections"]>[number]): StationConnection {
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
function normalizeStation(raw: OcmRawStation): GoaChargeStation {
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

    connections: (raw.Connections ?? []).map(normalizeConnection),
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

// ─── Public API ───────────────────────────────────────────────────────

export interface NormalizeResult {
  stations: GoaChargeStation[];
  rawCount: number;
  filteredOut: number;
}

/**
 * Takes the raw OCM API response array and returns normalized,
 * Goa-filtered GoaCharge stations.
 */
export function normalizeOcmResponse(rawStations: unknown): NormalizeResult {
  if (!Array.isArray(rawStations)) {
    return { stations: [], rawCount: 0, filteredOut: 0 };
  }

  const rawCount = rawStations.length;
  const goaStations = (rawStations as OcmRawStation[])
    .filter(isInGoa)
    .map(normalizeStation);

  return {
    stations: goaStations,
    rawCount,
    filteredOut: rawCount - goaStations.length,
  };
}
