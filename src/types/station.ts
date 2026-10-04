/**
 * GoaCharge normalized charging-station data model.
 *
 * This is the application's internal representation of a charging station,
 * normalized from multiple data sources (Open Charge Map, BEE Goa dataset,
 * and potentially others in the future).
 *
 * Fields a source may not provide are typed as `T | null`.
 * We never invent values — if a source omits a field, it stays null.
 */

// ─── Connection / Connector ────────────────────────────────────────────

export interface StationConnection {
  /** Connection ID (OCM ID or auto-generated index for non-OCM sources) */
  id: number;
  /** OCM connection type ID (e.g. 33 = CCS Type 2) — null for non-OCM */
  connectionTypeId: number | null;
  /** Power output in kilowatts */
  powerKW: number | null;
  /** Number of connectors of this type */
  quantity: number | null;
  /** OCM status type ID for this connection — null for non-OCM */
  statusTypeId: number | null;
  /** OCM charging level ID (1 = Level 1, 2 = Level 2, 3 = Level 3 / DC Fast) — null for non-OCM */
  levelId: number | null;
  /** OCM current type ID (10 = AC single phase, 20 = AC three phase, 30 = DC) — null for non-OCM */
  currentTypeId: number | null;
  /** Human-readable connector type name (populated by BEE, null for OCM) */
  connectorTypeName?: string | null;
}

// ─── Source reference for merged stations ──────────────────────────────

export type StationSourceType = "openchargemap" | "bee";

export interface StationSourceRef {
  /** Which data source this reference comes from */
  source: StationSourceType;
  /** The original ID from that source (OCM numeric ID or BEE string ID) */
  sourceId: string;
  /** Human-readable source label */
  sourceLabel: string;
}

// ─── Station ───────────────────────────────────────────────────────────

export interface GoaChargeStation {
  /**
   * Stable numeric station ID used as the primary key in the frontend.
   * For OCM stations this is the OCM ID. For BEE-only stations this is
   * a deterministic hash of the BEE record ID.
   */
  ocmId: number;
  /** OCM UUID or generated UUID for non-OCM sources */
  uuid: string;

  // ── Location ──────────────────────────────────────────────────────
  /** Human-readable station name */
  name: string;
  latitude: number;
  longitude: number;
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  stateOrProvince: string | null;
  postcode: string | null;
  /** Distance from query center in km (as returned by OCM, null for BEE) */
  distanceKM: number | null;

  // ── Operator ──────────────────────────────────────────────────────
  /** OCM operator ID — null for BEE-only stations */
  operatorId: number | null;
  /** Human-readable operator / CPO name (populated by BEE, null for OCM-only) */
  operatorName?: string | null;
  /** Ownership type (e.g. "Private", "Government") — from BEE */
  ownership?: string | null;
  /** District — from BEE */
  district?: string | null;

  // ── Charging ──────────────────────────────────────────────────────
  /** Connectors / plugs available at this station */
  connections: StationConnection[];
  /** Total number of charging points */
  numberOfPoints: number | null;
  /** Usage cost as a free-text string */
  usageCost: string | null;
  /** OCM usage type ID (1 = public, 4 = private, etc.) — null for non-OCM */
  usageTypeId: number | null;

  // ── Status ────────────────────────────────────────────────────────
  /** OCM status type ID (e.g. 50 = Operational) — null for non-OCM */
  statusTypeId: number | null;

  // ── Provenance ────────────────────────────────────────────────────
  /** Primary data source attribution */
  source: StationSourceType;
  /** BEE record ID — present for stations sourced from BEE data */
  beeId?: string | null;
  /** OCM data provider ID — null for non-OCM sources */
  dataProviderId: number | null;
  /** ISO timestamp — when last verified (OCM) */
  dateLastVerified: string | null;
  /** ISO timestamp — last status update */
  dateLastStatusUpdate: string | null;
  /** ISO timestamp — when the record was created */
  dateCreated: string | null;

  /**
   * When a station has been matched across multiple sources,
   * this array lists all source references. Absent for single-source stations.
   */
  sources?: StationSourceRef[];
}

// ─── API response wrapper ──────────────────────────────────────────────

export interface ChargersApiResponse {
  stations: GoaChargeStation[];
  /** Total unique stations returned after deduplication */
  count: number;
  /** Metadata about the query and sources */
  meta: {
    /** Primary source identifier (kept for backward compat) */
    source: "combined";
    /** Per-source breakdown */
    ocm: {
      rawCount: number;
      filteredOut: number;
      goaCount: number;
    };
    bee: {
      totalRecords: number;
    };
    /** How many stations were detected as duplicates across sources */
    duplicatesDetected: number;
    /** ISO timestamp of when this response was generated */
    fetchedAt: string;
  };
}
