/**
 * GoaCharge normalized charging-station data model.
 *
 * This is the application's internal representation of a charging station,
 * normalized from the Open Charge Map (OCM) API response. It intentionally
 * does NOT mirror OCM's structure — fields are flattened and renamed for
 * clarity within the GoaCharge domain.
 *
 * Fields OCM may not provide are typed as `T | null`.
 * We never invent values — if OCM omits a field, it stays null.
 */

// ─── Connection / Connector ────────────────────────────────────────────

export interface StationConnection {
  /** OCM connection ID */
  id: number;
  /** OCM connection type ID (e.g. 33 = CCS Type 2) */
  connectionTypeId: number | null;
  /** Power output in kilowatts */
  powerKW: number | null;
  /** Number of connectors of this type */
  quantity: number | null;
  /** OCM status type ID for this connection */
  statusTypeId: number | null;
  /** OCM charging level ID (1 = Level 1, 2 = Level 2, 3 = Level 3 / DC Fast) */
  levelId: number | null;
  /** OCM current type ID (10 = AC single phase, 20 = AC three phase, 30 = DC) */
  currentTypeId: number | null;
}

// ─── Station ───────────────────────────────────────────────────────────

export interface GoaChargeStation {
  /** OCM station ID — the external primary key */
  ocmId: number;
  /** OCM UUID */
  uuid: string;

  // ── Location ──────────────────────────────────────────────────────
  /** Human-readable station name (OCM AddressInfo.Title) */
  name: string;
  latitude: number;
  longitude: number;
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  stateOrProvince: string | null;
  postcode: string | null;
  /** Distance from query center in km (as returned by OCM) */
  distanceKM: number | null;

  // ── Operator ──────────────────────────────────────────────────────
  /** OCM operator ID */
  operatorId: number | null;

  // ── Charging ──────────────────────────────────────────────────────
  /** Connectors / plugs available at this station */
  connections: StationConnection[];
  /** Total number of charging points (OCM NumberOfPoints) */
  numberOfPoints: number | null;
  /** Usage cost as a free-text string from OCM */
  usageCost: string | null;
  /** OCM usage type ID (1 = public, 4 = private, etc.) */
  usageTypeId: number | null;

  // ── Status ────────────────────────────────────────────────────────
  /** OCM status type ID (e.g. 50 = Operational) */
  statusTypeId: number | null;

  // ── Provenance ────────────────────────────────────────────────────
  /** Data source attribution */
  source: "openchargemap";
  /** OCM data provider ID */
  dataProviderId: number;
  /** ISO timestamp — when OCM last verified this station */
  dateLastVerified: string | null;
  /** ISO timestamp — last status update in OCM */
  dateLastStatusUpdate: string | null;
  /** ISO timestamp — when the record was created in OCM */
  dateCreated: string | null;
}

// ─── API response wrapper ──────────────────────────────────────────────

export interface ChargersApiResponse {
  stations: GoaChargeStation[];
  /** Total stations returned after Goa filtering */
  count: number;
  /** Metadata about the query and source */
  meta: {
    source: "openchargemap";
    /** Number of raw results from OCM before Goa filtering */
    rawCount: number;
    /** Number of results filtered out (not in Goa) */
    filteredOut: number;
    /** ISO timestamp of when this response was generated */
    fetchedAt: string;
  };
}
