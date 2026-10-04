/**
 * NearestChargerCard — Compact floating card that shows the nearest
 * charging station to the user's current location.
 *
 * Displayed over the map when geolocation is active and a nearest
 * station has been computed.
 */

import type { GoaChargeStation } from "../types/station";
import { formatDistance } from "../utils/geoUtils";

interface NearestChargerCardProps {
  station: GoaChargeStation;
  distanceKm: number;
  onGoThere: () => void;
  onDismiss: () => void;
}

/** Human-readable status from OCM status type IDs. */
function statusLabel(statusTypeId: number | null): { text: string; color: string } {
  switch (statusTypeId) {
    case 50:
      return { text: "Operational", color: "#34d399" };
    case 100:
      return { text: "Not Operational", color: "#f87171" };
    case 150:
      return { text: "Planned", color: "#fbbf24" };
    case 210:
      return { text: "Temporarily Unavailable", color: "#fb923c" };
    default:
      return { text: "Unknown", color: "#94a3b8" };
  }
}

export function NearestChargerCard({
  station,
  distanceKm,
  onGoThere,
  onDismiss,
}: NearestChargerCardProps) {
  const maxPower = station.connections.reduce<number | null>(
    (max, c) =>
      c.powerKW != null ? (max == null ? c.powerKW : Math.max(max, c.powerKW)) : max,
    null
  );

  const status = statusLabel(station.statusTypeId);

  return (
    <div className="nearest-charger-card" role="region" aria-label="Nearest charger">
      {/* Header row */}
      <div className="nc-header">
        <div className="nc-icon-container">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <div className="nc-title-group">
          <span className="nc-label">Nearest Charger</span>
          <span className="nc-distance">{formatDistance(distanceKm)}</span>
        </div>
        <button
          className="nc-dismiss-btn"
          onClick={onDismiss}
          title="Dismiss"
          aria-label="Dismiss nearest charger card"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Station info */}
      <div className="nc-body">
        <h4 className="nc-station-name">{station.name}</h4>

        <div className="nc-info-row">
          {/* Power */}
          {maxPower != null && (
            <span className="nc-power-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              {maxPower} kW
            </span>
          )}

          {/* Status */}
          <span className="nc-status-badge" style={{ color: status.color }}>
            <span
              className="nc-status-dot"
              style={{ background: status.color, boxShadow: `0 0 6px ${status.color}` }}
            />
            {status.text}
          </span>
        </div>
      </div>

      {/* Action */}
      <button className="nc-go-there-btn" onClick={onGoThere}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
        Go There
      </button>
    </div>
  );
}
