import type { GoaChargeStation } from '../types/station';
import type { FilterType } from './TopBar';

interface BottomStatsProps {
  stations: GoaChargeStation[];
  activeFilter?: FilterType;
  onFilterChange?: (filter: FilterType) => void;
}

export function BottomStats({
  stations,
  activeFilter = 'all',
  onFilterChange,
}: BottomStatsProps) {
  // Derive real statistics from the provided stations dataset
  const totalStations = stations.length;

  const fastChargers = stations.filter((s) =>
    s.connections.some((c) => (c.powerKW != null && c.powerKW >= 50) || c.levelId === 3)
  ).length;

  const dcFastStations = stations.filter((s) =>
    s.connections.some((c) => c.currentTypeId === 30)
  ).length;

  const uniqueOperators = new Set(
    stations.map((s) => s.operatorId).filter((id) => id != null)
  ).size;

  const statItems = [
    {
      id: 'all' as FilterType,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="2" width="12" height="20" rx="2" ry="2"></rect>
          <circle cx="10" cy="10" r="2"></circle>
          <path d="M16 8h2a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2h0"></path>
        </svg>
      ),
      value: String(totalStations),
      label: 'Goa Stations',
      clickable: true,
      active: activeFilter === 'all',
      hint: 'Click to show all',
    },
    {
      id: 'fast' as FilterType,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      ),
      value: String(fastChargers),
      label: 'Fast Chargers (≥50 kW)',
      clickable: true,
      active: activeFilter === 'fast',
      hint: 'Filter fast chargers',
    },
    {
      id: 'dc' as FilterType,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      ),
      value: String(dcFastStations),
      label: 'DC Fast Points',
      clickable: true,
      active: activeFilter === 'dc',
      hint: 'Filter DC chargers',
    },
    {
      id: null,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
      value: String(uniqueOperators),
      label: 'Operators in Goa',
      clickable: false,
      active: false,
    },
  ];

  return (
    <div className="bottom-stats-overlay" role="region" aria-label="Goa network summary">
      {statItems.map((s, i) => (
        <div
          key={i}
          className={`stat-card ${s.clickable ? 'clickable' : ''} ${s.active ? 'active-filter' : ''}`}
          onClick={() => {
            if (s.clickable && s.id && onFilterChange) {
              onFilterChange(s.id);
            }
          }}
          tabIndex={s.clickable ? 0 : undefined}
          role={s.clickable ? 'button' : undefined}
          aria-pressed={s.active}
          onKeyDown={(e) => {
            if (s.clickable && s.id && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onFilterChange?.(s.id);
            }
          }}
          title={s.hint}
        >
          <div className="stat-icon">{s.icon}</div>
          <div className="stat-content">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
