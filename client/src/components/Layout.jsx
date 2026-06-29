import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.jsx';
import { useUser }     from '../context/UserContext.jsx';
import ChatbotWidget   from './ChatbotWidget.jsx';
import {
  LayoutDashboard, CheckSquare, BookOpen, Package, CreditCard,
  CalendarDays, ArrowDownToLine, ArrowUpFromLine, RefreshCw,
  Users, ClipboardList, FileText, Receipt,
  PieChart, Scale, TrendingUp, BookMarked,
  BarChart3, BookKey, Building2,
  Calendar, History, BookCopy, Link2, Settings,
  ChevronRight, LogOut, KeyRound, Shield,
  Menu, X, AlertTriangle, Mail,
} from 'lucide-react';

// ── CuentaIQ inline SVG logo ──────────────────────────────────────────────────
function CuentaIQLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="44" cy="43" r="28" stroke="#2D6A4F" strokeWidth="9" fill="white"/>
        <line x1="63" y1="62" x2="81" y2="80" stroke="#2D6A4F" strokeWidth="9" strokeLinecap="round"/>
        <path d="M30 43 L40 54 L62 32" stroke="#D4A017" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: 19, fontWeight: 400,
        color: 'var(--color-primary)',
        letterSpacing: '-0.01em', lineHeight: 1,
      }}>
        CuentaIQ
      </span>
    </div>
  );
}

// ── Password validation ───────────────────────────────────────────────────────
const PW_RULES = 'Min 8 · Max 20 · At least 1 number · At least 1 special character · No spaces';
function validatePw(pw) {
  if (!pw)              return 'Password is required';
  if (pw.length < 8)   return 'Must be at least 8 characters';
  if (pw.length > 20)  return 'Must not exceed 20 characters';
  if (/\s/.test(pw))   return 'Must not contain spaces';
  if (!/[0-9]/.test(pw)) return 'Must contain at least one number';
  if (!/[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(pw))
    return 'Must contain at least one special character';
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
    if (liveErr)  { setError(liveErr); return; }
    if (mismatch) { setError('Passwords do not match'); return; }
    setSaving(true); setError('');
    try {
      const res  = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ current_password: form.current, new_password: form.next, confirm_password: form.confirm }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setDone(true);
    } catch { setError('Network error. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Change Password</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {done ? (
            <div className="alert alert-success">Password changed successfully.</div>
          ) : (
            <>
              <div className="alert alert-info mb-16" style={{ fontSize: 12 }}>{PW_RULES}</div>
              {error && <div className="alert alert-error mb-12">{error}</div>}
              {[
                { field: 'current', label: 'Current Password' },
                { field: 'next',    label: 'New Password' },
                { field: 'confirm', label: 'Confirm New Password' },
              ].map(({ field, label }) => (
                <div className="form-group" key={field} style={{ position: 'relative' }}>
                  <label className="form-label">{label}</label>
                  <div style={{ position: 'relative' }}>
                    <input className="form-input"
                      type={show[field] ? 'text' : 'password'}
                      value={form[field]}
                      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                      style={{ paddingRight: 36 }}
                      autoComplete={field === 'current' ? 'current-password' : 'new-password'}
                    />
                    <button type="button"
                      onClick={() => setShow(s => ({ ...s, [field]: !s[field] }))}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                               background: 'none', border: 'none', cursor: 'pointer',
                               fontSize: 13, color: 'var(--color-ink-light)' }}>
                      {show[field] ? '●' : '○'}
                    </button>
                  </div>
                  {field === 'next' && liveErr && form.next && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{liveErr}</div>
                  )}
                  {field === 'confirm' && mismatch && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Passwords do not match</div>
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

// ── Role badge colors ─────────────────────────────────────────────────────────
const ROLE_STYLES = {
  staff:       { bg: 'var(--color-surface-2)',    color: 'var(--color-ink-mid)' },
  manager:     { bg: 'var(--color-primary-light)', color: 'var(--color-primary)' },
  finance:     { bg: '#EAF2EE',                   color: '#1B5E3B' },
  admin:       { bg: '#FBF4E0',                   color: '#7A5C0A' },
  super_admin: { bg: '#FDEAEA',                   color: '#8B2020' },
};

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({ to, icon: Icon, label, sub, onNavigate, badge }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      style={sub ? { paddingLeft: 38 } : undefined}
    >
      {!sub && Icon && (
        <span className="nav-icon"><Icon size={16} strokeWidth={1.8} /></span>
      )}
      <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && (
        <span style={{
          background: '#8B2020', color: '#fff', borderRadius: 10,
          padding: '1px 6px', fontSize: 10, fontWeight: 700,
        }}>
          {badge}
        </span>
      )}
    </NavLink>
  );
}

// ── Accordion group ───────────────────────────────────────────────────────────
function NavGroup({ icon: Icon, label, open, onToggle, children }) {
  return (
    <div className="nav-section">
      <button className="nav-item" onClick={onToggle} aria-expanded={open}>
        <span className="nav-icon"><Icon size={16} strokeWidth={1.8} /></span>
        <span style={{ flex: 1 }}>{label}</span>
        <ChevronRight size={14} className={`nav-chevron${open ? ' open' : ''}`} strokeWidth={2} />
      </button>
      {open && <div className="nav-sub">{children}</div>}
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function Layout({ children, onLogout }) {
  const { settings, hasModule } = useSettings();
  const { user, can }           = useUser();
  const location                = useLocation();

  const [reportsOpen,  setReportsOpen]  = useState(location.pathname.startsWith('/reports'));
  const [paymentsOpen, setPaymentsOpen] = useState(location.pathname.startsWith('/payments'));
  const [taxOpen,      setTaxOpen]      = useState(location.pathname.startsWith('/tax'));
  const [hrOpen,       setHrOpen]       = useState(location.pathname.startsWith('/hr'));
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showChangePw, setShowChangePw] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    const fetchCount = () => {
      fetch('/api/approvals/pending-count', { credentials: 'include' })
        .then(r => r.json())
        .then(d => setPendingCount(d.count || 0))
        .catch(() => {});
    };
    fetchCount();
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
    '/payments/recurring':       'Recurring Invoices',
    '/reports/balance-sheet':    'Balance Sheet',
    '/reports/income-statement': 'Income Statement',
    '/reports/trial-balance':    'Trial Balance',
    '/reports/ledger':           'General Ledger',
    '/fiscal':                   'Fiscal Year Management',
    '/settings':                 'Business Settings',
    '/opening-balance':          'Opening Balances',
    '/hr/employees':             'Employees',
    '/hr/payroll':               'Payroll Runs',
    '/hr/leaves':                'Leave Management',
    '/hr/bir':                   'BIR Forms',
    '/accounts':                 'Chart of Accounts',
    '/hq':                       'HQ Dashboard',
    '/integrations':             'Integrations',
    '/approvals':                'Approvals',
    '/logs':                     'Audit Logs',
    '/email-log':                'Email Log',
    '/tax/rates':                'Tax Rates',
    '/tax/applications':         'Tax Applications',
    '/tax/projections':          'Tax Projections',
    '/tax/filings':              'Filing Tracker',
  };

  const initials = user
    ? (user.name || user.email || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const roleStyle = ROLE_STYLES[user?.role] || ROLE_STYLES.staff;

  return (
    <div className="app-shell">
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}

      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <nav className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>

        {/* Logo */}
        <div className="sidebar-logo">
          <CuentaIQLogo />
          {settings.business_name && (
            <div style={{ fontSize: 11, color: 'var(--color-ink-light)', marginTop: 6, paddingLeft: 2 }}>
              {settings.business_name}
            </div>
          )}
        </div>

        {/* Core nav */}
        <div className="nav-section">
          <NavItem to="/"          icon={LayoutDashboard} label="Dashboard"      onNavigate={closeSidebar} />
          <NavItem to="/approvals" icon={CheckSquare}     label="Approvals"      onNavigate={closeSidebar} badge={pendingCount} />
          <NavItem to="/journal"   icon={BookOpen}        label="Journal Entries" onNavigate={closeSidebar} />
          {hasModule('inventory') && (
            <NavItem to="/inventory" icon={Package} label="Inventory" onNavigate={closeSidebar} />
          )}
        </div>

        {/* Payments */}
        {hasModule('payments') && (
          <NavGroup icon={CreditCard} label="Payments" open={paymentsOpen} onToggle={() => setPaymentsOpen(o => !o)}>
            <NavItem to="/payments/schedule"  label="Schedule"      sub onNavigate={closeSidebar} />
            <NavItem to="/payments/incoming"  label="Incoming (AR)" sub onNavigate={closeSidebar} />
            <NavItem to="/payments/pending"   label="Pending (AP)"  sub onNavigate={closeSidebar} />
            <NavItem to="/payments/recurring" label="Recurring"     sub onNavigate={closeSidebar} />
          </NavGroup>
        )}

        {/* HR & Payroll */}
        {hasModule('hr') && (
          <NavGroup icon={Users} label="HR & Payroll" open={hrOpen} onToggle={() => setHrOpen(o => !o)}>
            <NavItem to="/hr/employees" label="Employees"        sub onNavigate={closeSidebar} />
            <NavItem to="/hr/payroll"   label="Payroll Runs"     sub onNavigate={closeSidebar} />
            <NavItem to="/hr/leaves"    label="Leave Management" sub onNavigate={closeSidebar} />
            <NavItem to="/hr/bir"       label="BIR Forms"        sub onNavigate={closeSidebar} />
          </NavGroup>
        )}

        {/* Tax */}
        {hasModule('tax') && (
          <NavGroup icon={Receipt} label="Tax" open={taxOpen} onToggle={() => setTaxOpen(o => !o)}>
            <NavItem to="/tax/rates"        label="Tax Rates"      sub onNavigate={closeSidebar} />
            <NavItem to="/tax/applications" label="Applications"   sub onNavigate={closeSidebar} />
            <NavItem to="/tax/projections"  label="Projections"    sub onNavigate={closeSidebar} />
            <NavItem to="/tax/filings"      label="Filing Tracker" sub onNavigate={closeSidebar} />
          </NavGroup>
        )}

        {/* Reports */}
        <NavGroup icon={BarChart3} label="Reports" open={reportsOpen} onToggle={() => setReportsOpen(o => !o)}>
          <NavItem to="/reports/balance-sheet"    label="Balance Sheet"    sub onNavigate={closeSidebar} />
          <NavItem to="/reports/income-statement" label="Income Statement" sub onNavigate={closeSidebar} />
          <NavItem to="/reports/trial-balance"    label="Trial Balance"    sub onNavigate={closeSidebar} />
          <NavItem to="/reports/ledger"           label="General Ledger"   sub onNavigate={closeSidebar} />
        </NavGroup>

        {/* Admin items */}
        <div className="nav-section">
          <NavItem to="/fiscal" icon={Calendar} label="Fiscal Year" onNavigate={closeSidebar} />
        </div>
        {can('finance') && (
          <div className="nav-section">
            <NavItem to="/accounts"  icon={BookCopy}  label="Chart of Accounts" onNavigate={closeSidebar} />
            <NavItem to="/logs"      icon={History}   label="Audit Logs"        onNavigate={closeSidebar} />
            <NavItem to="/email-log" icon={Mail}      label="Email Log"         onNavigate={closeSidebar} />
          </div>
        )}
        {can('admin') && (
          <div className="nav-section">
            {settings.multi_branch_role === 'hq' && (
              <NavItem to="/hq" icon={Building2} label="HQ Dashboard" onNavigate={closeSidebar} />
            )}
            <NavItem to="/integrations"    icon={Link2}    label="Integrations"    onNavigate={closeSidebar} />
            <NavItem to="/settings"        icon={Settings} label="Settings"        onNavigate={closeSidebar} />
            <NavItem to="/opening-balance" icon={BookKey}  label="Opening Balances" onNavigate={closeSidebar} />
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="sidebar-footer">
          {user && (
            <div className="sidebar-user">
              <div className="sidebar-avatar">{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div className="sidebar-user-name">{user.name || user.email}</div>
                <span className="sidebar-user-role" style={{ background: roleStyle.bg, color: roleStyle.color }}>
                  {user.role}
                </span>
              </div>
            </div>
          )}
          <div className="sidebar-meta">
            {settings.currency || 'PHP'} · {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </div>
          <button className="sidebar-action" onClick={() => setShowChangePw(true)}>
            <KeyRound size={14} strokeWidth={2} />
            <span>Change Password</span>
          </button>
          <button className="sidebar-action" onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            if (onLogout) onLogout();
          }}>
            <LogOut size={14} strokeWidth={2} />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="main-area">

        {settings.sandboxMode && (
          <div style={{
            background: '#92400e', color: '#fef3c7',
            padding: '6px 16px', textAlign: 'center',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
            flexShrink: 0, lineHeight: 1.4,
          }}>
            SANDBOX ENVIRONMENT — Demo data only. Not for real business use.
          </div>
        )}

        <div className="top-bar">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: 'var(--color-ink)' }}>
              {PAGE_TITLES[location.pathname] || 'CuentaIQ'}
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

      <ChatbotWidget />
    </div>
  );
}
