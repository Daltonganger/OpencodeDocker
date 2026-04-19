export function Sidebar({ currentPage, isOpen, onNavigate }: { currentPage: string; isOpen: boolean; onNavigate: (page: string) => void }) {
  const logoSrc = `${import.meta.env.BASE_URL}assets/logo.svg`;
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'agents', label: 'Agents', icon: '🤖' },
    { id: 'plugins', label: 'Plugins', icon: '🔌' },
    { id: 'providers', label: 'Providers & Models', icon: '⚡' },
    { id: 'providers-json', label: 'Providers JSON', icon: '🧾' },
    { id: 'mcp-servers', label: 'MCP Servers', icon: '🖥️' },
    { id: 'oauth', label: 'OAuth', icon: '🔐' },
    { id: 'secrets', label: 'Secrets', icon: '🔑' },
    { id: 'apply', label: 'Apply', icon: '✅' },
    { id: 'advanced', label: 'Advanced JSON', icon: '⚙️' },
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo"><img src={logoSrc} alt="OpenCode Admin" style={{ width: '100%', height: '100%' }} /></div>
        <span className="sidebar-title">OpenCode Admin</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
