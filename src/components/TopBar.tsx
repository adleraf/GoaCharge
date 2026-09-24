export function TopBar() {
  const filters = [
    { label: 'All', active: true },
    { label: 'Fast' },
    { label: 'Ultra-fast', icon: '⚡' },
    { label: 'Type ▾' },
    { label: 'Operator ▾' },
    { label: 'Near me', icon: '📍' }
  ];

  return (
    <div className="top-bar-overlay">
      <div className="top-bar-left">
        {/* Search */}
        <div className="search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" placeholder="Search locations, stations, or routes..." />
        </div>
        
        {/* Filters */}
        <div className="filter-row">
          {filters.map((f, i) => (
            <button key={i} className={`filter-chip ${f.active ? 'active' : ''}`}>
              {f.icon && <span>{f.icon}</span>}
              {f.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Right Controls */}
      <div className="top-bar-right">
        <button className="icon-button" aria-label="Toggle theme">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>
        <button className="icon-button" style={{ background: 'var(--accent-teal)', color: '#000', fontWeight: 'bold' }}>
          A
        </button>
      </div>
    </div>
  );
}
