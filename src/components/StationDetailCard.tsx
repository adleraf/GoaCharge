import type { GoaChargeStation } from "../types/station";

interface StationDetailCardProps {
  station: GoaChargeStation;
  onClose: () => void;
  onFocusOnMap: () => void;
}

/** Formats standard OCM connector type IDs into clean readable names */
function getConnectorTypeName(typeId: number | null): string {
  switch (typeId) {
    case 33:
      return "CCS-2 (DC)";
    case 25:
      return "Type 2 (AC)";
    case 1036:
      return "Type 2 Cable";
    case 2:
      return "CHAdeMO";
    case 28:
      return "GB/T (DC)";
    default:
      return typeId ? `Connector #${typeId}` : "Standard EV Plug";
  }
}

function getCurrentTypeName(currentTypeId: number | null): string {
  switch (currentTypeId) {
    case 30:
      return "DC Fast";
    case 20:
      return "AC 3-Phase";
    case 10:
      return "AC 1-Phase";
    default:
      return "";
  }
}

export function StationDetailCard({
  station,
  onClose,
  onFocusOnMap,
}: StationDetailCardProps) {
  // Compute max power available at this station
  const maxPower = station.connections.reduce<number | null>((max, c) => {
    if (c.powerKW == null) return max;
    return max == null ? c.powerKW : Math.max(max, c.powerKW);
  }, null);

  const fullAddress = [
    station.addressLine1,
    station.addressLine2,
    station.town,
    station.stateOrProvince,
    station.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  const formattedDate = station.dateLastVerified
    ? new Date(station.dateLastVerified).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="station-detail-panel animate-fade-in-up" role="dialog" aria-label="Station details">
      {/* Header */}
      <div className="station-detail-header">
        <div className="station-title-group">
          <div className="station-badge-row">
            {maxPower && (
              <span className="badge badge-power">
                ⚡ {maxPower} kW
              </span>
            )}
            {station.town && (
              <span className="badge badge-location">
                📍 {station.town}
              </span>
            )}
            {station.statusTypeId === 50 && (
              <span className="badge badge-status">
                Verified Operational
              </span>
            )}
          </div>
          <h2 className="station-detail-title">{station.name}</h2>
        </div>
        <button
          className="icon-button close-detail-btn"
          onClick={onClose}
          aria-label="Close detail panel"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="station-detail-body">
        {/* Location Section */}
        <div className="detail-section">
          <div className="section-label">Location & Address</div>
          <div className="detail-text">{fullAddress || "Address details not available"}</div>
          <div className="coordinates-row">
            <span className="coords">
              {station.latitude.toFixed(5)}° N, {station.longitude.toFixed(5)}° E
            </span>
            {station.distanceKM != null && (
              <span className="distance-tag">
                ~{station.distanceKM.toFixed(1)} km from center
              </span>
            )}
          </div>
        </div>

        {/* Connectors Section */}
        {station.connections.length > 0 && (
          <div className="detail-section">
            <div className="section-label">Connectors & Charging</div>
            <div className="connections-grid">
              {station.connections.map((c, i) => {
                const currentType = getCurrentTypeName(c.currentTypeId);
                return (
                  <div key={c.id || i} className="connection-card">
                    <div className="connection-type">
                      {getConnectorTypeName(c.connectionTypeId)}
                    </div>
                    <div className="connection-specs">
                      {c.powerKW && <span className="spec-item"><strong>{c.powerKW} kW</strong></span>}
                      {currentType && <span className="spec-item">{currentType}</span>}
                      {c.quantity && <span className="spec-item">{c.quantity} unit{c.quantity > 1 ? "s" : ""}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pricing & Usage */}
        <div className="detail-section detail-grid-two">
          <div>
            <div className="section-label">Pricing Rate</div>
            <div className="detail-value-highlight">
              {station.usageCost ? `₹ ${station.usageCost}` : "Rate not specified"}
            </div>
          </div>
          {station.numberOfPoints != null && (
            <div>
              <div className="section-label">Total Points</div>
              <div className="detail-value-highlight">
                {station.numberOfPoints} bay{station.numberOfPoints > 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>

        {/* Operator & Metadata */}
        <div className="detail-section meta-section">
          {station.operatorId != null && (
            <div className="meta-row">
              <span className="meta-label">Operator:</span>
              <span className="meta-val">OCM Operator #{station.operatorId}</span>
            </div>
          )}
          {formattedDate && (
            <div className="meta-row">
              <span className="meta-label">Last Verified:</span>
              <span className="meta-val">{formattedDate}</span>
            </div>
          )}
          <div className="meta-row">
            <span className="meta-label">Data Source:</span>
            <span className="meta-val source-badge">Open Charge Map (OCM #{station.ocmId})</span>
          </div>
        </div>

        {/* Transparency note */}
        <div className="transparency-callout">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span>Catalog data verified via Open Charge Map. Real-time bay occupancy is not provided by the public registry.</span>
        </div>
      </div>

      {/* Actions */}
      <div className="station-detail-actions">
        <button className="primary-action-btn" onClick={onFocusOnMap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 2v3m0 14v3M2 12h3m14 0h3"></path>
          </svg>
          View on Map
        </button>
        <a
          className="secondary-action-btn"
          href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
          Directions
        </a>
      </div>
    </div>
  );
}
