import { useState, useEffect } from 'react';

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str + (str.includes('T') ? '' : 'Z')).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function triggerDownload(url, filename) {
  fetch(url, { credentials: 'include' })
    .then(r => r.text())
    .then(text => {
      const blob = new Blob([text], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    });
}

const ACTION_LABELS = {
  LOGIN:                       '🔐 Login',
  CREATE_ENTRY_DRAFT:          '📝 Created Draft Entry',
  SUBMIT_ENTRY_FOR_APPROVAL:   '📤 Submitted Entry for Approval',
  RECALL_ENTRY:                '↩ Recalled Entry',
  CANCEL_PENDING_ENTRY:        '✕ Cancelled Submission',
  DELETE_ENTRY_DRAFT:          '🗑 Deleted Draft Entry',
  REQUEST_ENTRY_DELETION:      '🗑 Requested Entry Deletion',
  DELETE_POSTED_ENTRY:         '🗑 Deleted Posted Entry',
  APPROVE_REQUEST:             '✓ Approved Request',
  REJECT_REQUEST:              '✕ Rejected Request',
  CREATE_RECEIVABLE:           '📥 Added AR Invoice',
  PAY_RECEIVABLE:              '💳 Recorded AR Payment',
  REQUEST_RECEIVABLE_DELETION: '🗑 Requested AR Deletion',
  CREATE_PAYABLE:              '📤 Added AP Bill',
  PAY_PAYABLE:                 '💳 Recorded AP Payment',
  REQUEST_PAYABLE_DELETION:    '🗑 Requested AP Deletion',
  CREATE_INVENTORY:            '📦 Added Inventory Item',
  UPDATE_INVENTORY:            '✏ Updated Inventory Item',
  RESTOCK_INVENTORY:           '📦 Restocked Inventory',
  DELETE_INVENTORY:            '🗑 Deleted Inventory',
  UPDATE_SETTINGS:             '⚙ Updated Settings',
  CLOSE_FISCAL_YEAR:           '📅 Closed Fiscal Year',
  IMPORT_CSV:                  '⬆ CSV Import',
};

const ROLE_COLORS = {
  staff:       '#64748b',
  manager:     '#2563eb',
  finance:     '#16a34a',
  admin:       '#7c3aed',
  super_admin: '#ea580c',
};

export default function Logs() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [filters, setFilters] = useState({ from: '', to: '', search: '' });

  const load = () => {
    setLoading(true); setError('');
    const q = new URLSearchParams();
    if (filters.from)   q.set('from',   filters.from);
    if (filters.to)     q.set('to',     filters.to);
    if (filters.search) q.set('search', filters.search);
    q.set('limit', '500');
    fetch(`/api/logs?${q}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Server error'); return r.json(); })
      .then(d => { setLogs(Array.isArray(d) ? d : []); })
      .catch(() => setError('Failed to load audit logs. Please check your connection and try again.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleExport = () => {
    const q = new URLSearchParams();
    if (filters.from) q.set('from', filters.from);
    if (filters.to)   q.set('to',   filters.to);
    triggerDownload(
      `/api/logs/export/csv?${q}`,
      `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Audit Logs</div>
          <div className="page-subtitle">Complete record of every user action in the system</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleExport}>⬇ Export CSV</button>
      </div>

      {/* Filters */}
      <div className="card mb-16" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label">Search</label>
            <input type="text" className="form-input"
              placeholder="Name, email, action, or reference…"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">From</label>
            <input type="date" className="form-input" value={filters.from}
              onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">To</label>
            <input type="date" className="form-input" value={filters.to}
              onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          </div>
          <button className="btn btn-primary" onClick={load}>Filter</button>
          <button className="btn btn-ghost" onClick={() => {
            setFilters({ from: '', to: '', search: '' });
            setTimeout(load, 50);
          }}>Clear</button>
        </div>
      </div>

      {error && <div className="alert alert-error mb-16">⚠ {error}</div>}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          Loading…
        </div>
      ) : logs.length === 0 && !error ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p>No audit logs found.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Showing {logs.length.toLocaleString()} most recent entries
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Reference</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  let details = null;
                  try { details = log.details ? JSON.parse(log.details) : null; } catch {}
                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {fmtDate(log.created_at)}
                      </td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{log.user_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.user_email}</div>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                          fontSize: 10, fontWeight: 600,
                          background: ROLE_COLORS[log.user_role] || '#64748b', color: '#fff',
                        }}>
                          {log.user_role}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {ACTION_LABELS[log.action] || log.action}
                      </td>
                      <td>
                        {log.entity_ref
                          ? <span className="td-mono" style={{ fontSize: 12 }}>{log.entity_ref}</span>
                          : <span style={{ color: 'var(--text-light)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 200 }}>
                        {details
                          ? Object.entries(details).map(([k, v]) => `${k}: ${v}`).join(' · ')
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
