import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.jsx';

function StatCard({ label, value, sub, color, icon, onClick }) {
  return (
    <div className="stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stat-label">{label}</div>
        <span style={{ fontSize: 22 }}>{icon}</span>
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

  if (loading) return <div className="text-muted text-center" style={{ padding: 60 }}>Loading…</div>;
  if (!data) return <div className="alert alert-error">Could not load dashboard data.</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Welcome back 👋</div>
          <div className="page-subtitle">{settings.business_name} — Overview</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/journal')}>
          + New Journal Entry
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard label="Total Assets" value={fmt(data.totalAssets)} color="#2563eb" icon="🏦" />
        <StatCard label="Cash & Bank" value={fmt(data.cashBalance)} color="#15803d" icon="💵" />
        <StatCard
          label="Receivable (AR)" value={fmt(data.arBalance)}
          sub={data.overdueAR > 0 ? `⚠ ${data.overdueAR} overdue` : 'All current'}
          color={data.overdueAR > 0 ? '#b45309' : '#0369a1'} icon="📥"
          onClick={() => navigate('/payments/incoming')}
        />
        <StatCard
          label="Payable (AP)" value={fmt(data.apBalance)}
          sub={data.overdueAP > 0 ? `⚠ ${data.overdueAP} overdue` : 'All current'}
          color={data.overdueAP > 0 ? '#b91c1c' : '#7c3aed'} icon="📤"
          onClick={() => navigate('/payments/pending')}
        />
      </div>

      {/* Approvals tile */}
      <div style={{ marginBottom: 24 }}>
        <StatCard
          label="Pending Approvals"
          value={pendingApprove > 0 ? pendingApprove : '—'}
          sub={pendingApprove > 0 ? 'Action required — click to review' : 'No pending approvals'}
          color={pendingApprove > 0 ? '#ea580c' : '#64748b'}
          icon="✅"
          onClick={() => navigate('/approvals')}
        />
      </div>

      {/* Alerts row */}
      {((data.lowStock > 0 && hasModule('inventory')) || data.overdueAR > 0 || data.overdueAP > 0) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {data.lowStock > 0 && hasModule('inventory') && (
            <div className="alert alert-warning" style={{ flex: 1, minWidth: 240, cursor: 'pointer' }}
              onClick={() => navigate('/inventory')}>
              📦 <span><strong>{data.lowStock} item{data.lowStock > 1 ? 's' : ''}</strong> at or below reorder point — check inventory</span>
            </div>
          )}
          {data.overdueAR > 0 && (
            <div className="alert alert-warning" style={{ flex: 1, minWidth: 240, cursor: 'pointer' }}
              onClick={() => navigate('/payments/incoming')}>
              📥 <span><strong>{data.overdueAR} overdue invoice{data.overdueAR > 1 ? 's' : ''}</strong> — customers owe you money</span>
            </div>
          )}
          {data.overdueAP > 0 && (
            <div className="alert alert-danger" style={{ flex: 1, minWidth: 240, cursor: 'pointer' }}
              onClick={() => navigate('/payments/pending')}>
              📤 <span><strong>{data.overdueAP} overdue bill{data.overdueAP > 1 ? 's' : ''}</strong> — you owe suppliers money</span>
            </div>
          )}
        </div>
      )}
      {(data.lowStock === 0 || !hasModule('inventory')) && data.overdueAR === 0 && data.overdueAP === 0 && (
        <div className="alert alert-success" style={{ marginBottom: 24 }}>
          ✓ Everything looks good — no alerts at this time.
        </div>
      )}

      {/* Recent Entries */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>Recent Journal Entries</div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/journal')}>View all →</button>
        </div>
        {data.recentEntries.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <div className="empty-state-icon">📝</div>
            <p>No journal entries yet. <span style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => navigate('/journal')}>Create your first entry →</span></p>
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
            { label: '📝 New Journal Entry', to: '/journal' },
            { label: '📦 Add Inventory Item', to: '/inventory' },
            { label: '📥 Record Incoming Payment', to: '/payments/incoming' },
            { label: '📤 Record Pending Bill', to: '/payments/pending' },
            { label: '📊 View Balance Sheet', to: '/reports/balance-sheet' },
          ].map(({ label, to }) => (
            <button key={to} className="btn btn-ghost" onClick={() => navigate(to)}>{label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
