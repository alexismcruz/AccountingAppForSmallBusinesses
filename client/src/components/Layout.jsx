import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.jsx';
import { useUser } from '../context/UserContext.jsx';

const ROLE_COLORS = {
  staff:       '#64748b',
  manager:     '#2563eb',
  finance:     '#16a34a',
  admin:       '#7c3aed',
  super_admin: '#ea580c',
};

function NavItem({ to, icon, label, sub, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`.trim()}
      style={sub ? { paddingLeft: 36 } : undefined}
    >
      {!sub && <span className="nav-icon">{icon}</span>}
      {label}
    </NavLink>
  );
}

export default function Layout({ children, onLogout }) {
  const { settings } = useSettings();
  const { user, can } = useUser();
  const location = useLocation();
  const [reportsOpen, setReportsOpen]   = useState(location.pathname.startsWith('/reports'));
  const [paymentsOpen, setPaymentsOpen] = useState(location.pathname.startsWith('/payments'));
  const [sidebarOpen, setSidebarOpen]   = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  const PAGE_TITLES = {
    '/':                         'Dashboard',
    '/journal':                  'Journal Entries',
    '/inventory':                'Inventory',
    '/payments/incoming':        'Incoming Payments',
    '/payments/pending':         'Pending Payments',
    '/payments/schedule':        'Payment Schedule',
    '/reports/balance-sheet':    'Balance Sheet',
    '/reports/income-statement': 'Income Statement',
    '/reports/trial-balance':    'Trial Balance',
    '/reports/ledger':           'General Ledger',
    '/fiscal':                   'Fiscal Year Management',
    '/settings':                 'Business Settings',
  };

  return (
    <div className="app-shell">

      {/* Mobile overlay — tapping it closes the sidebar */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <nav className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <h2>📊 {settings.business_name || 'My Business'}</h2>
          <p>Accounting System</p>
        </div>

        <div className="nav-section">
          <NavItem to="/"          icon="🏠" label="Dashboard"       onNavigate={closeSidebar} />
          <NavItem to="/journal"   icon="📝" label="Journal Entries"  onNavigate={closeSidebar} />
          <NavItem to="/inventory" icon="📦" label="Inventory"        onNavigate={closeSidebar} />
        </div>

        <div className="nav-section">
          <div className="nav-label">Payments</div>
          <div
            className={`nav-item ${paymentsOpen ? 'active' : ''}`}
            onClick={() => setPaymentsOpen(o => !o)}
            style={{ cursor: 'pointer' }}
          >
            <span className="nav-icon">💳</span>
            <span style={{ flex: 1 }}>Payments</span>
            <span style={{ fontSize: 10 }}>{paymentsOpen ? '▲' : '▼'}</span>
          </div>
          {paymentsOpen && (
            <div>
              <NavItem to="/payments/schedule" label="↳ Schedule"      sub onNavigate={closeSidebar} />
              <NavItem to="/payments/incoming" label="↳ Incoming (AR)" sub onNavigate={closeSidebar} />
              <NavItem to="/payments/pending"  label="↳ Pending (AP)"  sub onNavigate={closeSidebar} />
            </div>
          )}
        </div>

        <div className="nav-section">
          <div className="nav-label">Reports</div>
          <div
            className={`nav-item ${reportsOpen ? 'active' : ''}`}
            onClick={() => setReportsOpen(o => !o)}
            style={{ cursor: 'pointer' }}
          >
            <span className="nav-icon">📈</span>
            <span style={{ flex: 1 }}>Reports</span>
            <span style={{ fontSize: 10 }}>{reportsOpen ? '▲' : '▼'}</span>
          </div>
          {reportsOpen && (
            <div>
              <NavItem to="/reports/balance-sheet"    label="↳ Balance Sheet"    sub onNavigate={closeSidebar} />
              <NavItem to="/reports/income-statement" label="↳ Income Statement" sub onNavigate={closeSidebar} />
              <NavItem to="/reports/trial-balance"    label="↳ Trial Balance"    sub onNavigate={closeSidebar} />
              <NavItem to="/reports/ledger"           label="↳ General Ledger"   sub onNavigate={closeSidebar} />
            </div>
          )}
        </div>

        <div className="nav-section">
          <NavItem to="/fiscal" icon="📅" label="Fiscal Year" onNavigate={closeSidebar} />
        </div>

        {can('admin') && (
          <div className="nav-section" style={{ marginTop: 'auto' }}>
            <NavItem to="/settings" icon="⚙️" label="Settings" onNavigate={closeSidebar} />
          </div>
        )}

        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 8 }}>
          {user && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name || user.email}
              </div>
              <span style={{
                display: 'inline-block', marginTop: 3,
                padding: '1px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600,
                background: ROLE_COLORS[user.role] || '#64748b', color: '#fff',
              }}>
                {user.role}
              </span>
            </div>
          )}
          <div style={{ fontSize: 11, color: '#60a5fa', marginBottom: 8 }}>
            {settings.currency || 'USD'} · {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </div>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
              if (onLogout) onLogout();
            }}
            style={{
              width: '100%', padding: '7px 12px', background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
              color: '#93c5fd', fontSize: 12, cursor: 'pointer', textAlign: 'left',
            }}
          >
            🔓 Sign Out
          </button>
        </div>
      </nav>

      {/* Main area */}
      <div className="main-area">
        <div className="top-bar">
          {/* Hamburger button — visible on mobile/tablet only */}
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Toggle navigation menu"
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {PAGE_TITLES[location.pathname] || 'Accounting'}
            </div>
          </div>

          <div className="top-bar-date">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
