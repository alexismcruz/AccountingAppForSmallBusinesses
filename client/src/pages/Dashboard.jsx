import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.jsx';
import {
  Landmark, Wallet, ArrowDownToLine, ArrowUpFromLine,
  CheckSquare, CheckCircle2, Package, BookOpen, BarChart3, AlertTriangle,
} from 'lucide-react';

const BRAND = {
  primary:  '#2D6A4F',
  accent:   '#D4A017',
  success:  '#1B5E3B',
  warning:  '#7A5C0A',
  danger:   '#8B2020',
  blue:     '#1D4ED8',
  slate:    '#475569',
};

function StatCard({ label, value, sub, color, icon: Icon, onClick }) {
  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', borderLeft: `4px solid ${color}` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stat-label">{label}</div>
        {Icon && (
          <div className="stat-icon-badge" style={{ background: `${color}18` }}>
            <Icon size={20} color={color} strokeWidth={1.8} />
          </div>
        )}
      </div>
      <div className="stat-value" style={{ color }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { fmt, settings, hasModule } = useSettings();
  const navigate = useNavigate();
  const [data,           setData]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [pendingApprove, setPendingApprove] = useState(0);

  useEffect(() => {
    fetch('/api/reports/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));

    fetch('/api/approvals/pending-count', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPendingApprove(d.count || 0))
      .catch(() => {});
  }, []);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!data)   return <div className="alert alert-error">Could not load dashboard data.</div>;

  const hasAlerts = (data.lowStock > 0 && hasModule('inventory')) || data.overdueAR > 0 || data.overdueAP > 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Welcome back</div>
          <div className="page-subtitle">{settings.business_name} — Overview</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/journal')}>
          + New Journal Entry
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard label="Total Assets"     value={fmt(data.totalAssets)} color={BRAND.blue}    icon={Landmark} />
        <StatCard label="Cash & Bank"      value={fmt(data.cashBalance)} color={BRAND.primary} icon={Wallet} />
        <StatCard
          label="Receivable (AR)" value={fmt(data.arBalance)}
          sub={data.overdueAR > 0 ? `${data.overdueAR} overdue` : 'All current'}
          color={data.overdueAR > 0 ? BRAND.warning : BRAND.primary}
          icon={ArrowDownToLine}
          onClick={() => navigate('/payments/incoming')}
        />
        <StatCard
          label="Payable (AP)" value={fmt(data.apBalance)}
          sub={data.overdueAP > 0 ? `${data.overdueAP} overdue` : 'All current'}
          color={data.overdueAP > 0 ? BRAND.danger : BRAND.slate}
          icon={ArrowUpFromLine}
          onClick={() => navigate('/payments/pending')}
        />
      </div>

      {/* Approvals tile */}
      <div style={{ marginBottom: 24 }}>
        <StatCard
          label="Pending Approvals"
          value={pendingApprove > 0 ? pendingApprove : '—'}
          sub={pendingApprove > 0 ? 'Action required — click to review' : 'No pending approvals'}
          color={pendingApprove > 0 ? '#EA580C' : BRAND.slate}
          icon={CheckSquare}
          onClick={() => navigate('/approvals')}
        />
      </div>

      {/* Alerts */}
      {hasAlerts && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {data.lowStock > 0 && hasModule('inventory') && (
            <div className="alert alert-warning" style={{ flex: 1, minWidth: 240, cursor: 'pointer' }}
              onClick={() => navigate('/inventory')}>
              <Package size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                <strong>{data.lowStock} item{data.lowStock > 1 ? 's' : ''}</strong> at or below reorder point — check inventory
              </span>
            </div>
          )}
          {data.overdueAR > 0 && (
            <div className="alert alert-warning" style={{ flex: 1, minWidth: 240, cursor: 'pointer' }}
              onClick={() => navigate('/payments/incoming')}>
              <ArrowDownToLine size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                <strong>{data.overdueAR} overdue invoice{data.overdueAR > 1 ? 's' : ''}</strong> — customers owe you money
              </span>
            </div>
          )}
          {data.overdueAP > 0 && (
            <div className="alert alert-error" style={{ flex: 1, minWidth: 240, cursor: 'pointer' }}
              onClick={() => navigate('/payments/pending')}>
              <ArrowUpFromLine size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                <strong>{data.overdueAP} overdue bill{data.overdueAP > 1 ? 's' : ''}</strong> — you owe suppliers money
              </span>
            </div>
          )}
        </div>
      )}

      {!hasAlerts && (
        <div className="alert alert-success" style={{ marginBottom: 24 }}>
          <CheckCircle2 size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Everything looks good — no alerts at this time.</span>
        </div>
      )}

      {/* Recent Entries */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>Recent Journal Entries</div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/journal')}>View all →</button>
        </div>
        {data.recentEntries.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <div className="empty-state-icon">
              <BookOpen size={40} strokeWidth={1.4} />
            </div>
            <div className="empty-state-title">No journal entries yet</div>
            <div className="empty-state-sub">
              <span style={{ color: 'var(--color-primary)', cursor: 'pointer' }}
                onClick={() => navigate('/journal')}>
                Create your first entry →
              </span>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th className="td-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.recentEntries.map(e => (
                  <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/journal')}>
                    <td>{new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td><span className="td-mono">{e.reference}</span></td>
                    <td>{e.description}</td>
                    <td className="td-right tabular">{fmt(e.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card mt-16">
        <div className="section-title">Quick Actions</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'New Journal Entry',      icon: BookOpen,          to: '/journal' },
            { label: 'Add Inventory Item',     icon: Package,           to: '/inventory', guard: 'inventory' },
            { label: 'Record Incoming Payment',icon: ArrowDownToLine,   to: '/payments/incoming' },
            { label: 'Record Pending Bill',    icon: ArrowUpFromLine,   to: '/payments/pending' },
            { label: 'View Balance Sheet',     icon: BarChart3,         to: '/reports/balance-sheet' },
          ]
            .filter(a => !a.guard || hasModule(a.guard))
            .map(({ label, icon: Icon, to }) => (
              <button key={to} className="btn btn-ghost" onClick={() => navigate(to)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon size={14} strokeWidth={2} />
                {label}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
