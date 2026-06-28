import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext.jsx';

const ROLE_OPTIONS = [
  {
    key:     'standalone',
    title:   'Standalone',
    desc:    'Independent instance — no sync with any other CuentaIQ deployment.',
    warning: null,
  },
  {
    key:     'hq',
    title:   'Headquarters (HQ)',
    desc:    'Receives daily financial summaries from connected branches and shows a consolidated view.',
    warning: 'Enabling HQ mode allows branch instances to push live financial data (revenue, expenses, AR, AP, payroll) to this deployment daily. Only enable if you control the connected branches.',
  },
  {
    key:     'branch',
    title:   'Branch',
    desc:    'Sends daily financial summaries to the HQ instance. Requires HQ_SYNC_URL and HQ_SYNC_API_KEY env vars on this deployment.',
    warning: 'Branch mode pushes real financial data to the HQ daily. Confirm the HQ URL and API key are correct before enabling.',
  },
];

function SyncBadge({ status }) {
  const MAP = {
    synced:  { bg: '#dcfce7', color: '#166534', label: 'Synced' },
    pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
    stale:   { bg: '#fee2e2', color: '#991b1b', label: 'Stale'  },
    never:   { bg: '#f1f5f9', color: '#64748b', label: 'Never'  },
  };
  const s = MAP[status] || MAP.never;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px',
      borderRadius: 999, background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

export default function MultiBranchSettings() {
  const { can } = useUser();
  if (!can('admin')) return null;

  const [status,      setStatus]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [msg,         setMsg]         = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [pendingRole, setPendingRole] = useState(null);
  const [confirmed,   setConfirmed]   = useState(false);

  // Branch add modal
  const [showAdd,    setShowAdd]    = useState(false);
  const [addForm,    setAddForm]    = useState({ name: '', subdomain: '', plan: 'starter' });
  const [addResult,  setAddResult]  = useState(null);
  const [adding,     setAdding]     = useState(false);
  const [addErr,     setAddErr]     = useState(null);

  // Branch push (branch mode)
  const [pushing,    setPushing]    = useState(false);
  const [pushResult, setPushResult] = useState(null);

  // Schedule
  const [syncTime,        setSyncTime]        = useState('18:00');
  const [savingSchedule,  setSavingSchedule]  = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/branch-sync/status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setSyncTime(data.sync_time || '18:00');
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const switchRole = async (role) => {
    setSaving(true);
    try {
      const res = await fetch('/api/branch-sync/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        await load();
        setPendingRole(null);
        setConfirmed(false);
        flash('success', `Instance role set to "${role}".`);
      } else {
        const d = await res.json();
        flash('error', d.error || 'Failed to update role.');
      }
    } catch { flash('error', 'Network error.'); }
    setSaving(false);
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const res = await fetch('/api/branch-sync/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sync_time: syncTime }),
      });
      if (res.ok) flash('success', 'Sync schedule updated.');
      else flash('error', 'Failed to save schedule.');
    } catch { flash('error', 'Network error.'); }
    setSavingSchedule(false);
  };

  const deleteBranch = async (id, name) => {
    if (!window.confirm(`Remove "${name}" from the branch registry?\n\nThis will stop them from syncing to this HQ. Their own data is not affected.`)) return;
    try {
      await fetch(`/api/branch-sync/branches/${id}`, { method: 'DELETE', credentials: 'include' });
      await load();
    } catch {}
  };

  const addBranch = async () => {
    if (!addForm.name.trim() || !addForm.subdomain.trim()) { setAddErr('Name and subdomain are required.'); return; }
    setAdding(true); setAddErr(null);
    try {
      const res = await fetch('/api/branch-sync/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) { setAddErr(data.error || 'Failed to add branch.'); }
      else { setAddResult(data); await load(); }
    } catch { setAddErr('Network error.'); }
    setAdding(false);
  };

  const pushNow = async () => {
    setPushing(true); setPushResult(null);
    try {
      const res = await fetch('/api/branch-sync/push-now', { method: 'POST', credentials: 'include' });
      setPushResult(await res.json());
    } catch { setPushResult({ ok: false, reason: 'Network error.' }); }
    setPushing(false);
  };

  const openAdd = () => {
    setAddForm({ name: '', subdomain: '', plan: 'starter' });
    setAddResult(null);
    setAddErr(null);
    setShowAdd(true);
  };

  if (loading) return null;

  const role = status?.role || 'standalone';

  return (
    <div className="card mt-16" style={{ maxWidth: 640 }}>
      <div className="section-title">Multi-Branch Sync</div>
      <p style={{ fontSize: 13, color: 'var(--color-ink-mid)', marginBottom: 16 }}>
        Connect multiple CuentaIQ deployments so branches push daily financial summaries to a central HQ view.
      </p>

      {msg && (
        <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'} mb-16`}>{msg.text}</div>
      )}

      {/* ── Role picker ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
        {ROLE_OPTIONS.map(opt => {
          const isCurrent = role === opt.key;
          const isPending = pendingRole === opt.key;
          return (
            <div key={opt.key}
              onClick={() => { if (!isCurrent && !saving) { setPendingRole(opt.key); setConfirmed(false); } }}
              style={{
                border: `2px solid ${isCurrent ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 8,
                padding: '12px 14px',
                background: isCurrent ? 'var(--color-primary-light)' : 'transparent',
                cursor: (isCurrent || saving) ? 'default' : 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${isCurrent ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: isCurrent ? 'var(--color-primary)' : 'white',
                }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{opt.title}</span>
                {isCurrent && (
                  <span style={{ fontSize: 11, background: 'var(--color-primary)', color: 'white', borderRadius: 999, padding: '1px 8px' }}>
                    Active
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-ink-mid)', marginTop: 4, paddingLeft: 25 }}>
                {opt.desc}
              </div>

              {isPending && !isCurrent && (
                <div style={{ marginTop: 12, paddingLeft: 25 }} onClick={e => e.stopPropagation()}>
                  {opt.warning && (
                    <div style={{
                      background: '#fff7ed', border: '1px solid #fed7aa',
                      borderRadius: 6, padding: '9px 12px', marginBottom: 10, fontSize: 12, color: '#92400e',
                    }}>
                      ⚠ {opt.warning}
                    </div>
                  )}
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, cursor: 'pointer', marginBottom: 10 }}>
                    <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ marginTop: 2 }} />
                    <span>
                      I understand this affects financial data syncing. Switch this instance to{' '}
                      <strong>{opt.title}</strong>.
                    </span>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }}
                      onClick={() => { setPendingRole(null); setConfirmed(false); }}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" style={{ fontSize: 12 }}
                      disabled={!confirmed || saving}
                      onClick={() => { if (confirmed) switchRole(opt.key); }}>
                      {saving ? 'Saving…' : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── HQ mode: branch registry ─────────────────────────────── */}
      {role === 'hq' && (
        <div>
          <div className="divider" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Connected Branches</div>
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 14px' }} onClick={openAdd}>
              + Add Branch
            </button>
          </div>

          {status?.branches?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-ink-mid)', fontSize: 13 }}>
              No branches connected yet. Add a branch to start receiving sync data.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                    {['Branch', 'Subdomain', 'Plan', 'Last Sync', 'Status', ''].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '6px 8px',
                        fontSize: 11, fontWeight: 600, color: 'var(--color-ink-mid)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {status.branches.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 8px', fontWeight: 500 }}>{b.name}</td>
                      <td style={{ padding: '8px 8px', color: 'var(--color-ink-mid)', fontSize: 12 }}>{b.subdomain}</td>
                      <td style={{ padding: '8px 8px', textTransform: 'capitalize', fontSize: 12 }}>{b.plan}</td>
                      <td style={{ padding: '8px 8px', fontSize: 12, color: 'var(--color-ink-mid)' }}>
                        {b.synced_at
                          ? new Date(b.synced_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td style={{ padding: '8px 8px' }}><SyncBadge status={b.sync_status} /></td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                        <button className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '2px 8px', color: 'var(--color-danger)' }}
                          onClick={() => deleteBranch(b.id, b.name)}>
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

      {/* ── Branch mode: sync config ─────────────────────────────── */}
      {role === 'branch' && (
        <div>
          <div className="divider" />
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Sync Configuration</div>

          {/* Env var checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
            {[
              { label: 'HQ_SYNC_ENABLED', value: status?.hq_enabled ? 'true' : null },
              { label: 'HQ_SYNC_URL',     value: status?.hq_url || null },
              { label: 'HQ_SYNC_API_KEY', value: 'set via Railway Variables' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ color: value && value !== 'set via Railway Variables' ? 'var(--color-success)' : 'var(--color-ink-mid)', fontWeight: 700, width: 14 }}>
                  {value && value !== 'set via Railway Variables' ? '✓' : '○'}
                </span>
                <code style={{ background: 'var(--color-surface-2)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>{label}</code>
                <span style={{ color: 'var(--color-ink-mid)' }}>{value || 'not set'}</span>
              </div>
            ))}
          </div>

          {!status?.hq_enabled && (
            <div className="alert alert-error mb-16" style={{ fontSize: 12 }}>
              Set <code>HQ_SYNC_ENABLED=true</code>, <code>HQ_SYNC_URL</code>, and <code>HQ_SYNC_API_KEY</code> in Railway Variables to enable sync.
            </div>
          )}

          {/* Sync time */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Daily sync time</label>
              <input type="time" className="form-input" value={syncTime}
                onChange={e => setSyncTime(e.target.value)}
                style={{ maxWidth: 140 }} />
            </div>
            <button className="btn btn-primary" style={{ fontSize: 12 }}
              onClick={saveSchedule} disabled={savingSchedule}>
              {savingSchedule ? 'Saving…' : 'Save'}
            </button>
          </div>

          {/* Manual push */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12 }}
              onClick={pushNow} disabled={pushing || !status?.hq_enabled}>
              {pushing ? '⏳ Pushing…' : '↑ Push to HQ Now'}
            </button>
            {pushResult && (
              <span style={{ fontSize: 12, color: pushResult.ok ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {pushResult.ok
                  ? `✓ Pushed for ${pushResult.period}`
                  : (pushResult.reason || pushResult.error || 'Push failed')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Add Branch Modal ─────────────────────────────────────── */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => { if (!addResult) setShowAdd(false); }}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{addResult ? 'Branch Added' : 'Add Branch'}</div>
              <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div className="modal-body">
              {addResult ? (
                <div>
                  <div className="alert alert-success mb-12">
                    <strong>{addResult.name}</strong> added to your branch registry.
                  </div>
                  <p style={{ fontSize: 13, marginBottom: 10 }}>
                    Copy this API key and set it as <code>HQ_SYNC_API_KEY</code> in the branch's Railway Variables.{' '}
                    <strong>This key will not be shown again.</strong>
                  </p>
                  <div style={{
                    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                    borderRadius: 6, padding: '10px 12px',
                    fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', userSelect: 'all',
                  }}>
                    {addResult.api_key}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--color-ink-mid)', marginTop: 10 }}>
                    Also set <code>HQ_SYNC_URL</code> to this instance's URL and <code>HQ_SYNC_ENABLED=true</code> on the branch deployment.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {addErr && <div className="alert alert-error">{addErr}</div>}
                  <div className="form-group">
                    <label className="form-label">Branch Name *</label>
                    <input className="form-input" placeholder="e.g. Cebu Branch"
                      value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subdomain / URL *</label>
                    <input className="form-input" placeholder="e.g. cebu.cuentaiq.com"
                      value={addForm.subdomain} onChange={e => setAddForm(f => ({ ...f, subdomain: e.target.value }))} />
                    <div style={{ fontSize: 11, color: 'var(--color-ink-mid)', marginTop: 4 }}>
                      The URL where this branch's CuentaIQ is deployed
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Plan</label>
                    <select className="form-select" value={addForm.plan}
                      onChange={e => setAddForm(f => ({ ...f, plan: e.target.value }))}>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {addResult
                ? <button className="btn btn-primary" onClick={() => setShowAdd(false)}>Done</button>
                : <>
                    <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={addBranch} disabled={adding}>
                      {adding ? 'Adding…' : 'Add Branch'}
                    </button>
                  </>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
