interface RoutePanelProps {
  stationName: string;
  distanceKm: number;
  durationMin: number;
  isNavigating: boolean;
  onToggleNavigation: () => void;
  onClearRoute: () => void;
  onRecenterRoute: () => void;
}

export function RoutePanel({
  stationName,
  distanceKm,
  durationMin,
  isNavigating,
  onToggleNavigation,
  onClearRoute,
  onRecenterRoute,
}: RoutePanelProps) {
  return (
    <div
      className={`route-preview-panel animate-fade-in-up ${
        isNavigating ? "navigation-active" : ""
      }`}
      role="region"
      aria-label="Route information"
    >
      {/* Header with status badge */}
      <div className="route-panel-header">
        <div className="route-header-badge">
          <span className="route-pulse-dot"></span>
          <span className="route-header-title">
            {isNavigating ? "Active Navigation Preview" : "Route Preview"}
          </span>
        </div>
        <button
          className="route-icon-btn close-route-btn"
          onClick={onClearRoute}
          aria-label="Clear route"
          title="Clear route"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Main Route Info */}
      <div className="route-panel-body">
        <div className="route-destination-group">
          <div className="destination-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
              <circle cx="12" cy="9" r="2.5"></circle>
            </svg>
          </div>
          <div className="destination-meta">
            <span className="destination-label">Destination</span>
            <span className="destination-name">{stationName}</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="route-metrics-grid">
          <div className="route-metric-card">
            <span className="metric-label">Distance</span>
            <span className="metric-val">{distanceKm.toFixed(1)} km</span>
          </div>
          <div className="route-metric-card">
            <span className="metric-label">Estimated Time</span>
            <span className="metric-val">{durationMin} min</span>
          </div>
        </div>

        {isNavigating && (
          <div className="nav-preview-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>Navigation preview active. Camera focused on driving path.</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="route-panel-actions">
        <button
          className={`route-action-btn primary ${isNavigating ? "active" : ""}`}
          onClick={onToggleNavigation}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
          {isNavigating ? "Exit Navigation" : "Start Navigation"}
        </button>

        <button
          className="route-action-btn secondary"
          onClick={onRecenterRoute}
          title="Fit route in map view"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Fit Route
        </button>

        <button
          className="route-action-btn danger"
          onClick={onClearRoute}
        >
          Clear Route
        </button>
      </div>
    </div>
  );
}
