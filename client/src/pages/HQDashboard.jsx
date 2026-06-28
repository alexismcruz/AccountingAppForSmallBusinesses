import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useUser } from '../context/UserContext.jsx';

function SyncBadge({ status }) {
  const MAP = {
    synced:  { bg: '#dcfce7', color: '#166534', label: 'Synced' },
    pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
    stale:   { bg: '#fee2e2', color: '#991b1b', label: 'Stale'  },
    never:   { bg: '#f1f5f9', color: '#64748b', label: 'Never'  },
  };
  const s = MAP[status] || MAP.never;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function MetricCard({ label, value, sub }) {
  return (
    <div className="card" style={{ margin: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-mid)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: sub < 0 ? 'var(--color-danger)' : 'var(--color-ink)' }}>
        {value}
      </div>
    </div>
  );
}

export default function HQDashboard() {
  const { settings, fmt } = useSettings();
  const { can }           = useUser();

  const [period,  setPeriod]  = useState(new Date().toISOString().slice(0, 7));
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const role = settings.multi_branch_role;

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/branch-sync/summary?period=${period}`, { credentials: 'include' });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to load summary.');
        setData(null);
      } else {
        setData(await res.json());
      }
    } catch { setError('Network error.'); }
    setLoading(false);
  };

  useEffect(() => {
    if (role === 'hq' && can('admin')) load();
  }, [period, role]);

  // Wait for settings to load
  if (!role) return null;

  if (role !== 'hq') {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">HQ Dashboard</div>
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>This instance is not configured as HQ</div>
          <div style={{ color: 'var(--color-ink-mid)', fontSize: 13 }}>
            Go to Settings → Multi-Branch Sync to set this instance as HQ.
          </div>
        </div>
      </div>
    );
  }

  const totals   = data?.totals;
  const branches = data?.branches || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">HQ Dashboard</div>
          <div className="page-subtitle">Consolidated financial view across all connected branches</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, color: 'var(--color-ink-mid)' }}>Period</label>
          <input type="month" className="form-input" value={period}
            onChange={e => setPeriod(e.target.value)}
            style={{ width: 155 }} />
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={load} disabled={loading}>
            ↻
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error mb-16">{error}</div>}

      {loading && !data && (
        <div style={{ color: 'var(--color-ink-mid)', fontSize: 13 }}>Loading…</div>
      )}

      {!loading && totals && (
        <>
          {/* ── Summary metric cards ─────────────────────────────── */}
          <div className="grid-3 gap-16 mb-16">
            <MetricCard label="Total Revenue"   value={fmt(totals.revenue)}       sub={totals.revenue} />
            <MetricCard label="Total Expenses"  value={fmt(totals.expenses)}      sub={totals.expenses} />
            <MetricCard label="Net Income"      value={fmt(totals.net_income)}    sub={totals.net_income} />
            <MetricCard label="AR Balance"      value={fmt(totals.ar_balance)}    sub={totals.ar_balance} />
            <MetricCard label="AP Balance"      value={fmt(totals.ap_balance)}    sub={totals.ap_balance} />
            <MetricCard label="Payroll Total"   value={fmt(totals.payroll_total)} sub={totals.payroll_total} />
          </div>

          {/* ── Branch breakdown table ────────────────────────────── */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="section-title" style={{ margin: 0 }}>
                Branch Breakdown — {period}
              </div>
              <span style={{ fontSize: 12, color: 'var(--color-ink-mid)' }}>
                {branches.length} branch{branches.length !== 1 ? 'es' : ''}
              </span>
            </div>

            {branches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-ink-mid)', fontSize: 13 }}>
                No branches have synced data for this period yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                      {[
                        { label: 'Branch',    align: 'left'  },
                        { label: 'Revenue',   align: 'right' },
                        { label: 'Expenses',  align: 'right' },
                        { label: 'Net Income',align: 'right' },
                        { label: 'AR',        align: 'right' },
                        { label: 'AP',        align: 'right' },
                        { label: 'Payroll',   align: 'right' },
                        { label: 'Status',    align: 'center'},
                        { label: 'Last Sync', align: 'right' },
                      ].map(({ label, align }) => (
                        <th key={label} style={{
                          textAlign: align, padding: '7px 10px',
                          fontSize: 11, fontWeight: 600, color: 'var(--color-ink-mid)',
                          textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                        }}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map(b => (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '9px 10px', fontWeight: 600 }}>{b.name}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmt(b.revenue)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmt(b.expenses)}</td>
                        <td style={{
                          padding: '9px 10px', textAlign: 'right', fontWeight: 600,
                          color: Number(b.net_income) >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                        }}>
                          {fmt(b.net_income)}
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmt(b.ar_balance)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmt(b.ap_balance)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmt(b.payroll_total)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                          <SyncBadge status={b.sync_status} />
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: 11, color: 'var(--color-ink-mid)', whiteSpace: 'nowrap' }}>
                          {b.synced_at
                            ? new Date(b.synced_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                      </tr>
                    ))}

                    {/* Totals row */}
                    <tr style={{ borderTop: '2px solid var(--color-border)', background: 'var(--color-primary-light)', fontWeight: 700 }}>
                      <td style={{ padding: '9px 10px' }}>
                        Total ({branches.length} {branches.length !== 1 ? 'branches' : 'branch'})
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmt(totals.revenue)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmt(totals.expenses)}</td>
                      <td style={{
                        padding: '9px 10px', textAlign: 'right',
                        color: totals.net_income >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                      }}>
                        {fmt(totals.net_income)}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmt(totals.ar_balance)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmt(totals.ap_balance)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmt(totals.payroll_total)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!loading && !totals && !error && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-ink-mid)', fontSize: 13 }}>
          No data available for {period}. Add branches in Settings → Multi-Branch Sync to begin.
        </div>
      )}
    </div>
  );
}
