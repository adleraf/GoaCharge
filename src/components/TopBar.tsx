import { useState, useRef, useEffect } from 'react';
import type { GoaChargeStation } from '../types/station';

export type FilterType = 'all' | 'fast' | 'dc' | 'ac';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  stations: GoaChargeStation[];
  onSelectStation: (st: GoaChargeStation) => void;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  onToggleMobileMenu?: () => void;
}

export function TopBar({
  searchQuery,
  onSearchChange,
  stations,
  onSelectStation,
  activeFilter,
  onFilterChange,
  onToggleMobileMenu,
}: TopBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const filters: { id: FilterType; label: string; icon?: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'fast', label: 'Fast (≥50 kW)', icon: '⚡' },
    { id: 'dc', label: 'DC Only' },
    { id: 'ac', label: 'AC Only' },
  ];

  // Matching stations for the autocomplete dropdown
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const searchMatches = trimmedQuery
    ? stations.filter(
        (st) =>
          st.name.toLowerCase().includes(trimmedQuery) ||
          (st.town && st.town.toLowerCase().includes(trimmedQuery)) ||
          (st.addressLine1 && st.addressLine1.toLowerCase().includes(trimmedQuery))
      )
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (station: GoaChargeStation) => {
    onSelectStation(station);
    setIsDropdownOpen(false);
  };

  return (
    <div className="top-bar-overlay">
      <div className="top-bar-left">
        {/* Mobile menu trigger */}
        <button
          className="icon-button mobile-menu-toggle"
          onClick={onToggleMobileMenu}
          aria-label="Toggle station list"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        {/* Search Container */}
        <div className="search-wrapper" ref={searchContainerRef}>
          <div className="search-box">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-tertiary)"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search station or town (e.g. Verna, Vasco)..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.trim()) setIsDropdownOpen(true);
              }}
              aria-label="Search charging stations"
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => {
                  onSearchChange('');
                  setIsDropdownOpen(false);
                }}
                aria-label="Clear search query"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && trimmedQuery && (
            <div className="search-dropdown animate-fade-in-up" role="listbox">
              {searchMatches.length > 0 ? (
                searchMatches.map((st) => {
                  const maxPower = st.connections.reduce<number | null>(
                    (max, c) => (c.powerKW != null ? (max == null ? c.powerKW : Math.max(max, c.powerKW)) : max),
                    null
                  );

                  return (
                    <div
                      key={st.ocmId}
                      className="search-dropdown-item"
                      onClick={() => handleSelectResult(st)}
                      role="option"
                      tabIndex={0}
                      aria-selected="false"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSelectResult(st);
                      }}
                    >
                      <div className="item-main">
                        <span className="item-name">{st.name}</span>
                        <span className="item-town">📍 {st.town || 'Goa'}</span>
                      </div>
                      {maxPower && (
                        <span className="item-badge">{maxPower} kW</span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="search-dropdown-empty">
                  <span>No stations found matching <strong>"{searchQuery}"</strong> in Goa</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Real Data Filters */}
        <div className="filter-row" role="tablist" aria-label="Station filters">
          {filters.map((f) => (
            <button
              key={f.id}
              className={`filter-chip ${activeFilter === f.id ? 'active' : ''}`}
              onClick={() => onFilterChange(f.id)}
              role="tab"
              aria-selected={activeFilter === f.id}
            >
              {f.icon && <span>{f.icon}</span>}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right Controls */}
      <div className="top-bar-right">
        <div className="live-network-indicator" title="Connected to Open Charge Map API">
          <span className="live-dot"></span>
          <span className="live-text">Live API</span>
        </div>
      </div>
    </div>
  );
}
