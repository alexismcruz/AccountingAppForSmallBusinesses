import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import CurrencySelect from '../components/CurrencySelect.jsx';

// ── CSV download helper ───────────────────────────────────────────────────────
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

// ── Import modal ──────────────────────────────────────────────────────────────
function ImportModal({ type, onClose, onImported }) {
  const isAR = type === 'incoming';
  const endpoint = isAR ? '/api/payments/receivables' : '/api/payments/payables';
  const templateFile = isAR ? 'receivables-template.csv' : 'payables-template.csv';

  const [phase, setPhase]   = useState('pick');
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]    = useState('');

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target.result;
      setCsvText(text);
      setError('');
      setLoading(true);
      try {
        const res = await fetch(`${endpoint}/import/csv`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: text, dryRun: true }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.details ? data.details.join('\n') : data.error); }
        else { setPreview(data); setPhase('preview'); }
      } catch { setError('Network error.'); }
      finally { setLoading(false); }
    };
    reader.readAsText(file);
  };

  const handleConfirm = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${endpoint}/import/csv`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.details ? data.details.join('\n') : data.error); }
      else { setResult(data); setPhase('result'); onImported(); }
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  const label = isAR ? 'Invoices (Receivables)' : 'Bills (Payables)';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">📥 Import {label}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {phase === 'pick' && (
            <>
              <div className="alert alert-info mb-16">
                Upload a CSV file to bulk-import {isAR ? 'customer invoices' : 'supplier bills'}.
                Only <strong>pending</strong> records are imported — paid status must be updated manually.
              </div>
              {error && <div className="alert alert-error mb-16" style={{ whiteSpace: 'pre-line' }}>⚠ {error}</div>}
              <div style={{ marginBottom: 16 }}>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => triggerDownload(`${endpoint}/import/template`, templateFile)}>
                  📄 Download Template
                </button>
              </div>
              <label style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: 8,
                padding: 32, textAlign: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile({ target: { files: [f] } }); }}>
                {loading ? '⏳ Validating…' : '📂 Click to choose CSV file or drag & drop here'}
                <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFile} />
              </label>
            </>
          )}
          {phase === 'preview' && preview && (
            <div className="alert alert-success">
              ✓ File is valid — <strong>{preview.count} record{preview.count !== 1 ? 's' : ''}</strong> ready to import.
            </div>
          )}
          {phase === 'result' && result && (
            <>
              <div className="alert alert-success mb-16">
                ✓ Import complete — <strong>{result.imported}</strong> record{result.imported !== 1 ? 's' : ''} imported.
                {result.skipped > 0 && ` ${result.skipped} skipped.`}
              </div>
              {result.skippedRefs?.length > 0 && (
                <div className="text-muted text-sm">Skipped: {result.skippedRefs.join(', ')}</div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          {phase === 'pick'    && <button className="btn btn-ghost" onClick={onClose}>Cancel</button>}
          {phase === 'preview' && <>
            <button className="btn btn-ghost" onClick={() => setPhase('pick')}>← Back</button>
            <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
              {loading ? 'Importing…' : `✓ Import ${preview?.count} Record${preview?.count !== 1 ? 's' : ''}`}
            </button>
          </>}
          {phase === 'result'  && <button className="btn btn-primary" onClick={onClose}>Done</button>}
        </div>
      </div>
    </div>
  );
}

const statusBadge = (status, dueDate) => {
  const today = new Date().toISOString().split('T')[0];
  if (status === 'paid') return <span className="badge badge-success">Paid</span>;
  if (status === 'partial') return <span className="badge badge-blue">Partial</span>;
  if (dueDate && dueDate < today) return <span className="badge badge-danger">Overdue</span>;
  return <span className="badge badge-warning">Pending</span>;
};

function AddModal({ type, onClose, onSaved }) {
  const { settings } = useSettings();
  const baseCurrency = settings.currency || 'USD';
  const isAR = type === 'incoming';
  const [form, setForm] = useState({
    customer_name: '', supplier_name: '', invoice_number: '', reference_number: '',
    description: '', amount: '', due_date: '', scheduled_date: '', currency: baseCurrency, exchange_rate: '1',
  });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const name = isAR ? form.customer_name : form.supplier_name;
    if (!name || !form.amount) { setMsg('Name and amount are required.'); return; }
    setSaving(true); setMsg(null);
    try {
      const endpoint = isAR ? '/api/payments/receivables' : '/api/payments/payables';
      const body = isAR
        ? { customer_name: form.customer_name, invoice_number: form.invoice_number || `INV-${Date.now()}`, description: form.description, amount: form.amount, due_date: form.due_date || null, scheduled_date: form.scheduled_date || null, currency: form.currency, exchange_rate: parseFloat(form.exchange_rate) || 1 }
        : { supplier_name: form.supplier_name, reference_number: form.reference_number, description: form.description, amount: form.amount, due_date: form.due_date || null, scheduled_date: form.scheduled_date || null, currency: form.currency, exchange_rate: parseFloat(form.exchange_rate) || 1 };
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error); return; }
      onSaved();
      onClose();
    } catch { setMsg('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isAR ? 'Add Invoice (Incoming)' : 'Add Bill (Pending)'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {msg && <div className="alert alert-error mb-16">{msg}</div>}
          <div className="grid-2 gap-16">
            <div className="form-group">
              <label className="form-label">{isAR ? 'Customer Name *' : 'Supplier Name *'}</label>
              <input className="form-input"
                value={isAR ? form.customer_name : form.supplier_name}
                onChange={e => setForm(f => ({ ...f, [isAR ? 'customer_name' : 'supplier_name']: e.target.value }))}
                placeholder={isAR ? 'Who owes you?' : 'Who do you owe?'} />
            </div>
            <div className="form-group">
              <label className="form-label">{isAR ? 'Invoice Number' : 'Reference Number'}</label>
              <input className="form-input"
                value={isAR ? form.invoice_number : form.reference_number}
                onChange={e => setForm(f => ({ ...f, [isAR ? 'invoice_number' : 'reference_number']: e.target.value }))}
                placeholder={isAR ? 'INV-001 (auto if blank)' : 'Optional PO or ref #'} />
            </div>
            <div className="form-group">
              <label className="form-label">Amount *</label>
              <input type="number" className="form-input" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} min="0" step="0.01" placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Due Date <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(invoice terms)</span></label>
              <input type="date" className="form-input" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">
                Scheduled Payment Date
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>
                  when you plan to {isAR ? 'receive' : 'pay'}
                </span>
              </label>
              <input type="date" className="form-input" value={form.scheduled_date}
                onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Description</label>
              <input className="form-input" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What is this for?" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <CurrencySelect
                value={form.currency}
                onChange={val => setForm(f => ({ ...f, currency: val, exchange_rate: val === baseCurrency ? '1' : f.exchange_rate }))}
                rate={form.exchange_rate}
                onRateChange={val => setForm(f => ({ ...f, exchange_rate: val }))}
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function PayModal({ record, type, onClose, onSaved }) {
  const isAR = type === 'incoming';
  const remaining = record.amount - record.paid_amount;
  const [form, setForm] = useState({
    amount: remaining.toFixed(2),
    date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
  });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const handlePay = async () => {
    if (!form.reference) { setMsg('Please enter a journal entry reference number.'); return; }
    setSaving(true); setMsg(null);
    try {
      const endpoint = isAR
        ? `/api/payments/receivables/${record.id}/pay`
        : `/api/payments/payables/${record.id}/pay`;
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error); return; }
      onSaved(); onClose();
    } catch { setMsg('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Record Payment</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-info mb-16">
            {isAR
              ? `Recording payment FROM ${record.customer_name} — will Dr. Bank / Cr. Accounts Receivable.`
              : `Recording payment TO ${record.supplier_name} — will Dr. Accounts Payable / Cr. Bank.`}
          </div>
          {msg && <div className="alert alert-error mb-16">{msg}</div>}
          <div className="grid-2 gap-16">
            <div className="form-group">
              <label className="form-label">Amount to Record</label>
              <input type="number" className="form-input" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} min="0.01" step="0.01" max={remaining} />
              <div className="text-muted text-sm mt-8">Remaining: {remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Date</label>
              <input type="date" className="form-input" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Journal Entry Reference *</label>
              <input className="form-input" value={form.reference} placeholder="e.g. JE-0010"
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Notes</label>
              <input className="form-input" value={form.notes} placeholder="Optional payment notes…"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" onClick={handlePay} disabled={saving}>{saving ? 'Saving…' : '✓ Record Payment'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Payments({ tab }) {
  const { fmt, settings } = useSettings();
  const baseCurrency = settings.currency || 'USD';
  const isAR = tab === 'incoming';
  const [records, setRecords] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [payRecord, setPayRecord] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => { loadRecords(); }, [tab]);

  const loadRecords = () => {
    const endpoint = isAR ? '/api/payments/receivables' : '/api/payments/payables';
    fetch(endpoint).then(r => r.json()).then(setRecords).catch(() => {});
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    await fetch(`/api/payments/${isAR ? 'receivables' : 'payables'}/${id}`, { method: 'DELETE' });
    loadRecords();
  };

  const today = new Date().toISOString().split('T')[0];
  const pending = records.filter(r => r.status !== 'paid');
  const totalOutstanding = pending.reduce((s, r) => s + (r.amount - r.paid_amount), 0);
  const overdue = pending.filter(r => r.due_date && r.due_date < today);
  const totalOverdue = overdue.reduce((s, r) => s + (r.amount - r.paid_amount), 0);

  const exportUrl  = isAR ? '/api/payments/receivables/export/csv' : '/api/payments/payables/export/csv';
  const exportFile = isAR ? `receivables-${new Date().toISOString().split('T')[0]}.csv` : `payables-${new Date().toISOString().split('T')[0]}.csv`;

  return (
    <div>
      {showImport && <ImportModal type={tab} onClose={() => setShowImport(false)} onImported={loadRecords} />}
      <div className="page-header">
        <div>
          <div className="page-title">{isAR ? 'Incoming Payments' : 'Pending Payments'}</div>
          <div className="page-subtitle">
            {isAR ? 'Money customers owe you (Accounts Receivable)' : 'Money you owe suppliers (Accounts Payable)'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => triggerDownload(exportUrl, exportFile)}>
            ⬇ Export CSV
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(true)}>
            ⬆ Import CSV
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            {isAR ? '+ Add Invoice' : '+ Add Bill'}
          </button>
        </div>
      </div>

      <div className="grid-3 mb-20">
        <div className="stat-card" style={{ borderLeft: `4px solid ${isAR ? '#0369a1' : '#7c3aed'}` }}>
          <div className="stat-label">Total Outstanding</div>
          <div className="stat-value">{fmt(totalOutstanding)}</div>
          <div className="stat-sub">{pending.length} open record{pending.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: `4px solid ${totalOverdue > 0 ? '#b91c1c' : 'var(--border)'}` }}>
          <div className="stat-label">Overdue</div>
          <div className="stat-value" style={{ color: totalOverdue > 0 ? 'var(--danger)' : 'inherit' }}>{fmt(totalOverdue)}</div>
          <div className="stat-sub">{overdue.length} overdue record{overdue.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-label">Paid (Total Records)</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {records.filter(r => r.status === 'paid').length}
          </div>
          <div className="stat-sub">of {records.length} total</div>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'} mb-16`}>{msg.text}</div>}

      <div className="card">
        {records.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{isAR ? '📥' : '📤'}</div>
            <p>No {isAR ? 'invoices' : 'bills'} recorded yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{isAR ? 'Customer' : 'Supplier'}</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th className="td-right">Amount</th>
                  <th>Currency</th>
                  <th className="td-right">Paid</th>
                  <th className="td-right">Balance</th>
                  <th>Due Date</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.map(rec => {
                  const balance = rec.amount - rec.paid_amount;
                  return (
                    <tr key={rec.id}>
                      <td style={{ fontWeight: 500 }}>{isAR ? rec.customer_name : rec.supplier_name}</td>
                      <td className="td-mono text-muted">{rec.invoice_number || rec.reference_number || '—'}</td>
                      <td className="text-muted">{rec.description || '—'}</td>
                      <td className="td-right tabular">{fmt(rec.amount)}</td>
                      <td>
                        {rec.currency && rec.currency !== baseCurrency
                          ? <span className="badge badge-info">{rec.currency}</span>
                          : <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{rec.currency || baseCurrency}</span>}
                      </td>
                      <td className="td-right tabular text-muted">{rec.paid_amount > 0 ? fmt(rec.paid_amount) : '—'}</td>
                      <td className="td-right tabular" style={{ fontWeight: balance > 0 ? 600 : 400 }}>{fmt(balance)}</td>
                      <td className={rec.due_date && rec.due_date < today && rec.status !== 'paid' ? 'text-danger' : 'text-muted'}>
                        {rec.due_date ? new Date(rec.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ color: rec.scheduled_date && rec.scheduled_date < today && rec.status !== 'paid' ? 'var(--danger)' : 'var(--text-muted)', fontSize: 12 }}>
                        {rec.scheduled_date
                          ? <>📅 {new Date(rec.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                          : <span style={{ color: 'var(--text-light)' }}>—</span>}
                      </td>
                      <td>{statusBadge(rec.status, rec.due_date)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {rec.status !== 'paid' && (
                            <button className="btn btn-success btn-sm" onClick={() => setPayRecord(rec)}>
                              ✓ Pay
                            </button>
                          )}
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', borderColor: 'transparent' }}
                            onClick={() => handleDelete(rec.id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && <AddModal type={tab} onClose={() => setShowAdd(false)} onSaved={loadRecords} />}
      {payRecord && <PayModal record={payRecord} type={tab} onClose={() => setPayRecord(null)} onSaved={loadRecords} />}
    </div>
  );
}
