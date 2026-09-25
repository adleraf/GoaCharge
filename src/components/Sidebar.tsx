import { Brand } from './Brand';
import type { GoaChargeStation } from '../types/station';

interface SidebarProps {
  stations: GoaChargeStation[];
  loading: boolean;
  selectedStationId: number | null;
  onSelectStation: (station: GoaChargeStation) => void;
  activeNavTab?: string;
  onNavTabChange?: (tab: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  stations,
  loading,
  selectedStationId,
  onSelectStation,
  activeNavTab = 'Map',
  onNavTabChange,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const navItems = [
    { label: 'Map', icon: 'map' },
    { label: 'Stations', icon: 'ev-station' },
    { label: 'Plan Route', icon: 'route' },
    { label: 'Analytics', icon: 'bar-chart' },
  ];

  return (
    <aside className={`sidebar ${isOpenMobile ? 'mobile-open' : ''}`}>
      {/* Mobile close button */}
      {isOpenMobile && (
        <button
          className="icon-button mobile-close-sidebar"
          onClick={onCloseMobile}
          aria-label="Close menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}

      {/* Brand Header */}
      <div className="sidebar-brand-wrapper">
        <Brand />
      </div>

      {/* Main Nav Tabs */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`nav-item ${activeNavTab === item.label ? 'active' : ''}`}
            onClick={() => onNavTabChange?.(item.label)}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Station Discovery List */}
      <div className="sidebar-station-list-container">
        <div className="station-list-header">
          <span className="station-list-title">EV Charging Points</span>
          <span className="station-count-pill">{loading ? '...' : stations.length}</span>
        </div>

        <div className="station-scroll-list">
          {loading ? (
            /* Skeleton Loading State */
            <div className="station-skeleton-group">
              {[1, 2, 3].map((i) => (
                <div key={i} className="station-skeleton-card">
                  <div className="skeleton-line title-line"></div>
                  <div className="skeleton-line text-line"></div>
                  <div className="skeleton-line tag-line"></div>
                </div>
              ))}
            </div>
          ) : stations.length === 0 ? (
            /* Empty State */
            <div className="sidebar-empty-state">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <div className="empty-title">No stations found</div>
              <div className="empty-subtitle">Try adjusting your search query or active filter.</div>
            </div>
          ) : (
            /* Station Cards */
            stations.map((st) => {
              const isSelected = selectedStationId === st.ocmId;
              const maxPower = st.connections.reduce<number | null>(
                (max, c) => (c.powerKW != null ? (max == null ? c.powerKW : Math.max(max, c.powerKW)) : max),
                null
              );

              return (
                <div
                  key={st.ocmId}
                  className={`station-sidebar-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectStation(st)}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectStation(st);
                    }
                  }}
                >
                  <div className="card-top-row">
                    <h3 className="card-station-name">{st.name}</h3>
                    {maxPower && (
                      <span className="card-power-badge">{maxPower} kW</span>
                    )}
                  </div>

                  <div className="card-location-row">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
                      <circle cx="12" cy="9" r="2.5"></circle>
                    </svg>
                    <span>{st.town || 'Goa'}</span>
                    {st.distanceKM != null && (
                      <span className="card-dist">· {st.distanceKM.toFixed(1)} km</span>
                    )}
                  </div>

                  <div className="card-footer-row">
                    <span className="card-connectors">
                      {st.connections.length > 0
                        ? `${st.connections.length} connector${st.connections.length > 1 ? 's' : ''}`
                        : 'Standard plug'}
                    </span>
                    {st.statusTypeId === 50 && (
                      <span className="card-status-dot" title="Operational in OCM directory">
                        <span className="dot-pulse"></span>
                        Operational
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer message */}
      <div className="sidebar-footer">
        <div className="footer-greener">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path>
            <path d="M12 6v6l4 2"></path>
          </svg>
          A Greener
        </div>
        <div className="footer-subtext">Goa is a Happier Goa</div>
      </div>
    </aside>
  );
}

function NavIcon({ name }: { name: string }) {
  switch (name) {
    case 'map':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
          <line x1="8" y1="2" x2="8" y2="18"></line>
          <line x1="16" y1="6" x2="16" y2="22"></line>
        </svg>
      );
    case 'ev-station':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="2" width="12" height="20" rx="2" ry="2"></rect>
          <circle cx="10" cy="10" r="2"></circle>
          <path d="M16 8h2a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2h0"></path>
        </svg>
      );
    case 'route':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="5" r="3"></circle>
          <line x1="12" y1="22" x2="12" y2="8"></line>
          <path d="M5 12H2a10 10 0 0 0 20 0h-3"></path>
        </svg>
      );
    case 'bar-chart':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
      );
    default:
      return <svg />;
  }
}
