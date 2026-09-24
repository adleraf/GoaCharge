import { Brand } from './Brand';

export function Sidebar() {
  const navItems = [
    { label: 'Map', icon: 'map', active: true },
    { label: 'Stations', icon: 'ev-station' },
    { label: 'Plan Route', icon: 'route' },
    { label: 'Analytics', icon: 'bar-chart' },
    { label: 'Saved', icon: 'heart' },
    { label: 'Profile', icon: 'user' },
  ];

  return (
    <aside className="sidebar">
      <div style={{ padding: '0 1.5rem', marginBottom: '1rem' }}>
        <Brand />
      </div>
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <div key={item.label} className={`nav-item ${item.active ? 'active' : ''}`}>
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </div>
        ))}
      </nav>
      {/* Footer message from the design */}
      <div style={{ marginTop: 'auto', padding: '1.5rem', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
        <div style={{ color: 'var(--accent-teal)', marginBottom: '4px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path>
            <path d="M12 6v6l4 2"></path>
          </svg>
          A Greener
        </div>
        <div>Goa is a Happier Goa</div>
      </div>
    </aside>
  );
}

function NavIcon({ name }: { name: string }) {
  switch (name) {
    case 'map': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>;
    case 'ev-station': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="12" height="20" rx="2" ry="2"></rect><circle cx="10" cy="10" r="2"></circle><path d="M16 8h2a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2h0"></path></svg>;
    case 'route': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="3"></circle><line x1="12" y1="22" x2="12" y2="8"></line><path d="M5 12H2a10 10 0 0 0 20 0h-3"></path></svg>;
    case 'bar-chart': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>;
    case 'heart': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>;
    case 'user': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
    default: return <svg />;
  }
}
