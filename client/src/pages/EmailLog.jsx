import { useState, useEffect } from 'react';

const STATUS_STYLE = {
  sent:       { bg: '#dbeafe', color: '#1e40af', label: 'Sent' },
  delivered:  { bg: '#dcfce7', color: '#166534', label: 'Delivered' },
  failed:     { bg: '#fee2e2', color: '#991b1b', label: 'Failed' },
  bounced:    { bg: '#fee2e2', color: '#991b1b', label: 'Bounced' },
  complained: { bg: '#fef3c7', color: '#92400e', label: 'Complained' },
  suppressed: { bg: '#f1f5f9', color: '#475569', label: 'Suppressed' },
  skipped:    { bg: '#f1f5f9', color: '#64748b', label: 'Skipped' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || { bg: '#f1f5f9', color: '#64748b', label: status || '—' };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

const fmtTime = (t) => t ? new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function EmailLog() {
  const [view, setView] = useState('log'); // 'log' | 'suppressions'

  const [logs, setLogs]       = useState([]);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [loading, setLoading] = useState(true);

  const [suppressions, setSuppressions] = useState([]);
  const [newSup, setNewSup]   = useState('');
  const [msg, setMsg]         = useState(null);

  const loadLogs = () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (search) qs.set('search', search);
    fetch(`/api/email-log?${qs.toString()}`, { credentials: 'include' })
      .then(r => r.json()).then(d => setLogs(Array.isArray(d) ? d : [])).catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadSuppressions = () => {
    fetch('/api/email-log/suppressions', { credentials: 'include' })
      .then(r => r.json()).then(d => setSuppressions(Array.isArray(d) ? d : [])).catch(() => {});
  };

  useEffect(() => { loadLogs(); }, [status]);
  useEffect(() => { loadSuppressions(); }, []);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3500); };

  const addSuppression = async () => {
    if (!newSup.trim()) return;
    try {
      const res = await fetch('/api/email-log/suppressions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ email: newSup.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { flash('error', data.error || 'Failed to add.'); return; }
      setNewSup(''); loadSuppressions(); flash('success', 'Address suppressed.');
    } catch { flash('error', 'Network error.'); }
  };

  const removeSuppression = async (id, email) => {
    if (!window.confirm(`Remove ${email} from the suppression list?\n\nCuentaIQ will be able to email this address again.`)) return;
    try {
      await fetch(`/api/email-log/suppressions/${id}`, { method: 'DELETE', credentials: 'include' });
      loadSuppressions(); flash('success', 'Removed from suppression list.');
    } catch { flash('error', 'Network error.'); }
  };

  const Th = ({ children, right }) => (
    <th style={{ textAlign: right ? 'right' : 'left', padding: '7px 10px', fontSize: 11, fontWeight: 600,
      color: 'var(--color-ink-mid)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Email Log</div>
          <div className="page-subtitle">Every email CuentaIQ has sent on your behalf, with delivery status</div>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'} mb-16`}>{msg.text}</div>}

      {/* View switch */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['log', 'Sent Emails'], ['suppressions', `Suppression List${suppressions.length ? ` (${suppressions.length})` : ''}`]].map(([key, label]) => (
          <button key={key}
            className={`btn ${view === key ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            onClick={() => setView(key)}>
            {label}
          </button>
        ))}
      </div>

      {view === 'log' && (
        <div className="card">
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <input className="form-input" placeholder="Search recipient, subject, or type…"
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadLogs()}
              style={{ maxWidth: 320 }} />
            <select className="form-select" value={status} onChange={e => setStatus(e.target.value)} style={{ maxWidth: 170 }}>
              <option value="">All statuses</option>
              {['sent', 'delivered', 'failed', 'bounced', 'complained', 'suppressed', 'skipped'].map(s =>
                <option key={s} value={s}>{STATUS_STYLE[s]?.label || s}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={loadLogs}>Search</button>
          </div>

          {loading ? (
            <div style={{ color: 'var(--color-ink-mid)', fontSize: 13, padding: '12px 0' }}>Loading…</div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-ink-mid)', fontSize: 13 }}>
              No emails logged yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <Th>Sent</Th><Th>Recipient</Th><Th>Subject</Th><Th>Type</Th><Th>Status</Th><Th>Detail</Th>
                </tr></thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--color-ink-mid)', fontSize: 12 }}>{fmtTime(l.sent_at)}</td>
                      <td style={{ padding: '8px 10px' }}>{l.to_email}</td>
                      <td style={{ padding: '8px 10px' }}>{l.subject}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--color-ink-mid)', fontSize: 12 }}>{l.template || '—'}</td>
                      <td style={{ padding: '8px 10px' }}><StatusBadge status={l.status} /></td>
                      <td style={{ padding: '8px 10px', color: 'var(--color-danger)', fontSize: 12, maxWidth: 240, wordBreak: 'break-word' }}>{l.error || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'suppressions' && (
        <div className="card">
          <p style={{ fontSize: 13, color: 'var(--color-ink-mid)', lineHeight: 1.6, marginBottom: 14 }}>
            CuentaIQ will not email addresses on this list. Entries are added automatically when an email
            hard-bounces or the recipient marks it as spam. Remove an address to start emailing it again.
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input className="form-input" type="email" placeholder="Manually suppress an address…"
              value={newSup} onChange={e => setNewSup(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSuppression()}
              style={{ maxWidth: 320 }} />
            <button className="btn btn-primary btn-sm" onClick={addSuppression}>Add</button>
          </div>

          {suppressions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-ink-mid)', fontSize: 13 }}>
              No suppressed addresses. 🎉
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <Th>Email</Th><Th>Reason</Th><Th>Detail</Th><Th>Added</Th><Th right>{''}</Th>
                </tr></thead>
                <tbody>
                  {suppressions.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 500 }}>{s.email}</td>
                      <td style={{ padding: '8px 10px' }}><StatusBadge status={s.reason === 'bounced' ? 'bounced' : s.reason === 'complained' ? 'complained' : 'suppressed'} /></td>
                      <td style={{ padding: '8px 10px', color: 'var(--color-ink-mid)', fontSize: 12, maxWidth: 240, wordBreak: 'break-word' }}>{s.detail || '—'}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--color-ink-mid)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtTime(s.created_at)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }}
                          onClick={() => removeSuppression(s.id, s.email)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
