import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useUser } from '../context/UserContext.jsx';
import CurrencySelect from '../components/CurrencySelect.jsx';
import AmountInput from '../components/AmountInput.jsx';
import CharCount from '../components/CharCount.jsx';

// ── Download helpers ──────────────────────────────────────────────────────────
function triggerDownload(url, filename) {
  // For text-based files (CSV) — reads as text to preserve encoding
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

function triggerBinaryDownload(url, filename, mimeType = 'application/pdf') {
  // For binary files (PDF, images) — must use blob(), not text()
  fetch(url, { credentials: 'include' })
    .then(r => r.blob())
    .then(blob => {
      const typedBlob = new Blob([blob], { type: mimeType });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(typedBlob);
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

const statusBadge = (rec) => {
  if (rec.pending_approval) return <span className="badge badge-info">Pending Approval</span>;
  if (rec.pending_deletion) return <span className="badge badge-warning">Pending Deletion</span>;
  const today = new Date().toISOString().split('T')[0];
  if (rec.status === 'paid')    return <span className="badge badge-success">Paid</span>;
  if (rec.status === 'partial') return <span className="badge badge-blue">Partial</span>;
  if (rec.due_date && rec.due_date < today) return <span className="badge badge-danger">Overdue</span>;
  return <span className="badge badge-warning">Pending</span>;
};

function AddModal({ type, onClose, onSaved }) {
  const { settings } = useSettings();
  const baseCurrency = settings.currency || 'PHP';
  const isAR = type === 'incoming';
  const [form, setForm] = useState({
    customer_name: '', supplier_name: '', invoice_number: '', reference_number: '',
    description: '', amount: '', due_date: '', scheduled_date: '', currency: baseCurrency, exchange_rate: '1',
    submitter_note: '',
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
        ? { customer_name: form.customer_name, invoice_number: form.invoice_number || `INV-${Date.now()}`, description: form.description, amount: form.amount, due_date: form.due_date || null, scheduled_date: form.scheduled_date || null, currency: form.currency, exchange_rate: parseFloat(form.exchange_rate) || 1, submitter_note: form.submitter_note || null }
        : { supplier_name: form.supplier_name, reference_number: form.reference_number, description: form.description, amount: form.amount, due_date: form.due_date || null, scheduled_date: form.scheduled_date || null, currency: form.currency, exchange_rate: parseFloat(form.exchange_rate) || 1, submitter_note: form.submitter_note || null };
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
                maxLength={100}
                onChange={e => setForm(f => ({ ...f, [isAR ? 'customer_name' : 'supplier_name']: e.target.value }))}
                placeholder={isAR ? 'Who owes you?' : 'Who do you owe?'} />
              <CharCount value={isAR ? form.customer_name : form.supplier_name} max={100} />
            </div>
            <div className="form-group">
              <label className="form-label">{isAR ? 'Invoice Number' : 'Reference Number'}</label>
              <input className="form-input"
                value={isAR ? form.invoice_number : form.reference_number}
                maxLength={50}
                onChange={e => setForm(f => ({ ...f, [isAR ? 'invoice_number' : 'reference_number']: e.target.value }))}
                placeholder={isAR ? 'INV-001 (auto if blank)' : 'Optional PO or ref #'} />
              <CharCount value={isAR ? form.invoice_number : form.reference_number} max={50} />
            </div>
            <div className="form-group">
              <label className="form-label">Amount *</label>
              <AmountInput
                value={form.amount}
                onChange={val => setForm(f => ({ ...f, amount: val }))}
                placeholder="0.00"
              />
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
                maxLength={255}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What is this for?" />
              <CharCount value={form.description} max={255} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <CurrencySelect
                value={form.currency}
                onChange={val => setForm(f => ({ ...f, currency: val, exchange_rate: val === baseCurrency ? '1' : f.exchange_rate }))}
                rate={form.exchange_rate}
                onRateChange={val => setForm(f => ({ ...f, exchange_rate: val }))}
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Note to Approver <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
              <textarea className="form-textarea" rows={2} value={form.submitter_note}
                onChange={e => setForm(f => ({ ...f, submitter_note: e.target.value }))}
                placeholder="Any context for the reviewer…" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Submitting…' : 'Submit for Approval'}</button>
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
              <AmountInput
                value={form.amount}
                onChange={val => setForm(f => ({ ...f, amount: val }))}
                placeholder="0.00"
              />
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

// ── Apply Tax Modal ───────────────────────────────────────────────────────────
function ApplyTaxModal({ record, entityType, onClose, onApplied }) {
  const { fmt, settings } = useSettings();
  const businessType = settings.business_type || 'corporate';
  const [taxRates,   setTaxRates]   = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [baseAmount, setBaseAmount] = useState(String(record.amount));
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    fetch('/api/tax/rates', { credentials: 'include' })
      .then(r => r.json())
      .then(rates => {
        const isIndividual = ['sole_proprietorship', 'mixed_income'].includes(businessType);
        const filtered = rates.filter(r => {
          if (!r.is_active) return false;
          if (r.applies_to !== 'both' && r.applies_to !== entityType) return false;
          // Filter by business type: 'all' shows for everyone, 'corporate' only for corps,
          // 'individual' only for sole prop / mixed income
          const btf = r.business_type_filter || 'all';
          if (btf === 'corporate'  && businessType !== 'corporate') return false;
          if (btf === 'individual' && !isIndividual)                return false;
          return true;
        });
        setTaxRates(filtered);
        if (filtered.length === 1) setSelectedId(String(filtered[0].id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [entityType]);

  const selectedRate = taxRates.find(r => String(r.id) === selectedId);
  const base = parseFloat(baseAmount) || 0;

  // Mirror server-side computeTax for preview
  let previewTax = 0;
  if (selectedRate && base > 0) {
    const exempt  = parseFloat(selectedRate.exempt_threshold) || 0;
    const taxable = Math.max(0, base - exempt);
    if (selectedRate.type === 'percentage') {
      const rate = parseFloat(selectedRate.rate) || 0;
      previewTax = selectedRate.is_inclusive
        ? taxable * rate / (100 + rate)
        : taxable * rate / 100;
    } else if (selectedRate.type === 'fixed_amount') {
      previewTax = taxable > 0 ? (parseFloat(selectedRate.amount) || 0) : 0;
    } else if (selectedRate.type === 'tiered') {
      const sorted = [...(selectedRate.tiers || [])].sort((a, b) => (parseFloat(a.min)||0) - (parseFloat(b.min)||0));
      let tax = 0;
      for (const tier of sorted) {
        const tMin = parseFloat(tier.min) || 0;
        const tMax = tier.max != null && tier.max !== '' ? parseFloat(tier.max) : Infinity;
        if (taxable <= tMin) break;
        tax += (Math.min(taxable, tMax) - tMin) * (parseFloat(tier.rate) || 0) / 100;
      }
      previewTax = tax;
    }
    previewTax = Math.round(previewTax * 100) / 100;
  }

  const handleApply = async () => {
    if (!selectedId) return setError('Please select a tax rate.');
    if (!base)       return setError('Base amount must be greater than zero.');
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/tax/applications', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tax_rate_id: parseInt(selectedId),
          entity_type: entityType,
          entity_id:   record.id,
          base_amount: base,
          notes:       notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onApplied(data);
      onClose();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  const name = entityType === 'receivable' ? record.customer_name : record.supplier_name;
  const ref  = record.invoice_number || record.reference_number || `#${record.id}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">🧾 Apply Tax</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-info mb-16">
            Applying tax to <strong>{ref}</strong> — {name}
          </div>
          {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading tax rates…</div>
          ) : taxRates.length === 0 ? (
            <div className="alert alert-warning">
              No active tax rates available for {entityType === 'receivable' ? 'sales' : 'purchases'}.
              Go to <strong>Tax → Tax Rates</strong> to set some up first.
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Tax Rate *</label>
                <select className="form-select" value={selectedId}
                  onChange={e => setSelectedId(e.target.value)}>
                  <option value="">— Select a tax rate —</option>
                  {taxRates.map(r => (
                    <option key={r.id} value={String(r.id)}>
                      {r.name} ({r.code}) —{' '}
                      {r.type === 'percentage' ? `${r.rate}%` : r.type === 'fixed_amount' ? fmt(r.amount) : 'Tiered'}
                      {r.is_inclusive ? ' (incl.)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Base Amount</label>
                <AmountInput value={baseAmount} onChange={setBaseAmount} placeholder="0.00" />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Invoice/bill total: {fmt(record.amount)}
                </div>
              </div>
              {selectedRate && (
                <div style={{
                  background: 'var(--bg)', border: '2px solid var(--primary)',
                  borderRadius: 8, padding: '14px 16px', marginBottom: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Estimated Tax Amount</div>
                    {selectedRate.is_inclusive && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tax-inclusive: extracted from base</div>
                    )}
                    {(parseFloat(selectedRate.exempt_threshold) || 0) > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Exempt threshold: {fmt(selectedRate.exempt_threshold)}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>
                    {fmt(previewTax)}
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Notes <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                <input className="form-input" value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any notes about this tax application…" />
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {taxRates.length > 0 && (
            <button className="btn btn-primary" onClick={handleApply}
              disabled={saving || !selectedId || !base}>
              {saving ? 'Applying…' : '✓ Apply Tax'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tax journal-entry prompt ──────────────────────────────────────────────────
function TaxJournalModal({ application, accounts, onClose, onRecorded }) {
  const { fmt } = useSettings();
  const defaultDebit  = accounts.find(a => a.code === '4000')?.id || '';
  const defaultCredit = accounts.find(a => a.code === '2300')?.id || '';
  const [form, setForm]   = useState({
    date:              new Date().toISOString().split('T')[0],
    reference:         `TAX-${application.tax_code}-${new Date().toISOString().split('T')[0]}`,
    debit_account_id:  defaultDebit,
    credit_account_id: defaultCredit,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleRecord = async () => {
    if (!form.debit_account_id || !form.credit_account_id)
      return setError('Please select both debit and credit accounts.');
    if (String(form.debit_account_id) === String(form.credit_account_id))
      return setError('Debit and credit accounts must be different.');
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/tax/applications/${application.id}/journal-entry`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onRecorded();
      onClose();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">📒 Record Tax Journal Entry</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-success mb-16">
            ✓ <strong>{application.tax_name}</strong> ({application.tax_code}) applied —
            tax amount: <strong>{fmt(application.tax_amount)}</strong>.
            Would you like to record the journal entry now?
          </div>
          {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
          <div className="grid-2 gap-16">
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Reference</label>
              <input className="form-input" value={form.reference}
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Debit Account</label>
              <select className="form-select" value={form.debit_account_id}
                onChange={e => setForm(f => ({ ...f, debit_account_id: e.target.value }))}>
                <option value="">— Select —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Credit Account</label>
              <select className="form-select" value={form.credit_account_id}
                onChange={e => setForm(f => ({ ...f, credit_account_id: e.target.value }))}>
                <option value="">— Select —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>I'll do it later</button>
          <button className="btn btn-primary" onClick={handleRecord} disabled={saving}>
            {saving ? 'Saving…' : '📒 Record Journal Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Deletion-request modal ────────────────────────────────────────────────────
function DeletionModal({ rec, isAR, onClose, onDone }) {
  const name   = isAR ? rec.customer_name : rec.supplier_name;
  const ref    = rec.invoice_number || rec.reference_number || '—';
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleRequest = async () => {
    setSaving(true); setError('');
    try {
      const res  = await fetch(`/api/payments/${isAR ? 'receivables' : 'payables'}/${rec.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletion_note: note || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onDone('Deletion request submitted — awaiting approval.');
      onClose();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">🗑 Request Record Deletion</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-warning mb-16">
            Requesting deletion of <strong>{ref}</strong> ({name}).
            An approver must review this before the record is permanently removed.
          </div>
          {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
          <div className="form-group">
            <label className="form-label">Reason for Deletion <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
            <textarea className="form-textarea" rows={3} value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Why should this record be deleted?" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={handleRequest} disabled={saving}>
            {saving ? 'Submitting…' : '🗑 Submit Deletion Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Payments({ tab }) {
  const { fmt, settings } = useSettings();
  const { can, user }     = useUser();
  const baseCurrency = settings.currency || 'PHP';
  const isAR = tab === 'incoming';
  const [records,       setRecords]       = useState([]);
  const [showAdd,       setShowAdd]       = useState(false);
  const [showImport,    setShowImport]    = useState(false);
  const [payRecord,     setPayRecord]     = useState(null);
  const [deletionModal, setDeletionModal] = useState(null);
  const [taxRecord,     setTaxRecord]     = useState(null);
  const [jeApp,         setJeApp]         = useState(null);
  const [accounts,      setAccounts]      = useState([]);
  const [msg,           setMsg]           = useState(null);

  useEffect(() => { loadRecords(); }, [tab]);

  // Load accounts once for the tax journal-entry modal
  useEffect(() => {
    fetch('/api/accounts', { credentials: 'include' })
      .then(r => r.json()).then(setAccounts).catch(() => {});
  }, []);

  const loadRecords = () => {
    const endpoint = isAR ? '/api/payments/receivables' : '/api/payments/payables';
    fetch(endpoint).then(r => r.json()).then(setRecords).catch(() => {});
  };

  const handleRecall = async (rec) => {
    const endpoint = `/api/payments/${isAR ? 'receivables' : 'payables'}/${rec.id}/recall`;
    try {
      const res  = await fetch(endpoint, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.error }); return; }
      setMsg({ type: 'success', text: 'Submission recalled.' });
      loadRecords();
    } catch { setMsg({ type: 'error', text: 'Network error.' }); }
  };

  const handleTaxApplied = (application) => {
    setJeApp(application);
    setMsg({ type: 'success', text: `Tax applied: ${application.tax_name} — ${fmt(application.tax_amount)}. Record the journal entry below, or do it later from Tax → Applications.` });
  };

  const today = new Date().toISOString().split('T')[0];
  const pending = records.filter(r => r.status !== 'paid');
  const totalOutstanding = pending.reduce((s, r) => s + (r.amount + (parseFloat(r.total_tax_applied) || 0) - r.paid_amount), 0);
  const overdue = pending.filter(r => r.due_date && r.due_date < today);
  const totalOverdue = overdue.reduce((s, r) => s + (r.amount + (parseFloat(r.total_tax_applied) || 0) - r.paid_amount), 0);

  const exportUrl  = isAR ? '/api/payments/receivables/export/csv' : '/api/payments/payables/export/csv';
  const exportFile = isAR ? `receivables-${new Date().toISOString().split('T')[0]}.csv` : `payables-${new Date().toISOString().split('T')[0]}.csv`;

  return (
    <div>
      {deletionModal && (
        <DeletionModal
          rec={deletionModal} isAR={isAR}
          onClose={() => setDeletionModal(null)}
          onDone={text => { setMsg({ type: 'success', text }); loadRecords(); }}
        />
      )}
      {taxRecord && (
        <ApplyTaxModal
          record={taxRecord}
          entityType={isAR ? 'receivable' : 'payable'}
          onClose={() => setTaxRecord(null)}
          onApplied={handleTaxApplied}
        />
      )}
      {jeApp && (
        <TaxJournalModal
          application={jeApp}
          accounts={accounts}
          onClose={() => setJeApp(null)}
          onRecorded={() => setMsg({ type: 'success', text: 'Tax journal entry recorded successfully.' })}
        />
      )}
      {showImport && <ImportModal type={tab} onClose={() => setShowImport(false)} onImported={loadRecords} />}
      <div className="page-header">
        <div>
          <div className="page-title">{isAR ? 'Incoming Payments' : 'Pending Payments'}</div>
          <div className="page-subtitle">
            {isAR ? 'Money customers owe you (Accounts Receivable)' : 'Money you owe suppliers (Accounts Payable)'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {can('manager') && (
            <button className="btn btn-ghost btn-sm" onClick={() => triggerDownload(exportUrl, exportFile)}>
              ⬇ Export CSV
            </button>
          )}
          {can('finance') && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(true)}>
              ⬆ Import CSV
            </button>
          )}
          {user?.role !== 'admin' && (
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              {isAR ? '+ Add Invoice' : '+ Add Bill'}
            </button>
          )}
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
                  <th className="td-right">Tax</th>
                  <th className="td-right">Total</th>
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
                  const taxAmt  = parseFloat(rec.total_tax_applied) || 0;
                  const total   = rec.amount + taxAmt;
                  const balance = total - rec.paid_amount;
                  return (
                    <tr key={rec.id}>
                      <td style={{ fontWeight: 500 }}>{isAR ? rec.customer_name : rec.supplier_name}</td>
                      <td className="td-mono text-muted">{rec.invoice_number || rec.reference_number || '—'}</td>
                      <td className="text-muted">{rec.description || '—'}</td>
                      <td className="td-right tabular">{fmt(rec.amount)}</td>
                      <td className="td-right tabular">
                        {taxAmt > 0
                          ? <span title={rec.tax_codes} style={{ fontSize: 12, color: 'var(--primary)', cursor: 'default' }}>
                              +{fmt(taxAmt)}
                              {rec.tax_codes && <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({rec.tax_codes})</span>}
                            </span>
                          : <span style={{ color: 'var(--text-light)' }}>—</span>}
                      </td>
                      <td className="td-right tabular" style={{ fontWeight: 600 }}>{fmt(total)}</td>
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
                      <td>{statusBadge(rec)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {rec.pending_approval && (rec.created_by_email === user?.email || user?.role === 'super_admin') && (
                            <button className="btn btn-ghost btn-sm" onClick={() => handleRecall(rec)} title="Recall submission">
                              ↩ Recall
                            </button>
                          )}
                          {rec.status !== 'paid' && !rec.pending_deletion && !rec.pending_approval && can('manager') && (
                            <button className="btn btn-success btn-sm" onClick={() => setPayRecord(rec)}>
                              ✓ Pay
                            </button>
                          )}
                          {isAR && !rec.pending_approval && (
                            <button className="btn btn-ghost btn-sm"
                              title="Download PDF Invoice"
                              onClick={() => triggerBinaryDownload(`/api/invoices/receivable/${rec.id}`, `Invoice-${rec.invoice_number || rec.id}.pdf`)}>
                              📄 PDF
                            </button>
                          )}
                          {!rec.pending_deletion && !rec.pending_approval && (
                            <button className="btn btn-ghost btn-sm"
                              title="Apply a tax rate to this record"
                              onClick={() => setTaxRecord(rec)}>
                              🧾 Tax
                            </button>
                          )}
                          {!rec.pending_deletion && !rec.pending_approval && user?.role !== 'admin' && (
                            <button className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--danger)', borderColor: 'transparent' }}
                              title="Request deletion"
                              onClick={() => setDeletionModal(rec)}>🗑</button>
                          )}
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
