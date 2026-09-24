export function BottomStats() {
  const stats = [
    { 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="12" height="20" rx="2" ry="2"></rect><circle cx="10" cy="10" r="2"></circle><path d="M16 8h2a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2h0"></path></svg>, 
      value: '147', 
      label: 'Charging Stations' 
    },
    { 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>, 
      value: '38', 
      label: 'Operators' 
    },
    { 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>, 
      value: '62', 
      label: 'Fast Chargers' 
    },
    { 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"></path><circle cx="12" cy="10" r="3"></circle></svg>, 
      value: '100%', 
      label: 'Goa Covered' 
    },
  ];

  return (
    <div className="bottom-stats-overlay">
      {stats.map((s, i) => (
        <div key={i} className="stat-card">
          <div className="stat-icon">{s.icon}</div>
          <div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
