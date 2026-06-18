import { useState, useEffect, useCallback } from 'react';

const FREQUENCIES = [
  { value: 'weekly',    label: 'Weekly' },
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually',  label: 'Annually' },
];

const FREQ_LABEL = Object.fromEntries(FREQUENCIES.map(f => [f.value, f.label]));

function fmtDate(d) {
  if (!d) return '—';
  const s = d.includes('T') ? d.split('T')[0] : d;
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtAmt(amount, currency) {
  return `${currency || 'PHP'} ${parseFloat(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

const EMPTY_FORM = {
  customer_name: '', description: '', amount: '', currency: 'PHP', exchange_rate: '1',
  frequency: 'monthly', due_days: '30', invoice_prefix: 'REC',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '', notes: '',
};

// ── Template form modal ───────────────────────────────────────────────────────
function TemplateModal({ template, onSave, onClose }) {
  const [form,   setForm]   = useState(template
    ? {
        customer_name:   template.customer_name || '',
        description:     template.description   || '',
        amount:          String(template.amount  || ''),
        currency:        template.currency       || 'PHP',
        exchange_rate:   String(template.exchange_rate || '1'),
        frequency:       template.frequency      || 'monthly',
        due_days:        String(template.due_days ?? 30),
        invoice_prefix:  template.invoice_prefix || 'REC',
        start_date:      template.start_date     || new Date().toISOString().split('T')[0],
        end_date:        template.end_date        || '',
        notes:           template.notes           || '',
      }
    : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.customer_name.trim()) { setError('Customer name is required'); return; }
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) { setError('Amount must be a positive number'); return; }
    if (!form.start_date) { setError('Start date is required'); return; }

    setSaving(true); setError('');
    try {
      const url    = template ? `/api/recurring-invoices/${template.id}` : '/api/recurring-invoices';
      const method = template ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount:        parseFloat(form.amount),
          exchange_rate: parseFloat(form.exchange_rate) || 1,
          due_days:      parseInt(form.due_days)        || 30,
          end_date:      form.end_date || null,
          is_active:     template ? template.is_active : true,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Save failed'); return; }
      onSave(data);
    } catch { setError('Network error. Please try again.'); }
    finally  { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            {template ? '✏️ Edit Recurring Invoice' : '➕ New Recurring Invoice'}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error mb-12">⚠ {error}</div>}

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Customer Name *</label>
              <input className="form-input" value={form.customer_name}
                onChange={e => set('customer_name', e.target.value)} placeholder="e.g. ABC Corporation" />
            </div>
            <div className="form-group">
              <label className="form-label">Invoice Prefix</label>
              <input className="form-input" value={form.invoice_prefix}
                onChange={e => set('invoice_prefix', e.target.value.toUpperCase())} placeholder="REC" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="e.g. Monthly retainer fee" />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Amount *</label>
              <input className="form-input" type="number" min="0" step="0.01"
                value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <input className="form-input" value={form.currency}
                onChange={e => set('currency', e.target.value.toUpperCase())} placeholder="PHP" />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Frequency *</label>
              <select className="form-select" value={form.frequency}
                onChange={e => set('frequency', e.target.value)}>
                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Due Days After Issue</label>
              <input className="form-input" type="number" min="0" step="1"
                value={form.due_days} onChange={e => set('due_days', e.target.value)} />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input className="form-input" type="date" value={form.start_date}
                onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <input className="form-input" type="date" value={form.end_date}
                onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={form.notes}
              onChange={e => set('notes', e.target.value)} placeholder="Internal notes (not shown on invoice)" />
          </div>

          <div className="alert alert-info" style={{ fontSize: 12 }}>
            💡 Invoice numbers are auto-generated as <strong>{form.invoice_prefix || 'REC'}-[ID]-[YYYYMMDD]</strong>.
            Invoices appear in <strong>Payments → Incoming (AR)</strong> on the scheduled date.
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : (template ? 'Save Changes' : 'Create Template')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RecurringInvoices() {
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [running,   setRunning]   = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [modal,     setModal]     = useState(null);   // null | 'new' | template object
  const [msg,       setMsg]       = useState(null);

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 6000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/recurring-invoices', { credentials: 'include' });
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  // Auto-run due invoices on mount
  const runDue = useCallback(async (silent = false) => {
    setRunning(true);
    try {
      const res  = await fetch('/api/recurring-invoices/run', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { if (!silent) showMsg('error', data.error); return; }
      if (data.generated > 0) {
        setRunResult(data);
        showMsg('success', `✓ ${data.generated} invoice(s) generated automatically.`);
        load();
      }
    } catch { if (!silent) showMsg('error', 'Network error during run.'); }
    finally { setRunning(false); }
  }, [load]);

  useEffect(() => {
    load().then(() => runDue(true));
  }, [load, runDue]);

  const handleManualRun = async () => {
    setRunResult(null);
    await runDue(false);
    if (!runResult) showMsg('info', 'No invoices were due today.');
  };

  const handleToggle = async (tmpl) => {
    try {
      const res  = await fetch(`/api/recurring-invoices/${tmpl.id}/toggle`,
        { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { showMsg('error', data.error); return; }
      setTemplates(ts => ts.map(t => t.id === tmpl.id ? data : t));
      showMsg('success', data.is_active ? '✓ Template activated.' : '✓ Template paused.');
    } catch { showMsg('error', 'Network error.'); }
  };

  const handleDelete = async (tmpl) => {
    if (!window.confirm(`Delete recurring template for "${tmpl.customer_name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/recurring-invoices/${tmpl.id}`,
        { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const d = await res.json(); showMsg('error', d.error); return; }
      setTemplates(ts => ts.filter(t => t.id !== tmpl.id));
      showMsg('success', '✓ Template deleted.');
    } catch { showMsg('error', 'Network error.'); }
  };

  const handleSaved = (saved) => {
    setTemplates(ts => {
      const exists = ts.find(t => t.id === saved.id);
      return exists ? ts.map(t => t.id === saved.id ? saved : t) : [saved, ...ts];
    });
    setModal(null);
    showMsg('success', '✓ Template saved.');
  };

  const active   = templates.filter(t =>  t.is_active);
  const inactive = templates.filter(t => !t.is_active);

  return (
    <div>
      {modal && (
        <TemplateModal
          template={modal === 'new' ? null : modal}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Recurring Invoices</div>
          <div className="page-subtitle">Auto-generate AR invoices on a regular schedule</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={handleManualRun} disabled={running}>
            {running ? '⏳ Running…' : '▶ Run Now'}
          </button>
          <button className="btn btn-primary" onClick={() => setModal('new')}>
            ➕ New Template
          </button>
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'error' ? 'error' : msg.type === 'info' ? 'info' : 'success'} mb-16`}>
          {msg.text}
        </div>
      )}

      {runResult && runResult.generated > 0 && (
        <div className="alert alert-success mb-16" style={{ fontSize: 13 }}>
          <strong>Last run generated {runResult.generated} invoice(s):</strong>
          <ul style={{ marginTop: 6, paddingLeft: 20 }}>
            {runResult.details.map((d, i) => (
              <li key={i}>{d.invoice} → {d.customer} (run date: {fmtDate(d.run_date)})</li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="text-muted text-center" style={{ padding: 60 }}>Loading…</div>
      ) : templates.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔁</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No recurring invoice templates yet</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Create a template and CuentaIQ will automatically generate AR invoices on your chosen schedule.</div>
          <button className="btn btn-primary" onClick={() => setModal('new')}>➕ Create First Template</button>
        </div>
      ) : (
        <>
          {/* Active templates */}
          {active.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)',
                            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Active Templates ({active.length})
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Frequency</th>
                      <th>Next Run</th>
                      <th>Last Run</th>
                      <th>Runs</th>
                      <th>End Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map(t => (
                      <TemplateRow key={t.id} t={t} onEdit={() => setModal(t)}
                        onToggle={() => handleToggle(t)} onDelete={() => handleDelete(t)} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Paused templates */}
          {inactive.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)',
                            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Paused / Completed ({inactive.length})
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Frequency</th>
                      <th>Next Run</th>
                      <th>Last Run</th>
                      <th>Runs</th>
                      <th>End Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactive.map(t => (
                      <TemplateRow key={t.id} t={t} onEdit={() => setModal(t)}
                        onToggle={() => handleToggle(t)} onDelete={() => handleDelete(t)} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Template table row ────────────────────────────────────────────────────────
function TemplateRow({ t, onEdit, onToggle, onDelete }) {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = t.is_active && t.next_run_date && t.next_run_date < today;

  return (
    <tr style={{ opacity: t.is_active ? 1 : 0.6 }}>
      <td>
        <div style={{ fontWeight: 600 }}>{t.customer_name}</div>
        {t.description && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.description}</div>}
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Prefix: {t.invoice_prefix}</div>
      </td>
      <td style={{ fontWeight: 600 }}>{fmtAmt(t.amount, t.currency)}</td>
      <td>
        <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
          {FREQ_LABEL[t.frequency] || t.frequency}
        </span>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Due +{t.due_days}d</div>
      </td>
      <td style={{ color: isOverdue ? 'var(--danger)' : undefined, fontWeight: isOverdue ? 600 : 400 }}>
        {fmtDate(t.next_run_date)}
        {isOverdue && <div style={{ fontSize: 11, color: 'var(--danger)' }}>⚠ Overdue — click Run Now</div>}
      </td>
      <td style={{ color: 'var(--text-muted)' }}>{fmtDate(t.last_run_date)}</td>
      <td style={{ textAlign: 'center' }}>{t.run_count || 0}</td>
      <td style={{ color: 'var(--text-muted)' }}>{t.end_date ? fmtDate(t.end_date) : '∞ Ongoing'}</td>
      <td>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={onEdit} title="Edit">✏️</button>
          <button className="btn btn-ghost btn-sm" onClick={onToggle}
            title={t.is_active ? 'Pause' : 'Resume'}>
            {t.is_active ? '⏸' : '▶'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onDelete} title="Delete"
            style={{ color: 'var(--danger)' }}>🗑</button>
        </div>
      </td>
    </tr>
  );
}
