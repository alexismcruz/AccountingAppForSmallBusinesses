import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useUser }     from '../context/UserContext.jsx';

const PAY_FREQ = { semi_monthly: 'Semi-monthly', monthly: 'Monthly' };

const fmtDate = (d) => {
  if (!d) return '—';
  const s = d.includes('T') ? d.split('T')[0] : d;
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function triggerDownload(url, filename) {
  fetch(url, { credentials: 'include' })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    });
}

// ── Create Period Modal ───────────────────────────────────────────────────────
function CreatePeriodModal({ onClose, onCreated }) {
  const today = new Date().toISOString().split('T')[0];
  const [form,   setForm]   = useState({ period_start: '', period_end: '', pay_date: today, pay_frequency: 'semi_monthly', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleCreate = async () => {
    if (!form.period_start || !form.period_end || !form.pay_date)
      return setError('Period start, end, and pay date are required.');
    setSaving(true); setError('');
    try {
      const res  = await fetch('/api/payroll/periods', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onCreated(data);
    } catch { setError('Network error.'); }
    finally   { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">New Payroll Run</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
          <div className="alert alert-info mb-16" style={{ fontSize: 12 }}>
            All active employees will be included automatically with computed SSS, PhilHealth, Pag-IBIG, and withholding tax. You can adjust individual entries after creating the run.
          </div>
          <div className="form-group">
            <label className="form-label">Pay Frequency</label>
            <select className="form-input" value={form.pay_frequency} onChange={e => setForm(f => ({ ...f, pay_frequency: e.target.value }))}>
              {Object.entries(PAY_FREQ).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div className="form-group">
              <label className="form-label">Period Start *</label>
              <input className="form-input" type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Period End *</label>
              <input className="form-input" type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Pay Date *</label>
            <input className="form-input" type="date" value={form.pay_date} onChange={e => setForm(f => ({ ...f, pay_date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <input className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : 'Create Payroll Run'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Entry Modal ──────────────────────────────────────────────────────────
function EditEntryModal({ entry, onClose, onSaved }) {
  const { settings } = useSettings();
  const sym = settings.currency_symbol || '₱';
  const fmt = (v) => `${sym}${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [form,   setForm]   = useState({
    overtime_pay:     String(entry.overtime_pay   || ''),
    holiday_pay:      String(entry.holiday_pay    || ''),
    allowances:       String(entry.allowances     || ''),
    other_deductions: String(entry.other_deductions || ''),
    notes:            entry.notes || '',
  });
  const [preview, setPreview] = useState(entry);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const res  = await fetch(`/api/payroll/entries/${entry.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overtime_pay:     parseFloat(form.overtime_pay)     || 0,
          holiday_pay:      parseFloat(form.holiday_pay)      || 0,
          allowances:       parseFloat(form.allowances)       || 0,
          other_deductions: parseFloat(form.other_deductions) || 0,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onSaved(data);
    } catch { setError('Network error.'); }
    finally   { setSaving(false); }
  };

  const NumField = ({ label, k }) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type="number" min="0" step="0.01"
        value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
    </div>
  );

  const Row = ({ label, value, bold, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  );

  const name = `${entry.first_name} ${entry.last_name}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Adjust Entry — {name}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Adjustments</div>
              <NumField label="Overtime Pay" k="overtime_pay" />
              <NumField label="Holiday Pay" k="holiday_pay" />
              <NumField label="Allowances" k="allowances" />
              <NumField label="Other Deductions" k="other_deductions" />
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Current Computation</div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px' }}>
                <Row label="Basic Pay"         value={fmt(entry.basic_pay)} />
                <Row label="Gross Pay"         value={fmt(entry.gross_pay)} bold />
                <div style={{ height: 6 }} />
                <Row label="SSS (employee)"        value={`−${fmt(entry.sss_employee)}`}        color="#dc2626" />
                <Row label={`SSS MSC: ${sym}${(entry.sss_msc||0).toLocaleString()}`} value="" />
                <Row label="PhilHealth (employee)" value={`−${fmt(entry.philhealth_employee)}`} color="#dc2626" />
                <Row label="Pag-IBIG (employee)"   value={`−${fmt(entry.pagibig_employee)}`}   color="#dc2626" />
                <Row label="Withholding Tax"        value={`−${fmt(entry.wtax)}`}               color="#dc2626" />
                <Row label="Total Deductions"       value={`−${fmt(entry.total_deductions)}`}   bold color="#dc2626" />
                <div style={{ height: 6 }} />
                <Row label="Net Pay" value={fmt(entry.net_pay)} bold color="#15803d" />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                Save adjustments to recalculate all figures including government contributions and withholding tax.
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save & Recalculate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Payroll Page ─────────────────────────────────────────────────────────
export default function Payroll() {
  const { settings } = useSettings();
  const { can }      = useUser();
  const sym = settings.currency_symbol || '₱';
  const fmt = (v) => `${sym}${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [periods,      setPeriods]      = useState([]);
  const [selected,     setSelected]     = useState(null); // full period with entries
  const [loading,      setLoading]      = useState(true);
  const [detailLoading,setDetailLoading]= useState(false);
  const [showCreate,   setShowCreate]   = useState(false);
  const [editEntry,    setEditEntry]    = useState(null);
  const [error,        setError]        = useState('');
  const [posting,      setPosting]      = useState(false);

  const loadPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/periods', { credentials: 'include' });
      setPeriods(await res.json());
    } catch { setError('Failed to load payroll periods.'); }
    finally  { setLoading(false); }
  }, []);

  const loadPeriod = async (id) => {
    setDetailLoading(true);
    try {
      const res  = await fetch(`/api/payroll/periods/${id}`, { credentials: 'include' });
      const data = await res.json();
      setSelected(data);
    } catch { setError('Failed to load period detail.'); }
    finally  { setDetailLoading(false); }
  };

  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  const handleCreated = (period) => {
    setShowCreate(false);
    loadPeriods();
    loadPeriod(period.id);
  };

  const handlePost = async () => {
    if (!selected) return;
    setPosting(true);
    try {
      const res  = await fetch(`/api/payroll/periods/${selected.id}/post`, { method: 'PUT', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      loadPeriods();
      loadPeriod(selected.id);
    } catch { setError('Network error.'); }
    finally   { setPosting(false); }
  };

  const handleDelete = async () => {
    if (!selected || !window.confirm('Delete this draft payroll run?')) return;
    try {
      await fetch(`/api/payroll/periods/${selected.id}`, { method: 'DELETE', credentials: 'include' });
      setSelected(null);
      loadPeriods();
    } catch { setError('Network error.'); }
  };

  const handleEntrySaved = (updatedEntry) => {
    setEditEntry(null);
    if (selected) loadPeriod(selected.id);
  };

  const entries = selected?.entries || [];
  const totals  = entries.reduce((acc, e) => {
    acc.gross    += e.gross_pay;
    acc.sssEe    += e.sss_employee;
    acc.sssEr    += e.sss_employer;
    acc.phEe     += e.philhealth_employee;
    acc.phEr     += e.philhealth_employer;
    acc.piEe     += e.pagibig_employee;
    acc.piEr     += e.pagibig_employer;
    acc.wtax     += e.wtax;
    acc.otherDed += e.other_deductions;
    acc.net      += e.net_pay;
    return acc;
  }, { gross: 0, sssEe: 0, sssEr: 0, phEe: 0, phEr: 0, piEe: 0, piEr: 0, wtax: 0, otherDed: 0, net: 0 });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>

      {/* ── LEFT: Period list ──────────────────────────────────────────────── */}
      <div>
        {can('finance') && (
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 12 }}
            onClick={() => setShowCreate(true)}>
            + New Payroll Run
          </button>
        )}
        {error && <div className="alert alert-error mb-12" style={{ fontSize: 12 }}>⚠ {error}</div>}
        {loading ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div> : periods.length === 0 ? (
          <div className="card" style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            No payroll runs yet.
          </div>
        ) : periods.map(p => (
          <div key={p.id}
            onClick={() => loadPeriod(p.id)}
            className="card"
            style={{
              padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
              border: selected?.id === p.id ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: selected?.id === p.id ? '#eff6ff' : '#fff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {fmtDate(p.period_start)} – {fmtDate(p.period_end)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Pay Date: {fmtDate(p.pay_date)} · {p.employee_count} employee{p.employee_count !== 1 ? 's' : ''}
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                background: p.status === 'posted' ? '#d1fae5' : '#fef3c7',
                color: p.status === 'posted' ? '#15803d' : '#92400e',
              }}>
                {p.status === 'posted' ? 'Posted' : 'Draft'}
              </span>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: '#2563eb' }}>
              Net: {fmt(p.total_net_pay)}
            </div>
          </div>
        ))}
      </div>

      {/* ── RIGHT: Period detail ───────────────────────────────────────────── */}
      <div>
        {!selected ? (
          <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            Select a payroll run to view details, or create a new one.
          </div>
        ) : detailLoading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <>
            {/* Period header */}
            <div className="card" style={{ padding: '14px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {fmtDate(selected.period_start)} – {fmtDate(selected.period_end)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {PAY_FREQ[selected.pay_frequency]} · Pay Date: {fmtDate(selected.pay_date)}
                    {selected.notes && ` · ${selected.notes}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selected.status === 'draft' && can('finance') && (
                    <>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={handleDelete}>
                        Delete Draft
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={handlePost} disabled={posting}>
                        {posting ? 'Posting…' : '✓ Post Payroll'}
                      </button>
                    </>
                  )}
                  {selected.status === 'posted' && (
                    <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>✓ Posted</span>
                  )}
                </div>
              </div>

              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 14 }}>
                {[
                  { label: 'Gross Payroll', value: fmt(totals.gross), color: '#2563eb' },
                  { label: 'SSS (employer)', value: fmt(totals.sssEr), color: '#64748b' },
                  { label: 'PhilHealth (employer)', value: fmt(totals.phEr), color: '#64748b' },
                  { label: 'Net Payroll', value: fmt(totals.net), color: '#15803d' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Entries table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th style={{ textAlign: 'right' }}>Basic Pay</th>
                      <th style={{ textAlign: 'right' }}>Gross Pay</th>
                      <th style={{ textAlign: 'right' }}>SSS</th>
                      <th style={{ textAlign: 'right' }}>PhilHealth</th>
                      <th style={{ textAlign: 'right' }}>Pag-IBIG</th>
                      <th style={{ textAlign: 'right' }}>W. Tax</th>
                      <th style={{ textAlign: 'right' }}>Net Pay</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(e => (
                      <tr key={e.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{e.first_name} {e.last_name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{e.position || e.employee_number}</div>
                        </td>
                        <td style={{ textAlign: 'right' }}>{fmt(e.basic_pay)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(e.gross_pay)}</td>
                        <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmt(e.sss_employee)}</td>
                        <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmt(e.philhealth_employee)}</td>
                        <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmt(e.pagibig_employee)}</td>
                        <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmt(e.wtax)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>{fmt(e.net_pay)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            {selected.status === 'draft' && can('finance') && (
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditEntry(e)}>Adjust</button>
                            )}
                            <button className="btn btn-ghost btn-sm"
                              onClick={() => triggerDownload(`/api/payroll/entries/${e.id}/payslip`, `Payslip-${e.employee_number}-${selected.period_start}.pdf`)}>
                              📄 Payslip
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals row */}
                  <tfoot>
                    <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                      <td>TOTALS ({entries.length} employees)</td>
                      <td style={{ textAlign: 'right' }}>{fmt(entries.reduce((s, e) => s + e.basic_pay, 0))}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(totals.gross)}</td>
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmt(totals.sssEe)}</td>
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmt(totals.phEe)}</td>
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmt(totals.piEe)}</td>
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmt(totals.wtax)}</td>
                      <td style={{ textAlign: 'right', color: '#15803d' }}>{fmt(totals.net)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {showCreate && <CreatePeriodModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {editEntry  && <EditEntryModal   entry={editEntry} onClose={() => setEditEntry(null)} onSaved={handleEntrySaved} />}
    </div>
  );
}
