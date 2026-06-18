import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../context/UserContext.jsx';

const STATUS_COLORS = {
  pending:'#d97706', approved:'#15803d', rejected:'#dc2626', cancelled:'#64748b',
};

const fmtDate = (d) => {
  if (!d) return '—';
  const s = d.includes('T') ? d.split('T')[0] : d;
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
};

// ── Leave Type Modal ──────────────────────────────────────────────────────────
function LeaveTypeModal({ lt, onClose, onSaved }) {
  const [form, setForm] = useState(lt
    ? { ...lt, days_per_year: String(lt.days_per_year), carry_over_days: String(lt.carry_over_days) }
    : { name:'', code:'', days_per_year:'5', carry_over_days:'0', is_monetizable:false, description:'' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    if (!form.name || !form.code) return setError('Name and code are required.');
    setSaving(true); setError('');
    try {
      const res  = await fetch(lt ? `/api/leaves/types/${lt.id}` : '/api/leaves/types', {
        method: lt ? 'PUT' : 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, days_per_year: parseFloat(form.days_per_year) || 5, carry_over_days: parseInt(form.carry_over_days) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onSaved(data);
    } catch { setError('Network error.'); }
    finally   { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{lt ? 'Edit Leave Type' : 'Add Leave Type'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 12px' }}>
            <div className="form-group">
              <label className="form-label">Leave Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Vacation Leave" />
            </div>
            <div className="form-group">
              <label className="form-label">Code *</label>
              <input className="form-input" value={form.code} disabled={!!lt}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="VL" />
            </div>
            <div className="form-group">
              <label className="form-label">Days per Year</label>
              <input className="form-input" type="number" min="0" step="0.5" value={form.days_per_year}
                onChange={e => setForm(f => ({ ...f, days_per_year: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Max Carry-over Days</label>
              <input className="form-input" type="number" min="0" value={form.carry_over_days}
                onChange={e => setForm(f => ({ ...f, carry_over_days: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
              <input type="checkbox" checked={!!form.is_monetizable}
                onChange={e => setForm(f => ({ ...f, is_monetizable: e.target.checked }))} />
              <span className="form-label" style={{ margin:0 }}>Monetizable if unused at year-end</span>
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={2} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : lt ? 'Save Changes' : 'Add Leave Type'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Apply Leave Modal ─────────────────────────────────────────────────────────
function ApplyLeaveModal({ employees, leaveTypes, onClose, onFiled }) {
  const today = new Date().toISOString().split('T')[0];
  const [form,   setForm]   = useState({ employee_id:'', leave_type_id:'', start_date: today, end_date: today, days:'1', reason:'' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleFile = async () => {
    if (!form.employee_id || !form.leave_type_id || !form.start_date || !form.end_date)
      return setError('All required fields must be filled.');
    setSaving(true); setError('');
    try {
      const res  = await fetch('/api/leaves/requests', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, employee_id: parseInt(form.employee_id), leave_type_id: parseInt(form.leave_type_id) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onFiled(data);
    } catch { setError('Network error.'); }
    finally   { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">File Leave Request</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
          <div className="form-group">
            <label className="form-label">Employee *</label>
            <select className="form-input" value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}>
              <option value="">— Select Employee —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_number})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Leave Type *</label>
            <select className="form-input" value={form.leave_type_id} onChange={e => setForm(f => ({ ...f, leave_type_id: e.target.value }))}>
              <option value="">— Select Leave Type —</option>
              {leaveTypes.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 80px', gap:'0 10px' }}>
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input className="form-input" type="date" value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date *</label>
              <input className="form-input" type="date" value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Days *</label>
              <input className="form-input" type="number" min="0.5" step="0.5" value={form.days}
                onChange={e => setForm(f => ({ ...f, days: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Reason (optional)</label>
            <textarea className="form-input" rows={2} value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleFile} disabled={saving}>
            {saving ? 'Filing…' : 'File Leave'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Review Modal (approve/reject) ─────────────────────────────────────────────
function ReviewModal({ request, onClose, onReviewed }) {
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const submit = async (action) => {
    if (action === 'reject' && !note.trim()) return setError('A rejection reason is required.');
    setSaving(true); setError('');
    try {
      const res  = await fetch(`/api/leaves/requests/${request.id}/${action}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onReviewed();
    } catch { setError('Network error.'); }
    finally   { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Review Leave Request</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
          <div style={{ background:'var(--bg-secondary)', borderRadius:8, padding:'12px 14px', marginBottom:14, fontSize:13 }}>
            <div><strong>{request.first_name} {request.last_name}</strong> — {request.leave_type_name}</div>
            <div style={{ color:'var(--text-muted)', fontSize:12, marginTop:4 }}>
              {fmtDate(request.start_date)} – {fmtDate(request.end_date)} · {request.days} day(s)
            </div>
            {request.reason && <div style={{ marginTop:6, fontStyle:'italic', fontSize:12 }}>"{request.reason}"</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Note (optional for approval, required for rejection)</label>
            <textarea className="form-input" rows={2} value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-ghost btn-sm" style={{ color:'var(--danger)' }} onClick={() => submit('reject')} disabled={saving}>Reject</button>
          <button className="btn btn-primary" onClick={() => submit('approve')} disabled={saving}>
            {saving ? '…' : '✓ Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Leaves Page ──────────────────────────────────────────────────────────
export default function Leaves() {
  const { can } = useUser();
  const [tab,        setTab]        = useState('requests'); // 'requests' | 'balances' | 'types'
  const [requests,   setRequests]   = useState([]);
  const [balances,   setBalances]   = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(null); // null|'apply'|'type'|'type-edit'|'review'
  const [activeItem, setActiveItem] = useState(null);
  const [statusFilter,setStatus]    = useState('pending');
  const [yearFilter, setYear]       = useState(new Date().getFullYear());
  const [error,      setError]      = useState('');

  const currentYear = new Date().getFullYear();

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, bRes, ltRes, eRes] = await Promise.all([
        fetch(`/api/leaves/requests?status=${statusFilter}&year=${yearFilter}`, { credentials:'include' }),
        fetch(`/api/leaves/balances?year=${yearFilter}`, { credentials:'include' }),
        fetch('/api/leaves/types', { credentials:'include' }),
        fetch('/api/employees', { credentials:'include' }),
      ]);
      const [rData, bData, ltData, eData] = await Promise.all([rRes.json(), bRes.json(), ltRes.json(), eRes.json()]);
      setRequests(Array.isArray(rData) ? rData : []);
      setBalances(Array.isArray(bData) ? bData : []);
      setLeaveTypes(Array.isArray(ltData) ? ltData : []);
      setEmployees(Array.isArray(eData) ? eData.filter(e => e.is_active) : []);
    } catch { setError('Failed to load leave data.'); }
    finally  { setLoading(false); }
  }, [statusFilter, yearFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleToggleLeaveType = async (lt) => {
    const newActive = lt.is_active ? 0 : 1;
    try {
      const res = await fetch(`/api/leaves/types/${lt.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lt, is_active: newActive }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error); return; }
      setLeaveTypes(prev => prev.map(t => t.id === lt.id ? { ...t, is_active: newActive } : t));
    } catch { setError('Network error.'); }
  };

  const handleAllocate = async () => {
    if (!window.confirm(`Allocate leave balances for all active employees for ${yearFilter}? Existing allocations will not be overwritten.`)) return;
    try {
      const res  = await fetch('/api/leaves/balances/allocate', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: yearFilter }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      loadAll();
    } catch { setError('Network error.'); }
  };

  const handleCancel = async (req) => {
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      const res  = await fetch(`/api/leaves/requests/${req.id}/cancel`, { method:'PUT', credentials:'include', headers:{'Content-Type':'application/json'}, body:'{}' });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      loadAll();
    } catch { setError('Network error.'); }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div>
      {error && <div className="alert alert-error mb-16">⚠ {error}</div>}

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'2px solid var(--border)', paddingBottom:0 }}>
        {[
          { key:'requests', label:`Leave Requests${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}` },
          { key:'balances', label:'Leave Balances' },
          { key:'types',    label:'Leave Types' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'8px 18px', border:'none', background:'none', cursor:'pointer', fontWeight: tab===t.key ? 700 : 400,
              color: tab===t.key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: tab===t.key ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom:-2, fontSize:14 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Requests Tab ──────────────────────────────────────────────────────── */}
      {tab === 'requests' && (
        <div>
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            <select className="form-input" style={{ width:140 }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
              <option value="">All Statuses</option>
            </select>
            <select className="form-input" style={{ width:100 }} value={yearFilter} onChange={e => setYear(parseInt(e.target.value))}>
              {[currentYear+1, currentYear, currentYear-1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div style={{ flex:1 }} />
            <button className="btn btn-primary" onClick={() => setModal('apply')}>+ File Leave</button>
          </div>

          {loading ? <div className="page-loading">Loading…</div> : requests.length === 0 ? (
            <div className="card" style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
              No leave requests found for the selected filters.
            </div>
          ) : (
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <table className="table" style={{ fontSize:13 }}>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Leave Type</th>
                    <th>Dates</th>
                    <th style={{ textAlign:'center' }}>Days</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight:600 }}>{r.first_name} {r.last_name}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{r.department || r.employee_number}</div>
                      </td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:999,
                          background:'#dbeafe', color:'#1d4ed8' }}>{r.leave_type_code}</span>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{r.leave_type_name}</div>
                      </td>
                      <td style={{ fontSize:12 }}>
                        {fmtDate(r.start_date)}
                        {r.start_date !== r.end_date && <> – {fmtDate(r.end_date)}</>}
                      </td>
                      <td style={{ textAlign:'center', fontWeight:700 }}>{r.days}</td>
                      <td style={{ fontSize:12, color:'var(--text-muted)', maxWidth:160 }}>
                        <span style={{ display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {r.reason || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:999,
                          background: `${STATUS_COLORS[r.status]}20`, color: STATUS_COLORS[r.status] }}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                        {r.status !== 'pending' && r.reviewer_note && (
                          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>"{r.reviewer_note}"</div>
                        )}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                          {r.status === 'pending' && can('manager') && (
                            <button className="btn btn-ghost btn-sm" onClick={() => { setActiveItem(r); setModal('review'); }}>Review</button>
                          )}
                          {r.status === 'pending' && (
                            <button className="btn btn-ghost btn-sm" style={{ color:'var(--danger)' }}
                              onClick={() => handleCancel(r)}>Cancel</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Balances Tab ──────────────────────────────────────────────────────── */}
      {tab === 'balances' && (
        <div>
          <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center' }}>
            <select className="form-input" style={{ width:100 }} value={yearFilter} onChange={e => setYear(parseInt(e.target.value))}>
              {[currentYear+1, currentYear, currentYear-1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div style={{ flex:1, fontSize:13, color:'var(--text-muted)' }}>
              {balances.length === 0 ? `No balances allocated for ${yearFilter} yet.` : `${balances.length} balance record(s) for ${yearFilter}`}
            </div>
            {can('finance') && (
              <button className="btn btn-primary" onClick={handleAllocate}>
                Allocate Balances for {yearFilter}
              </button>
            )}
          </div>

          {loading ? <div className="page-loading">Loading…</div> : balances.length === 0 ? (
            <div className="card" style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
              No leave balances for {yearFilter}. Click "Allocate Balances" to set up leave entitlements.
            </div>
          ) : (
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table className="table" style={{ fontSize:12 }}>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Leave Type</th>
                      <th style={{ textAlign:'center' }}>Entitled</th>
                      <th style={{ textAlign:'center' }}>Carry-over</th>
                      <th style={{ textAlign:'center' }}>Used</th>
                      <th style={{ textAlign:'center' }}>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map(b => (
                      <tr key={b.id}>
                        <td>
                          <div style={{ fontWeight:600 }}>{b.first_name} {b.last_name}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{b.department || b.employee_number}</div>
                        </td>
                        <td>
                          <span style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:999,
                            background:'#dbeafe', color:'#1d4ed8' }}>{b.leave_type_code}</span>
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{b.leave_type_name}</div>
                        </td>
                        <td style={{ textAlign:'center' }}>{b.entitled_days}</td>
                        <td style={{ textAlign:'center', color: b.carry_over > 0 ? '#2563eb' : 'var(--text-muted)' }}>{b.carry_over}</td>
                        <td style={{ textAlign:'center', color: b.used_days > 0 ? '#d97706' : 'var(--text-muted)' }}>{b.used_days}</td>
                        <td style={{ textAlign:'center', fontWeight:700,
                          color: b.remaining_days <= 0 ? '#dc2626' : b.remaining_days <= 1 ? '#d97706' : '#15803d' }}>
                          {parseFloat(b.remaining_days).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Types Tab ─────────────────────────────────────────────────────────── */}
      {tab === 'types' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
            {can('finance') && (
              <button className="btn btn-primary" onClick={() => { setActiveItem(null); setModal('type'); }}>+ Add Leave Type</button>
            )}
          </div>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Leave Type</th>
                  <th style={{ textAlign:'center' }}>Days/Year</th>
                  <th style={{ textAlign:'center' }}>Max Carry-over</th>
                  <th style={{ textAlign:'center' }}>Monetizable</th>
                  <th>Description</th>
                  <th>STATUS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map(lt => (
                  <tr key={lt.id} style={{ opacity: lt.is_active ? 1 : 0.55 }}>
                    <td style={{ fontWeight:700, color:'#2563eb' }}>{lt.code}</td>
                    <td style={{ fontWeight:600 }}>{lt.name}</td>
                    <td style={{ textAlign:'center' }}>{lt.days_per_year}</td>
                    <td style={{ textAlign:'center' }}>{lt.carry_over_days}</td>
                    <td style={{ textAlign:'center' }}>
                      {lt.is_monetizable ? <span style={{ color:'#15803d', fontWeight:700 }}>✓</span> : <span style={{ color:'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{lt.description || '—'}</td>
                    <td>
                      <span style={{
                        display:'inline-block', fontSize:11, fontWeight:600, padding:'2px 8px',
                        borderRadius:10, background: lt.is_active ? '#dcfce7' : '#f1f5f9',
                        color: lt.is_active ? '#15803d' : '#64748b',
                      }}>
                        {lt.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {can('finance') && (
                        <div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setActiveItem(lt); setModal('type-edit'); }}>Edit</button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: lt.is_active ? '#b91c1c' : '#15803d' }}
                            onClick={() => handleToggleLeaveType(lt)}
                          >
                            {lt.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal === 'apply' && (
        <ApplyLeaveModal employees={employees} leaveTypes={leaveTypes}
          onClose={() => setModal(null)} onFiled={() => { setModal(null); loadAll(); }} />
      )}
      {(modal === 'type' || modal === 'type-edit') && (
        <LeaveTypeModal lt={modal === 'type-edit' ? activeItem : null}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); loadAll(); }} />
      )}
      {modal === 'review' && activeItem && (
        <ReviewModal request={activeItem}
          onClose={() => setModal(null)} onReviewed={() => { setModal(null); loadAll(); }} />
      )}
    </div>
  );
}
