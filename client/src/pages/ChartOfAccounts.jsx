import { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext.jsx';

const TYPES = ['Asset','Liability','Equity','Revenue','COGS','Expense'];
const TYPE_COLORS = {
  Asset:'#2563eb', Liability:'#dc2626', Equity:'#7c3aed',
  Revenue:'#15803d', COGS:'#d97706', Expense:'#64748b',
};
const NB_LABELS = { Debit:'Debit (↑ increase)', Credit:'Credit (↑ increase)' };

const EMPTY_FORM = { code:'', name:'', type:'Asset', normal_balance:'Debit', description:'' };

// ── Account Modal ─────────────────────────────────────────────────────────────
function AccountModal({ account, onClose, onSaved }) {
  const [form,   setForm]   = useState(account ? { ...account } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const isEdit = !!account;

  // Auto-set normal_balance based on type
  const handleTypeChange = (type) => {
    const defaultNB = ['Asset','COGS','Expense'].includes(type) ? 'Debit' : 'Credit';
    setForm(f => ({ ...f, type, normal_balance: defaultNB }));
  };

  const handleSave = async () => {
    if (!form.code || !form.name) return setError('Account code and name are required.');
    setSaving(true); setError('');
    try {
      const res  = await fetch(isEdit ? `/api/accounts/${account.id}` : '/api/accounts', {
        method: isEdit ? 'PUT' : 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Save failed'); return; }
      onSaved(data);
    } catch { setError('Network error.'); }
    finally   { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Account' : 'Add Account'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 12px' }}>
            <div className="form-group">
              <label className="form-label">Account Code *</label>
              <input className="form-input" value={form.code} disabled={isEdit}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. 1050" />
            </div>
            <div className="form-group">
              <label className="form-label">Account Type *</label>
              <select className="form-input" value={form.type} onChange={e => handleTypeChange(e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Account Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Normal Balance</label>
            <select className="form-input" value={form.normal_balance} onChange={e => setForm(f => ({ ...f, normal_balance: e.target.value }))}>
              <option value="Debit">Debit (Assets, COGS, Expenses)</option>
              <option value="Credit">Credit (Liabilities, Equity, Revenue)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={2} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          {!isEdit && (
            <div className="alert alert-info" style={{ fontSize:12 }}>
              ℹ Accounts require Finance approval before appearing in journal entry dropdowns.
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CSV Import Modal ──────────────────────────────────────────────────────────
function ImportModal({ onClose, onImported }) {
  const [csv,     setCsv]     = useState('');
  const [preview, setPreview] = useState(null);
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const fileRef = useRef();

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsv(ev.target.result);
    reader.readAsText(f);
  };

  const handlePreview = async () => {
    if (!csv.trim()) return setError('Paste CSV text or upload a file first.');
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/accounts/import/csv', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setPreview(data);
    } catch { setError('Network error.'); }
    finally   { setLoading(false); }
  };

  const handleImport = async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/accounts/import/csv', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data);
      onImported();
    } catch { setError('Network error.'); }
    finally   { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Import Chart of Accounts (CSV)</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
          {result ? (
            <div className="alert alert-success">
              ✓ Imported {result.imported} account(s).
              {result.skipped > 0 && ` Skipped ${result.skipped}: ${result.skippedRefs?.join(', ')}`}
              {result.pendingApproval && ' — Accounts are pending Finance approval.'}
            </div>
          ) : (
            <>
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>📁 Upload CSV</button>
                <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }} onChange={handleFile} />
                <a href="/api/accounts/import/template" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>⬇ Template</a>
              </div>
              <textarea className="form-input" rows={8} style={{ fontFamily:'monospace', fontSize:12 }}
                placeholder={'code,name,type,normal_balance,description\n8000,Other Asset,Asset,Debit,Description here'}
                value={csv} onChange={e => setCsv(e.target.value)} />
              {preview && (
                <div className="alert alert-info mt-8" style={{ fontSize:12 }}>
                  ✓ Validated {preview.count} row(s) — ready to import.
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{result ? 'Close' : 'Cancel'}</button>
          {!result && (
            <>
              <button className="btn btn-ghost" onClick={handlePreview} disabled={loading}>Validate</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={loading || !preview}>
                {loading ? 'Importing…' : 'Import'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ChartOfAccounts() {
  const { can } = useUser();
  const [accounts, setAccounts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null); // null | 'add' | account
  const [importOpen,setImport]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatus]   = useState('active');
  const [error,    setError]    = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/accounts/manage', { credentials: 'include' });
      setAccounts(await res.json());
    } catch { setError('Failed to load accounts.'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSaved = () => { setModal(null); load(); };
  const handleImported = () => { load(); };

  const handleDeactivate = async (acc) => {
    if (!window.confirm(`Deactivate account ${acc.code} — ${acc.name}?`)) return;
    try {
      const res  = await fetch(`/api/accounts/${acc.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      load();
    } catch { setError('Network error.'); }
  };

  const handleReactivate = async (acc) => {
    try {
      const res  = await fetch(`/api/accounts/${acc.id}/reactivate`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      load();
    } catch { setError('Network error.'); }
  };

  const handleRecall = async (acc) => {
    try {
      const res  = await fetch(`/api/accounts/${acc.id}/recall`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      load();
    } catch { setError('Network error.'); }
  };

  const filtered = accounts.filter(a => {
    const matchType   = typeFilter === 'All' || a.type === typeFilter;
    const matchStatus = statusFilter === 'all'
      ? true
      : statusFilter === 'active'   ? (a.is_active && !a.pending_approval && !a.pending_deletion)
      : statusFilter === 'pending'  ? (a.pending_approval || a.pending_deletion)
      : statusFilter === 'inactive' ? !a.is_active
      : true;
    const q = search.toLowerCase();
    const matchSearch = !q || `${a.code} ${a.name} ${a.type} ${a.description || ''}`.toLowerCase().includes(q);
    return matchType && matchStatus && matchSearch;
  });

  const grouped = TYPES.reduce((acc, t) => {
    acc[t] = filtered.filter(a => a.type === t);
    return acc;
  }, {});

  const counts = TYPES.reduce((acc, t) => {
    acc[t] = accounts.filter(a => a.type === t && a.is_active && !a.pending_approval).length;
    return acc;
  }, {});

  const pendingCount = accounts.filter(a => a.pending_approval || a.pending_deletion).length;

  return (
    <div>
      {error && <div className="alert alert-error mb-16">⚠ {error}</div>}

      {/* Summary chips */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        {TYPES.map(t => (
          <div key={t} className="card" style={{ padding:'10px 16px', display:'flex', alignItems:'center', gap:10 }}>
            <div>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>{t}</div>
              <div style={{ fontSize:18, fontWeight:700, color: TYPE_COLORS[t] }}>{counts[t]}</div>
            </div>
          </div>
        ))}
        {pendingCount > 0 && (
          <div className="card" style={{ padding:'10px 16px', background:'#fffbeb', border:'1px solid #fbbf24' }}>
            <div style={{ fontSize:10, color:'#92400e', marginBottom:2 }}>Pending Approval</div>
            <div style={{ fontSize:18, fontWeight:700, color:'#d97706' }}>{pendingCount}</div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input className="form-input" style={{ flex:1, minWidth:200 }}
          placeholder="Search code, name, description…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-input" style={{ width:140 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="All">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="form-input" style={{ width:140 }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
        {can('finance') && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setImport(true)}>⬆ Import CSV</button>
            <a href="/api/accounts/export/csv" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>⬇ Export CSV</a>
            <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Account</button>
          </>
        )}
      </div>

      {loading ? <div className="page-loading">Loading accounts…</div> : (
        TYPES.map(type => {
          const rows = grouped[type];
          if (!rows || rows.length === 0) return null;
          return (
            <div key={type} className="card" style={{ padding:0, overflow:'hidden', marginBottom:12 }}>
              <div style={{ padding:'10px 16px', background: `${TYPE_COLORS[type]}15`,
                            borderBottom:`2px solid ${TYPE_COLORS[type]}`, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontWeight:700, fontSize:13, color: TYPE_COLORS[type] }}>{type}</span>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>{rows.length} account{rows.length!==1?'s':''}</span>
              </div>
              <table className="table" style={{ fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={{ width:90 }}>Code</th>
                    <th>Name</th>
                    <th style={{ width:80 }}>Normal Bal.</th>
                    <th>Description</th>
                    <th style={{ width:90 }}>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(acc => (
                    <tr key={acc.id} style={{ opacity: acc.is_active ? 1 : 0.55 }}>
                      <td style={{ fontWeight:700, color: TYPE_COLORS[acc.type], fontSize:13 }}>{acc.code}</td>
                      <td style={{ fontWeight:500 }}>{acc.name}</td>
                      <td>
                        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:999,
                          background: acc.normal_balance==='Debit' ? '#dbeafe' : '#dcfce7',
                          color: acc.normal_balance==='Debit' ? '#1d4ed8' : '#15803d' }}>
                          {acc.normal_balance}
                        </span>
                      </td>
                      <td style={{ color:'var(--text-muted)', maxWidth:260 }}>
                        <span style={{ display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {acc.description || '—'}
                        </span>
                      </td>
                      <td>
                        {acc.pending_approval ? (
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:999, background:'#fef3c7', color:'#92400e', fontWeight:600 }}>⏳ Pending</span>
                        ) : acc.pending_deletion ? (
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:999, background:'#fee2e2', color:'#dc2626', fontWeight:600 }}>🗑 Del. Pending</span>
                        ) : acc.is_active ? (
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:999, background:'#d1fae5', color:'#15803d', fontWeight:600 }}>Active</span>
                        ) : (
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:999, background:'#f1f5f9', color:'#64748b', fontWeight:600 }}>Inactive</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                          {can('finance') && acc.is_active && !acc.pending_approval && !acc.pending_deletion && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setModal(acc)}>Edit</button>
                          )}
                          {can('finance') && acc.is_active && !acc.pending_approval && !acc.pending_deletion && (
                            <button className="btn btn-ghost btn-sm" style={{ color:'var(--danger)' }}
                              onClick={() => handleDeactivate(acc)}>Deactivate</button>
                          )}
                          {can('finance') && !acc.is_active && (
                            <button className="btn btn-ghost btn-sm" style={{ color:'var(--success)' }}
                              onClick={() => handleReactivate(acc)}>Reactivate</button>
                          )}
                          {acc.pending_approval && acc.created_by_email === 'you' && (
                            <button className="btn btn-ghost btn-sm" style={{ color:'var(--danger)' }}
                              onClick={() => handleRecall(acc)}>Recall</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}

      {modal && (
        <AccountModal
          account={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {importOpen && (
        <ImportModal onClose={() => setImport(false)} onImported={() => { setImport(false); handleImported(); }} />
      )}
    </div>
  );
}
