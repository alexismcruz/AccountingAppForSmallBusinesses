import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.jsx';
import { useUser } from '../context/UserContext.jsx';

// ── Password rules (mirrors server-side validation) ───────────────────────────
const PW_RULES = 'Min 8 · Max 20 · At least 1 number · At least 1 special character · No spaces';
function validatePw(pw) {
  if (!pw)             return 'Password is required';
  if (pw.length < 8)   return 'Must be at least 8 characters';
  if (pw.length > 20)  return 'Must not exceed 20 characters';
  if (/\s/.test(pw))   return 'Must not contain spaces';
  if (!/[0-9]/.test(pw)) return 'Must contain at least one number';
  if (!/[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(pw))
    return 'Must contain at least one special character (e.g. !@#$%)';
  return null;
}

// ── Change Password Modal ─────────────────────────────────────────────────────
function ChangePasswordModal({ onClose }) {
  const [form,   setForm]   = useState({ current: '', next: '', confirm: '' });
  const [show,   setShow]   = useState({ current: false, next: false, confirm: false });
  const [error,  setError]  = useState('');
  const [done,   setDone]   = useState(false);
  const [saving, setSaving] = useState(false);

  const liveErr = form.next ? validatePw(form.next) : null;
  const mismatch = form.confirm && form.next !== form.confirm;

  const handleSave = async () => {
    if (liveErr)   { setError(liveErr); return; }
    if (mismatch)  { setError('Passwords do not match'); return; }
    setSaving(true); setError('');
    try {
      const res  = await fetch('/api/auth/change-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:    JSON.stringify({ current_password: form.current, new_password: form.next, confirm_password: form.confirm }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setDone(true);
    } catch { setError('Network error. Please try again.'); }
    finally { setSaving(false); }
  };

  const EyeBtn = ({ field }) => (
    <button type="button" onClick={() => setShow(s => ({ ...s, [field]: !s[field] }))}
      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
               background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--text-muted)' }}>
      {show[field] ? '🙈' : '👁'}
    </button>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">🔑 Change Password</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {done ? (
            <div className="alert alert-success">✓ Password changed successfully. Use your new password next time you log in.</div>
          ) : (
            <>
              <div className="alert alert-info mb-16" style={{ fontSize: 12 }}>{PW_RULES}</div>
              {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
              {[
                { field: 'current', label: 'Current Password' },
                { field: 'next',    label: 'New Password' },
                { field: 'confirm', label: 'Confirm New Password' },
              ].map(({ field, label }) => (
                <div className="form-group" key={field} style={{ position: 'relative' }}>
                  <label className="form-label">{label}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-input"
                      type={show[field] ? 'text' : 'password'}
                      value={form[field]}
                      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                      style={{ paddingRight: 36 }}
                      autoComplete={field === 'current' ? 'current-password' : 'new-password'}
                    />
                    <EyeBtn field={field} />
                  </div>
                  {field === 'next' && liveErr && form.next && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>⚠ {liveErr}</div>
                  )}
                  {field === 'confirm' && mismatch && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>⚠ Passwords do not match</div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
        <div className="modal-footer">
          {done
            ? <button className="btn btn-primary" onClick={onClose}>Done</button>
            : <>
                <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave}
                  disabled={saving || !!liveErr || mismatch || !form.current || !form.next || !form.confirm}>
                  {saving ? 'Saving…' : 'Change Password'}
                </button>
              </>
          }
        </div>
      </div>
    </div>
  );
}

const ROLE_COLORS = {
  staff:       '#64748b',
  manager:     '#2563eb',
  finance:     '#16a34a',
  admin:       '#7c3aed',
  super_admin: '#ea580c',
};

function NavItem({ to, icon, label, sub, onNavigate, badge }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`.trim()}
      style={sub ? { paddingLeft: 36 } : undefined}
    >
      {!sub && <span className="nav-icon">{icon}</span>}
      <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && (
        <span style={{
          background: 'var(--danger)', color: '#fff', borderRadius: 10,
          padding: '1px 6px', fontSize: 10, fontWeight: 700, marginLeft: 4,
        }}>
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export default function Layout({ children, onLogout }) {
  const { settings } = useSettings();
  const { user, can } = useUser();
  const location = useLocation();
  const [reportsOpen,     setReportsOpen]     = useState(location.pathname.startsWith('/reports'));
  const [paymentsOpen,    setPaymentsOpen]    = useState(location.pathname.startsWith('/payments'));
  const [taxOpen,         setTaxOpen]         = useState(location.pathname.startsWith('/tax'));
  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [pendingCount,    setPendingCount]    = useState(0);
  const [showChangePw,    setShowChangePw]    = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  // Fetch pending approvals count for badge
  useEffect(() => {
    const fetchCount = () => {
      fetch('/api/approvals/pending-count', { credentials: 'include' })
        .then(r => r.json())
        .then(d => setPendingCount(d.count || 0))
        .catch(() => {});
    };
    fetchCount();
    // Refresh every 60 s so the badge stays current
    const id = setInterval(fetchCount, 60000);
    return () => clearInterval(id);
  }, []);

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
    '/opening-balance':          'Opening Balances',
    '/hr/employees':             'Employees',
    '/hr/payroll':               'Payroll Runs',
    '/approvals':                'Approvals',
    '/logs':                     'Audit Logs',
    '/tax/rates':                'Tax Rates',
    '/tax/applications':         'Tax Applications',
    '/tax/projections':          'Tax Projections',
    '/tax/filings':              'Filing Tracker',
  };

  return (
    <div className="app-shell">

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}

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
          <NavItem to="/approvals" label="↳ Approvals" sub          onNavigate={closeSidebar} badge={pendingCount} />
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
          <div className="nav-label">HR &amp; Payroll</div>
          <NavItem to="/hr/employees" icon="👥" label="Employees"    onNavigate={closeSidebar} />
          <NavItem to="/hr/payroll"   icon="💰" label="Payroll Runs" onNavigate={closeSidebar} />
        </div>

        <div className="nav-section">
          <div className="nav-label">Tax</div>
          <div
            className={`nav-item ${taxOpen ? 'active' : ''}`}
            onClick={() => setTaxOpen(o => !o)}
            style={{ cursor: 'pointer' }}
          >
            <span className="nav-icon">🧾</span>
            <span style={{ flex: 1 }}>Tax</span>
            <span style={{ fontSize: 10 }}>{taxOpen ? '▲' : '▼'}</span>
          </div>
          {taxOpen && (
            <div>
              <NavItem to="/tax/rates"        label="↳ Tax Rates"       sub onNavigate={closeSidebar} />
              <NavItem to="/tax/applications" label="↳ Applications"    sub onNavigate={closeSidebar} />
              <NavItem to="/tax/projections"  label="↳ Projections"     sub onNavigate={closeSidebar} />
              <NavItem to="/tax/filings"      label="↳ Filing Tracker"  sub onNavigate={closeSidebar} />
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

        {can('finance') && (
          <div className="nav-section">
            <NavItem to="/logs" icon="📋" label="Audit Logs" onNavigate={closeSidebar} />
          </div>
        )}

        {can('admin') && (
          <div className="nav-section" style={{ marginTop: 'auto' }}>
            <NavItem to="/settings"       icon="⚙️" label="Settings"         onNavigate={closeSidebar} />
            <NavItem to="/opening-balance" label="↳ Opening Balances" sub    onNavigate={closeSidebar} />
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
            {settings.currency || 'PHP'} · {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </div>
          <button
            onClick={() => setShowChangePw(true)}
            style={{
              width: '100%', padding: '7px 12px', background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
              color: '#93c5fd', fontSize: 12, cursor: 'pointer', textAlign: 'left',
              marginBottom: 6,
            }}
          >
            🔑 Change Password
          </button>
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

        {/* Sandbox banner — visible only when SANDBOX_MODE=true */}
        {settings.sandboxMode && (
          <div style={{
            background: '#92400e', color: '#fef3c7',
            padding: '6px 16px', textAlign: 'center',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
            flexShrink: 0, lineHeight: 1.4,
          }}>
            🧪 SANDBOX ENVIRONMENT — Demo data only. Not for real business use.
          </div>
        )}

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
