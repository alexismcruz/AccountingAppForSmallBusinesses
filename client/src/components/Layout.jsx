import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.jsx';

function NavItem({ to, icon, label, sub }) {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-item${sub ? '' : ''} ${isActive ? 'active' : ''}`.trim()}
      style={sub ? { paddingLeft: 36 } : undefined}>
      {!sub && <span className="nav-icon">{icon}</span>}
      {label}
    </NavLink>
  );
}

export default function Layout({ children, onLogout }) {
  const { settings } = useSettings();
  const location = useLocation();
  const [reportsOpen, setReportsOpen] = useState(location.pathname.startsWith('/reports'));
  const [paymentsOpen, setPaymentsOpen] = useState(location.pathname.startsWith('/payments'));

  const PAGE_TITLES = {
    '/': 'Dashboard',
    '/journal': 'Journal Entries',
    '/inventory': 'Inventory',
    '/payments/incoming': 'Incoming Payments',
    '/payments/pending': 'Pending Payments',
    '/payments/schedule': 'Payment Schedule',
    '/reports/balance-sheet': 'Balance Sheet',
    '/reports/income-statement': 'Income Statement',
    '/reports/trial-balance': 'Trial Balance',
    '/reports/ledger': 'General Ledger',
    '/fiscal': 'Fiscal Year Management',
    '/settings': 'Business Settings',
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <h2>📊 {settings.business_name || 'My Business'}</h2>
          <p>Accounting System</p>
        </div>

        <div className="nav-section">
          <NavItem to="/" icon="🏠" label="Dashboard" />
          <NavItem to="/journal" icon="📝" label="Journal Entries" />
          <NavItem to="/inventory" icon="📦" label="Inventory" />
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
              <NavItem to="/payments/schedule"  label="↳ Schedule"      sub />
              <NavItem to="/payments/incoming"  label="↳ Incoming (AR)" sub />
              <NavItem to="/payments/pending"   label="↳ Pending (AP)"  sub />
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
              <NavItem to="/reports/balance-sheet"    label="↳ Balance Sheet" sub />
              <NavItem to="/reports/income-statement" label="↳ Income Statement" sub />
              <NavItem to="/reports/trial-balance"    label="↳ Trial Balance" sub />
              <NavItem to="/reports/ledger"           label="↳ General Ledger" sub />
            </div>
          )}
        </div>

        <div className="nav-section">
          <NavItem to="/fiscal" icon="📅" label="Fiscal Year" />
        </div>

        <div className="nav-section" style={{ marginTop: 'auto' }}>
          <NavItem to="/settings" icon="⚙️" label="Settings" />
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 8 }}>
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
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {PAGE_TITLES[location.pathname] || 'Accounting'}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
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
