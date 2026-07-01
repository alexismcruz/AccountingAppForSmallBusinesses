import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useUser }     from '../context/UserContext.jsx';
import AmountInput     from '../components/AmountInput.jsx';
import StatusPill      from '../components/StatusPill.jsx';
import { X, Receipt, BookOpen, Trash2 } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return '—';
  const s = typeof d === 'string' ? d.split('T')[0] : new Date(d).toISOString().split('T')[0];
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const TYPE_LABELS = { percentage: 'Percentage (%)', fixed_amount: 'Fixed Amount', tiered: 'Tiered Brackets' };
const APPLIES_LABELS = { sales: 'Sales (AR)', purchases: 'Purchases (AP)', both: 'Both' };
const FREQ_LABELS    = { monthly: 'Monthly', quarterly: 'Quarterly', 'bi-annual': 'Bi-Annual', annual: 'Annual' };

// ── Tooltip component ─────────────────────────────────────────────────────────
function InfoTip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 5 }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ cursor: 'help', color: 'var(--text-muted)', fontSize: 12, userSelect: 'none' }}
      >ⓘ</span>
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)', background: '#1e293b', color: '#f8fafc',
          fontSize: 12, padding: '8px 12px', borderRadius: 6, width: 260,
          zIndex: 200, lineHeight: 1.6, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          pointerEvents: 'none',
        }}>
          {text}
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            borderWidth: '6px 6px 0', borderStyle: 'solid',
            borderColor: '#1e293b transparent transparent',
          }} />
        </div>
      )}
    </span>
  );
}
// ── Journal-entry prompt after applying a tax ─────────────────────────────────
function JournalEntryModal({ application, accounts, onClose, onRecorded }) {
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
  const { fmt } = useSettings();

  const handleRecord = async () => {
    if (!form.debit_account_id || !form.credit_account_id)
      return setError('Please select both debit and credit accounts.');
    if (form.debit_account_id === form.credit_account_id)
      return setError('Debit and credit accounts must be different.');
    setSaving(true); setError('');
    try {
      const res  = await fetch(`/api/tax/applications/${application.id}/journal-entry`, {
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

  const assetLiab = accounts.filter(a => ['Asset', 'Liability', 'Revenue', 'Expense', 'COGS', 'Equity'].includes(a.type));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Record Tax Journal Entry</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="alert alert-success mb-16">
            Tax applied! <strong>{application.tax_name}</strong> — Tax Amount: <strong>{fmt(application.tax_amount)}</strong>
          </div>
          <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Tax:</span> <strong>{application.tax_name} ({application.tax_code})</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Applies To:</span> <strong>{APPLIES_LABELS[application.applies_to] || application.applies_to}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Base Amount:</span> <strong>{fmt(application.base_amount)}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Tax Amount:</span> <strong>{fmt(application.tax_amount)}</strong></div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Would you like to record this tax in a journal entry now?
          </p>
          {error && <div className="alert alert-error mb-12">{error}</div>}
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
              <select className="form-input" value={form.debit_account_id}
                onChange={e => setForm(f => ({ ...f, debit_account_id: e.target.value }))}>
                <option value="">— Select account —</option>
                {assetLiab.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Credit Account</label>
              <select className="form-input" value={form.credit_account_id}
                onChange={e => setForm(f => ({ ...f, credit_account_id: e.target.value }))}>
                <option value="">— Select account —</option>
                {assetLiab.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Typical: Sales tax → Debit: Sales Revenue (4000) / Credit: Sales Tax Payable (2300) · Purchase tax → Debit: Income Tax Payable (2200) / Credit: Bank (1010)
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>I'll Do It Later</button>
          <button className="btn btn-primary" onClick={handleRecord} disabled={saving}>
            {saving ? 'Recording…' : 'Record Journal Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tax Rate modal (Add / Edit) ───────────────────────────────────────────────
function TaxRateModal({ rate, accounts, onClose, onSaved }) {
  const empty = {
    name: '', code: '', type: 'percentage', rate: '', amount: '',
    tiers: [{ min: '0', max: '', rate: '' }],
    applies_to: 'sales', is_inclusive: false, exempt_threshold: '',
    tax_account_id: '', effective_from: '', effective_to: '',
    filing_frequency: 'monthly', description: '',
  };
  const [form,   setForm]   = useState(rate ? {
    ...empty, ...rate,
    rate:             String(rate.rate || ''),
    amount:           String(rate.amount || ''),
    exempt_threshold: String(rate.exempt_threshold || ''),
    tax_account_id:   rate.tax_account_id ? String(rate.tax_account_id) : '',
    tiers:            rate.tiers?.length ? rate.tiers.map(t => ({ min: String(t.min ?? ''), max: String(t.max ?? ''), rate: String(t.rate ?? '') })) : [{ min: '0', max: '', rate: '' }],
    is_inclusive:     !!rate.is_inclusive,
    effective_from:   rate.effective_from ? rate.effective_from.split('T')[0] : '',
    effective_to:     rate.effective_to   ? rate.effective_to.split('T')[0]   : '',
  } : empty);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const addTier    = () => setForm(prev => ({ ...prev, tiers: [...prev.tiers, { min: '', max: '', rate: '' }] }));
  const removeTier = (i) => setForm(prev => ({ ...prev, tiers: prev.tiers.filter((_, idx) => idx !== i) }));
  const setTier    = (i, k, v) => setForm(prev => {
    const tiers = [...prev.tiers];
    tiers[i] = { ...tiers[i], [k]: v };
    return { ...prev, tiers };
  });

  const handleSave = async () => {
    if (!form.name.trim()) return setError('Name is required');
    if (!form.code.trim()) return setError('Code is required');
    setSaving(true); setError('');
    const body = {
      ...form,
      rate:             parseFloat(form.rate)             || 0,
      amount:           parseFloat(form.amount)           || 0,
      exempt_threshold: parseFloat(form.exempt_threshold) || 0,
      tax_account_id:   form.tax_account_id ? parseInt(form.tax_account_id) : null,
      tiers: form.type === 'tiered'
        ? form.tiers.map(t => ({ min: parseFloat(t.min) || 0, max: t.max !== '' ? parseFloat(t.max) : null, rate: parseFloat(t.rate) || 0 }))
        : null,
    };
    try {
      const url = rate ? `/api/tax/rates/${rate.id}` : '/api/tax/rates';
      const res = await fetch(url, {
        method: rate ? 'PUT' : 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onSaved(); onClose();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  const liabilityAccounts = accounts.filter(a => a.type === 'Liability');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{rate ? 'Edit Tax Rate' : '+ Add Tax Rate'}</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error mb-16">{error}</div>}
          <div className="grid-2 gap-16">
            <div className="form-group">
              <label className="form-label">Tax Name *</label>
              <input className="form-input" value={form.name} maxLength={80}
                onChange={e => f('name', e.target.value)} placeholder="e.g. Output VAT" />
            </div>
            <div className="form-group">
              <label className="form-label">Code * <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(auto-uppercased)</span></label>
              <input className="form-input" value={form.code} maxLength={20}
                onChange={e => f('code', e.target.value.toUpperCase())} placeholder="e.g. VAT-OUT" />
            </div>

            {/* Type */}
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Tax Type *</label>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <label key={val} style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${form.type === val ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: form.type === val ? 'var(--color-primary-light)' : 'var(--color-surface-2)',
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                  }}>
                    <input type="radio" name="type" value={val} checked={form.type === val}
                      onChange={() => f('type', val)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {/* Rate / Amount / Tiers */}
            {form.type === 'percentage' && (
              <div className="form-group">
                <label className="form-label">Rate (%)</label>
                <input type="number" className="form-input" value={form.rate} min={0} max={100} step={0.01}
                  onChange={e => f('rate', e.target.value)} placeholder="e.g. 12" />
              </div>
            )}
            {form.type === 'fixed_amount' && (
              <div className="form-group">
                <label className="form-label">Fixed Amount</label>
                <AmountInput value={form.amount} onChange={v => f('amount', v)} placeholder="0.00" />
              </div>
            )}
            {form.type === 'tiered' && (
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Tax Brackets</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                  {form.tiers.map((tier, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 30 }}>From</span>
                      <input type="number" className="form-input" style={{ flex: 1 }} value={tier.min}
                        onChange={e => setTier(i, 'min', e.target.value)} placeholder="0" />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
                      <input type="number" className="form-input" style={{ flex: 1 }} value={tier.max}
                        onChange={e => setTier(i, 'max', e.target.value)} placeholder="∞ (blank = no limit)" />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→</span>
                      <input type="number" className="form-input" style={{ flex: 1 }} value={tier.rate}
                        onChange={e => setTier(i, 'rate', e.target.value)} placeholder="Rate %" />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
                      {form.tiers.length > 1 && (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '4px 8px' }}
                          onClick={() => removeTier(i)}><X size={14} /></button>
                      )}
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addTier}>
                    + Add Bracket
                  </button>
                </div>
              </div>
            )}

            {/* Applies To */}
            <div className="form-group">
              <label className="form-label">Applies To</label>
              <select className="form-input" value={form.applies_to} onChange={e => f('applies_to', e.target.value)}>
                {Object.entries(APPLIES_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {/* Filing Frequency */}
            <div className="form-group">
              <label className="form-label">Filing Frequency</label>
              <select className="form-input" value={form.filing_frequency} onChange={e => f('filing_frequency', e.target.value)}>
                {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {/* Inclusive toggle */}
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.is_inclusive} onChange={e => f('is_inclusive', e.target.checked)} />
                <span><strong>Tax-inclusive</strong> — the tax is already included in the listed price (back-calculate from total)</span>
              </label>
            </div>

            {/* Exempt Threshold */}
            <div className="form-group">
              <label className="form-label">
                Exempt Threshold
                <InfoTip text="Tax is only calculated on the amount exceeding this value. Example: threshold of ₱20,000 with a 10% rate — a ₱25,000 transaction is taxed only on ₱5,000, not the full amount. Leave at 0 to tax the full amount." />
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>(optional)</span>
              </label>
              <AmountInput value={form.exempt_threshold} onChange={v => f('exempt_threshold', v)} placeholder="0.00" />
            </div>

            {/* Tax Account */}
            <div className="form-group">
              <label className="form-label">
                Linked Tax Payable Account
                <InfoTip text="When this tax is applied, the tax amount is posted as a credit to this liability account — typically 'Sales Tax Payable' (2300) for output taxes you owe, or 'Withholding Tax Payable' for taxes you collect on behalf of the government. Linking it enables automatic journal entries." />
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>(optional)</span>
              </label>
              <select className="form-input" value={form.tax_account_id} onChange={e => f('tax_account_id', e.target.value)}>
                <option value="">— None —</option>
                {liabilityAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>

            {/* Effective dates */}
            <div className="form-group">
              <label className="form-label">Effective From <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(optional)</span></label>
              <input type="date" className="form-input" value={form.effective_from} onChange={e => f('effective_from', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Effective To <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(optional)</span></label>
              <input type="date" className="form-input" value={form.effective_to} onChange={e => f('effective_to', e.target.value)} />
            </div>

            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Description <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(optional)</span></label>
              <textarea className="form-textarea" rows={2} value={form.description} maxLength={300}
                onChange={e => f('description', e.target.value)} placeholder="Notes about this tax, BIR form numbers, etc." />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : (rate ? 'Save Changes' : 'Add Tax Rate')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Apply Tax modal ───────────────────────────────────────────────────────────
function ApplyTaxModal({ taxRates, onClose, onApplied }) {
  const [form,     setForm]     = useState({ tax_rate_id: '', entity_type: 'receivable', entity_id: '', base_amount: '', notes: '' });
  const [entities, setEntities] = useState([]);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const { fmt, settings } = useSettings();
  const businessType  = settings.business_type || 'corporate';
  const isIndividual  = ['sole_proprietorship', 'mixed_income'].includes(businessType);

  useEffect(() => {
    if (!form.entity_type) return;
    const ep = form.entity_type === 'receivable' ? '/api/payments/receivables' : '/api/payments/payables';
    fetch(ep, { credentials: 'include' }).then(r => r.json()).then(data => {
      setEntities(Array.isArray(data) ? data.filter(e => !e.pending_approval) : []);
      setForm(f => ({ ...f, entity_id: '', base_amount: '' }));
    }).catch(() => {});
  }, [form.entity_type]);

  const selectedEntity = entities.find(e => String(e.id) === String(form.entity_id));
  const selectedRate   = taxRates.find(r => String(r.id) === String(form.tax_rate_id));

  useEffect(() => {
    if (selectedEntity && !form.base_amount)
      setForm(f => ({ ...f, base_amount: String(parseFloat(selectedEntity.amount) || '') }));
  }, [selectedEntity]);

  const previewTax = (() => {
    if (!selectedRate || !form.base_amount) return null;
    const base    = parseFloat(form.base_amount) || 0;
    const exempt  = parseFloat(selectedRate.exempt_threshold) || 0;
    const taxable = Math.max(0, base - exempt);
    if (selectedRate.type === 'percentage') {
      const rate = parseFloat(selectedRate.rate) || 0;
      return selectedRate.is_inclusive
        ? taxable * rate / (100 + rate)
        : taxable * rate / 100;
    }
    if (selectedRate.type === 'fixed_amount') return taxable > 0 ? (parseFloat(selectedRate.amount) || 0) : 0;
    return null; // tiered shown as "calculated on save"
  })();

  const handleSave = async () => {
    if (!form.tax_rate_id) return setError('Please select a tax rate');
    if (!form.entity_id)   return setError('Please select an invoice or bill');
    if (!form.base_amount || isNaN(parseFloat(form.base_amount))) return setError('Please enter a valid base amount');
    setSaving(true); setError('');
    try {
      const res  = await fetch('/api/tax/applications', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tax_rate_id: parseInt(form.tax_rate_id), entity_id: parseInt(form.entity_id) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onApplied(data);
      onClose();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Apply Tax to Invoice / Bill</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error mb-16">{error}</div>}
          <div className="grid-2 gap-16">
            <div className="form-group">
              <label className="form-label">Tax Rate *</label>
              <select className="form-input" value={form.tax_rate_id}
                onChange={e => setForm(f => ({ ...f, tax_rate_id: e.target.value }))}>
                <option value="">— Select tax —</option>
                {taxRates.filter(r => {
                  if (!r.is_active) return false;
                  const btf = r.business_type_filter || 'all';
                  if (btf === 'corporate'  && businessType !== 'corporate') return false;
                  if (btf === 'individual' && !isIndividual)                return false;
                  return true;
                }).map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code}) — {r.type === 'percentage' ? `${r.rate}%` : r.type === 'fixed_amount' ? `Fixed` : 'Tiered'}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Entity Type *</label>
              <select className="form-input" value={form.entity_type}
                onChange={e => setForm(f => ({ ...f, entity_type: e.target.value }))}>
                <option value="receivable">Invoice (Receivable / AR)</option>
                <option value="payable">Bill (Payable / AP)</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Select Invoice / Bill *</label>
              <select className="form-input" value={form.entity_id}
                onChange={e => {
                  const ent = entities.find(x => String(x.id) === e.target.value);
                  setForm(f => ({ ...f, entity_id: e.target.value, base_amount: ent ? String(parseFloat(ent.amount) || '') : '' }));
                }}>
                <option value="">— Select record —</option>
                {entities.map(e => {
                  const ref  = e.invoice_number || e.reference_number || `#${e.id}`;
                  const name = e.customer_name  || e.supplier_name;
                  return <option key={e.id} value={e.id}>{ref} — {name}</option>;
                })}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Base Amount * <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(amount tax applies to)</span></label>
              <AmountInput value={form.base_amount} onChange={v => setForm(f => ({ ...f, base_amount: v }))} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Estimated Tax</label>
              <div style={{ padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-2)', fontSize: 14, fontWeight: 600, color: 'var(--color-primary)' }}>
                {previewTax !== null ? fmt(Math.round(previewTax * 100) / 100) : selectedRate?.type === 'tiered' ? 'Calculated on save' : '—'}
              </div>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Notes <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(optional)</span></label>
              <input className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional notes…" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Applying…' : 'Apply Tax'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Filing modal ──────────────────────────────────────────────────────────
function FilingModal({ filing, taxRates, onClose, onSaved }) {
  const [form, setForm]   = useState(filing ? {
    tax_rate_id:      String(filing.tax_rate_id || ''),
    period_type:      filing.period_type,
    period_start:     filing.period_start,
    period_end:       filing.period_end,
    due_date:         filing.due_date || '',
    total_tax_amount: String(filing.total_tax_amount || ''),
    reference:        filing.reference || '',
    notes:            filing.notes || '',
  } : {
    tax_rate_id: '', period_type: 'monthly',
    period_start: '', period_end: '', due_date: '',
    total_tax_amount: '', reference: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    if (!form.period_start || !form.period_end) return setError('Period start and end are required');
    setSaving(true); setError('');
    try {
      const url = filing ? `/api/tax/filings/${filing.id}` : '/api/tax/filings';
      const res = await fetch(url, {
        method: filing ? 'PUT' : 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tax_rate_id: form.tax_rate_id ? parseInt(form.tax_rate_id) : null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onSaved(); onClose();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{filing ? 'Edit Filing' : '+ Add Filing Record'}</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error mb-16">{error}</div>}
          <div className="grid-2 gap-16">
            <div className="form-group">
              <label className="form-label">Tax Rate <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(optional)</span></label>
              <select className="form-input" value={form.tax_rate_id}
                onChange={e => setForm(f => ({ ...f, tax_rate_id: e.target.value }))}>
                <option value="">— All / General —</option>
                {taxRates.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Period Type *</label>
              <select className="form-input" value={form.period_type}
                onChange={e => setForm(f => ({ ...f, period_type: e.target.value }))}>
                {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Period Start *</label>
              <input type="date" className="form-input" value={form.period_start}
                onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Period End *</label>
              <input type="date" className="form-input" value={form.period_end}
                onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Filing Due Date <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(optional)</span></label>
              <input type="date" className="form-input" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Total Tax Amount</label>
              <AmountInput value={form.total_tax_amount} onChange={v => setForm(f => ({ ...f, total_tax_amount: v }))} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Reference / Filing No. <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(optional)</span></label>
              <input className="form-input" value={form.reference} maxLength={80}
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. BIR-2025-Q1" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Notes <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(optional)</span></label>
              <textarea className="form-textarea" rows={2} value={form.notes} maxLength={300}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes about this filing…" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : (filing ? 'Save Changes' : 'Add Filing')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Tax page ─────────────────────────────────────────────────────────────
export default function Tax({ tab = 'rates' }) {
  const { fmt, settings } = useSettings();
  const { can }           = useUser();
  const isPhilippines  = settings.tax_system === 'philippines';
  const isGeneric      = settings.tax_system === 'generic' || !settings.tax_system;
  const businessType   = settings.business_type || 'corporate';
  const BIZ_LABELS     = {
    corporate:           'Corporate',
    sole_proprietorship: 'Sole Prop',
    mixed_income:        'Mixed Income',
  };
  const BIZ_PRESETS    = {
    corporate:           { label: 'VAT-OUT, VAT-IN, EWT-10, CIT-25, PT-3', count: 5 },
    sole_proprietorship: { label: 'VAT-OUT, VAT-IN, EWT-10, PIT-GRAD, PT-3', count: 5 },
    mixed_income:        { label: 'VAT-OUT, VAT-IN, EWT-10, PIT-GRAD, PT-3', count: 5 },
  };

  const [activeTab,     setActiveTab]     = useState(tab);
  const [taxRates,      setTaxRates]      = useState([]);
  const [applications,  setApplications]  = useState([]);
  const [filings,       setFilings]       = useState([]);
  const [accounts,      setAccounts]      = useState([]);
  const [projections,   setProjections]   = useState(null);
  const [projYear,      setProjYear]      = useState(new Date().getFullYear());
  const [projPeriod,    setProjPeriod]    = useState('monthly');
  const [projLoading,   setProjLoading]   = useState(false);

  const [showRateModal,   setShowRateModal]   = useState(false);
  const [editRate,        setEditRate]        = useState(null);
  const [showApplyModal,  setShowApplyModal]  = useState(false);
  const [showFilingModal, setShowFilingModal] = useState(false);
  const [editFiling,      setEditFiling]      = useState(null);
  const [scheduleYear,    setScheduleYear]    = useState(new Date().getFullYear());
  const [generating,      setGenerating]      = useState(false);
  const [jeApp,           setJeApp]           = useState(null); // pending JE after apply

  const [seeding, setSeeding] = useState(false);
  const [msg,     setMsg]     = useState(null);

  const loadRates        = useCallback(() => fetch('/api/tax/rates',        { credentials: 'include' }).then(r => r.json()).then(setTaxRates).catch(() => {}), []);
  const loadApplications = useCallback(() => fetch('/api/tax/applications', { credentials: 'include' }).then(r => r.json()).then(setApplications).catch(() => {}), []);
  const loadFilings      = useCallback(() => fetch('/api/tax/filings',      { credentials: 'include' }).then(r => r.json()).then(setFilings).catch(() => {}), []);
  const loadAccounts     = useCallback(() => fetch('/api/accounts',         { credentials: 'include' }).then(r => r.json()).then(setAccounts).catch(() => {}), []);

  useEffect(() => {
    loadRates(); loadApplications(); loadFilings(); loadAccounts();
  }, []);

  const loadProjections = async () => {
    setProjLoading(true); setProjections(null);
    try {
      const res  = await fetch(`/api/tax/projections?year=${projYear}&period_type=${projPeriod}`, { credentials: 'include' });
      const data = await res.json();
      setProjections(data);
    } catch { setMsg({ type: 'error', text: 'Failed to load projections.' }); }
    finally { setProjLoading(false); }
  };

  useEffect(() => { if (activeTab === 'projections') loadProjections(); }, [activeTab, projYear, projPeriod]);

  const handleSeedPhilippines = async () => {
    const preset = BIZ_PRESETS[businessType];
    if (!confirm(`This will load ${preset.count} standard Philippines tax rates for ${BIZ_LABELS[businessType]}:\n${preset.label}\n\nExisting codes will be skipped. Continue?`)) return;
    setSeeding(true);
    try {
      const res  = await fetch('/api/tax/rates/seed-philippines', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_type: businessType }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.error }); return; }
      setMsg({ type: 'success', text: `Seeded ${data.inserted} Philippines tax rate${data.inserted !== 1 ? 's' : ''} for ${BIZ_LABELS[businessType]}${data.skipped > 0 ? ` (${data.skipped} already existed)` : ''}.` });
      loadRates();
    } catch { setMsg({ type: 'error', text: 'Network error.' }); }
    finally { setSeeding(false); }
  };

  const handleSeedGeneric = async () => {
    if (!confirm('This will create placeholder tax rates based on your admin configuration (State Tax, City Tax, VAT Exempt). Existing codes will not be overwritten. Continue?')) return;
    setSeeding(true);
    try {
      const res  = await fetch('/api/tax/rates/seed-generic', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.error }); return; }
      if (data.inserted === 0) {
        setMsg({ type: 'success', text: 'Admin configuration applied — rates already existed, nothing new to add.' });
      } else {
        setMsg({ type: 'success', text: `Created ${data.inserted} tax rate${data.inserted !== 1 ? 's' : ''} from admin configuration. Edit each rate below to adjust the values.` });
      }
      loadRates();
    } catch { setMsg({ type: 'error', text: 'Network error.' }); }
    finally { setSeeding(false); }
  };

  const handleToggleActive = async (rate) => {
    const res = await fetch(`/api/tax/rates/${rate.id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rate, is_active: rate.is_active ? 0 : 1 }),
    });
    if (res.ok) { loadRates(); setMsg({ type: 'success', text: `${rate.name} ${rate.is_active ? 'deactivated' : 'activated'}.` }); }
  };

  const handleDeleteRate = async (rate) => {
    if (!confirm(`Delete "${rate.name}"? This cannot be undone.`)) return;
    const res  = await fetch(`/api/tax/rates/${rate.id}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json();
    if (!res.ok) { setMsg({ type: 'error', text: data.error }); return; }
    loadRates(); setMsg({ type: 'success', text: 'Tax rate deleted.' });
  };

  const handleDeleteApplication = async (app) => {
    if (!confirm('Remove this tax application?')) return;
    const res  = await fetch(`/api/tax/applications/${app.id}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json();
    if (!res.ok) { setMsg({ type: 'error', text: data.error }); return; }
    loadApplications(); setMsg({ type: 'success', text: 'Tax application removed.' });
  };

  const handleUpdateFilingStatus = async (filing, newStatus) => {
    const res = await fetch(`/api/tax/filings/${filing.id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) { loadFilings(); setMsg({ type: 'success', text: `Marked as ${newStatus}.` }); }
  };

  const handleDeleteFiling = async (filing) => {
    if (!confirm('Delete this filing record?')) return;
    const res = await fetch(`/api/tax/filings/${filing.id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { loadFilings(); setMsg({ type: 'success', text: 'Filing deleted.' }); }
  };

  const handleGenerateSchedule = async () => {
    if (!confirm(`Generate the standard BIR filing schedule for ${scheduleYear}?\n\nThis adds any missing filing deadlines for the year. Existing records are left untouched, and every date stays editable.`)) return;
    setGenerating(true);
    try {
      const res  = await fetch('/api/tax/filings/generate', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: scheduleYear }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.error || 'Failed to generate schedule.' }); return; }
      loadFilings();
      setMsg({ type: 'success', text: `Schedule for ${data.year}: ${data.generated} added${data.skipped ? `, ${data.skipped} already existed` : ''}.` });
    } catch { setMsg({ type: 'error', text: 'Network error.' }); }
    finally { setGenerating(false); }
  };

  const exportProjectionsCSV = () => {
    if (!projections) return;
    const taxNames = projections.tax_rates.map(t => t.name);
    const header = ['Period', 'Sales Base', 'Purchases Base', ...taxNames, 'Total Tax'].join(',');
    const rows = projections.periods.map(p => [
      p.period_label,
      p.sales_base.toFixed(2),
      p.purchases_base.toFixed(2),
      ...taxNames.map(name => {
        const td = p.tax_breakdown.find(b => b.tax_name === name);
        return td ? td.tax_amount.toFixed(2) : '0.00';
      }),
      p.total_tax.toFixed(2),
    ].join(','));
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `tax-projections-${projYear}-${projPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const TABS = [
    { key: 'rates',        label: 'Tax Rates' },
    { key: 'applications', label: 'Applications' },
    { key: 'projections',  label: 'Projections' },
    { key: 'filings',      label: 'Filing Tracker' },
  ];

  return (
    <div>
      {/* Modals */}
      {showRateModal && (
        <TaxRateModal rate={editRate} accounts={accounts}
          onClose={() => { setShowRateModal(false); setEditRate(null); }}
          onSaved={() => { loadRates(); setMsg({ type: 'success', text: editRate ? 'Tax rate updated.' : 'Tax rate added.' }); }} />
      )}
      {showApplyModal && (
        <ApplyTaxModal taxRates={taxRates} onClose={() => setShowApplyModal(false)}
          onApplied={(app) => { loadApplications(); setJeApp(app); }} />
      )}
      {jeApp && (
        <JournalEntryModal application={jeApp} accounts={accounts}
          onClose={() => setJeApp(null)}
          onRecorded={() => { loadApplications(); setMsg({ type: 'success', text: 'Journal entry recorded.' }); }} />
      )}
      {showFilingModal && (
        <FilingModal filing={editFiling} taxRates={taxRates}
          onClose={() => { setShowFilingModal(false); setEditFiling(null); }}
          onSaved={() => { loadFilings(); setMsg({ type: 'success', text: editFiling ? 'Filing updated.' : 'Filing added.' }); }} />
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">
            Tax Management
            {isPhilippines && (
              <span style={{ marginLeft: 10 }} className="pill pill-warning">PH Mode</span>
            )}
            {isPhilippines && (
              <span style={{ marginLeft: 6 }} className="pill pill-primary">
                {BIZ_LABELS[businessType] || 'Corporate'}
              </span>
            )}
          </div>
          <div className="page-subtitle">Define tax rates, apply taxes to invoices, and track filings</div>
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'} mb-16`}
          onClick={() => setMsg(null)} style={{ cursor: 'pointer' }}>
          {msg.text} <span style={{ float: 'right', opacity: 0.6 }}>✕</span>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar mb-24">
        {TABS.map(t => (
          <button key={t.key}
            className={`tab-btn${activeTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAX RATES TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'rates' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="stat-card" style={{ padding: '8px 16px', minWidth: 100 }}>
                <div className="stat-label">Active</div>
                <div className="stat-value" style={{ fontSize: 20 }}>{taxRates.filter(r => r.is_active).length}</div>
              </div>
              <div className="stat-card" style={{ padding: '8px 16px', minWidth: 100 }}>
                <div className="stat-label">Total</div>
                <div className="stat-value" style={{ fontSize: 20 }}>{taxRates.length}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isPhilippines && (
                <button className="btn btn-ghost btn-sm" onClick={handleSeedPhilippines} disabled={seeding}
                  title={`Load ${BIZ_LABELS[businessType]} presets: ${BIZ_PRESETS[businessType]?.label}`}>
                  {seeding ? 'Seeding…' : `🇵🇭 Load ${BIZ_LABELS[businessType]} Presets`}
                </button>
              )}
              {can('finance') && (
                <button className="btn btn-primary" onClick={() => { setEditRate(null); setShowRateModal(true); }}>
                  + Add Tax Rate
                </button>
              )}
            </div>
          </div>

          {isGeneric && (
            <div style={{ background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-mid)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, color: 'var(--color-primary)', marginBottom: 4 }}>Generic Tax System</div>
              <div style={{ fontSize: 13, color: 'var(--color-primary)', lineHeight: 1.6 }}>
                Add your own tax rates below — percentage, fixed amount, or tiered brackets.
                Each rate you create will appear in the tax dropdown on invoices and payments.
              </div>
              {(settings.has_state_tax || settings.has_city_tax || settings.vat_exempt) && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-primary-mid)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-primary)' }}>
                    Admin configured:
                    {settings.has_state_tax  && <strong style={{ marginLeft: 6 }}>State Tax ({settings.state_tax_rate || 0}%)</strong>}
                    {settings.has_city_tax   && <strong style={{ marginLeft: 6 }}>City Tax ({settings.city_tax_rate || 0}%)</strong>}
                    {settings.vat_exempt     && <strong style={{ marginLeft: 6 }}>VAT Exempt</strong>}
                  </span>
                  <button className="btn btn-primary btn-sm" onClick={handleSeedGeneric} disabled={seeding}>
                    {seeding ? 'Applying…' : 'Apply Admin Configuration'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="card">
            {taxRates.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Receipt size={40} strokeWidth={1.4} /></div>
                <div className="empty-state-title">No tax rates defined yet</div>
                <div className="empty-state-sub">{isPhilippines ? `Click "Load ${BIZ_LABELS[businessType]} Presets" to get started.` : 'Click "+ Add Tax Rate" to create your first rate.'}</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>Type</th>
                      <th className="td-right">Rate / Amount</th>
                      <th>Applies To</th>
                      <th>Frequency</th>
                      <th>Effective</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxRates.map(r => (
                      <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.5 }}>
                        <td style={{ fontWeight: 600 }}>
                          {r.name}
                          {r.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>{r.description}</div>}
                        </td>
                        <td><code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{r.code}</code></td>
                        <td style={{ fontSize: 12 }}>{TYPE_LABELS[r.type] || r.type}</td>
                        <td className="td-right tabular" style={{ fontWeight: 600 }}>
                          {r.type === 'percentage'  && `${r.rate}%${r.is_inclusive ? ' (incl.)' : ''}`}
                          {r.type === 'fixed_amount' && fmt(r.amount)}
                          {r.type === 'tiered'      && `${r.tiers?.length || 0} brackets`}
                        </td>
                        <td><span className="pill pill-primary">{APPLIES_LABELS[r.applies_to]}</span></td>
                        <td style={{ fontSize: 12 }}>{FREQ_LABELS[r.filing_frequency]}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {r.effective_from ? fmtDate(r.effective_from) : '—'}
                          {r.effective_to   ? ` → ${fmtDate(r.effective_to)}`   : ''}
                        </td>
                        <td>
                          <StatusPill status={r.is_active ? 'active' : 'inactive'} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            {can('finance') && (
                              <>
                                <button className="btn btn-ghost btn-sm" onClick={() => { setEditRate(r); setShowRateModal(true); }}>Edit</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => handleToggleActive(r)}>
                                  {r.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                                  onClick={() => handleDeleteRate(r)}><Trash2 size={14} /></button>
                              </>
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
        </div>
      )}

      {/* ── APPLICATIONS TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'applications' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            {can('finance') && (
              <button className="btn btn-primary" onClick={() => setShowApplyModal(true)} disabled={taxRates.filter(r => r.is_active).length === 0}>
                + Apply Tax to Invoice / Bill
              </button>
            )}
          </div>
          {taxRates.filter(r => r.is_active).length === 0 && (
            <div className="alert alert-info mb-16">Add at least one active tax rate before applying taxes to invoices.</div>
          )}
          <div className="card">
            {applications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Receipt size={40} strokeWidth={1.4} /></div>
                <div className="empty-state-title">No tax applications yet</div>
                <div className="empty-state-sub">Apply a tax rate to an invoice or bill to get started.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tax</th>
                      <th>Entity</th>
                      <th className="td-right">Base Amount</th>
                      <th className="td-right">Tax Amount</th>
                      <th>Journal Entry</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map(app => (
                      <tr key={app.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{app.tax_name}</div>
                          <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{app.tax_code}</code>
                        </td>
                        <td>
                          <span className="pill pill-primary">
                            {app.entity_type === 'receivable' ? 'Invoice' : 'Bill'} #{app.entity_id}
                          </span>
                        </td>
                        <td className="td-right tabular">{fmt(app.base_amount)}</td>
                        <td className="td-right tabular" style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmt(app.tax_amount)}</td>
                        <td>
                          {app.journal_entry_id
                            ? <StatusPill status="posted" label="Recorded" />
                            : <button className="btn btn-ghost btn-sm"
                                onClick={() => setJeApp(app)} style={{ fontSize: 11 }}>
                                Record JE
                              </button>}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(app.created_at)}</td>
                        <td>
                          {!app.journal_entry_id && can('finance') && (
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                              onClick={() => handleDeleteApplication(app)}><Trash2 size={14} /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PROJECTIONS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'projections' && (
        <div>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Year</label>
              <select className="form-input" value={projYear} onChange={e => setProjYear(parseInt(e.target.value))}>
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Group By</label>
              <select className="form-input" value={projPeriod} onChange={e => setProjPeriod(e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual (Full Year)</option>
              </select>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={loadProjections} disabled={projLoading}>
              {projLoading ? 'Loading…' : '↺ Refresh'}
            </button>
            {projections && (
              <button className="btn btn-ghost btn-sm" onClick={exportProjectionsCSV}>Export CSV</button>
            )}
          </div>

          {projLoading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-ink-mid)' }}>Calculating projections…</div>}

          {projections && !projLoading && (
            <>
              {/* Grand total */}
              <div className="grid-3 mb-20">
                <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                  <div className="stat-label">Estimated Total Tax ({projYear})</div>
                  <div className="stat-value">{fmt(projections.grand_total)}</div>
                  <div className="stat-sub">Across all active tax rates</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Sales (AR)</div>
                  <div className="stat-value">{fmt(projections.periods.reduce((s, p) => s + p.sales_base, 0))}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Purchases (AP)</div>
                  <div className="stat-value">{fmt(projections.periods.reduce((s, p) => s + p.purchases_base, 0))}</div>
                </div>
              </div>

              {taxRates.filter(r => r.is_active).length === 0 ? (
                <div className="alert alert-info">No active tax rates. Add tax rates in the Tax Rates tab to see projections.</div>
              ) : (
                <div className="card">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th className="td-right">Sales Base</th>
                          <th className="td-right">Purchases Base</th>
                          {projections.tax_rates.map(t => (
                            <th key={t.id} className="td-right" style={{ fontSize: 11 }}>
                              {t.name}<br /><span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t.code})</span>
                            </th>
                          ))}
                          <th className="td-right">Total Est. Tax</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projections.periods.map(p => (
                          <tr key={p.period_key} style={{ opacity: (p.sales_base + p.purchases_base) === 0 ? 0.45 : 1 }}>
                            <td style={{ fontWeight: 500 }}>{p.period_label}</td>
                            <td className="td-right tabular text-muted">{p.sales_base > 0 ? fmt(p.sales_base) : '—'}</td>
                            <td className="td-right tabular text-muted">{p.purchases_base > 0 ? fmt(p.purchases_base) : '—'}</td>
                            {p.tax_breakdown.map(td => (
                              <td key={td.tax_rate_id} className="td-right tabular" style={{ color: td.tax_amount > 0 ? 'var(--primary)' : 'var(--text-light)' }}>
                                {td.tax_amount > 0 ? fmt(td.tax_amount) : '—'}
                              </td>
                            ))}
                            <td className="td-right tabular" style={{ fontWeight: 700 }}>
                              {p.total_tax > 0 ? fmt(p.total_tax) : '—'}
                            </td>
                          </tr>
                        ))}
                        {/* Totals row */}
                        <tr style={{ fontWeight: 700, background: 'var(--color-surface-2)', borderTop: '2px solid var(--color-border)' }}>
                          <td>Total {projYear}</td>
                          <td className="td-right tabular">{fmt(projections.periods.reduce((s, p) => s + p.sales_base, 0))}</td>
                          <td className="td-right tabular">{fmt(projections.periods.reduce((s, p) => s + p.purchases_base, 0))}</td>
                          {projections.tax_rates.map(t => (
                            <td key={t.id} className="td-right tabular" style={{ color: 'var(--primary)' }}>
                              {fmt(projections.periods.reduce((s, p) => {
                                const td = p.tax_breakdown.find(b => b.tax_rate_id === t.id);
                                return s + (td?.tax_amount || 0);
                              }, 0))}
                            </td>
                          ))}
                          <td className="td-right tabular" style={{ color: 'var(--primary)' }}>{fmt(projections.grand_total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div style={{
                marginTop: 20, padding: '14px 18px', borderRadius: 8,
                background: '#fffbeb', border: '1px solid #fde68a',
                fontSize: 12, color: '#78350f', lineHeight: 1.6,
              }}>
                ⚠️ <strong>For estimation purposes only.</strong> These projections are calculated from the data recorded in this application and are intended as a preliminary guide. Actual tax liabilities may vary based on applicable deductions, exemptions, adjustments, and other factors. <strong>Please consult a licensed accountant or tax professional to verify these figures before filing.</strong>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── FILING TRACKER TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'filings' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { key: 'pending', label: 'Pending' },
                { key: 'filed',   label: 'Filed' },
                { key: 'paid',    label: 'Paid' },
              ].map(({ key, label }) => {
                const count = filings.filter(f => f.status === key).length;
                return (
                  <span key={key} className={`pill ${key === 'paid' ? 'pill-success' : key === 'filed' ? 'pill-accent' : 'pill-warning'}`}>
                    {label}: {count}
                  </span>
                );
              })}
            </div>
            {can('finance') && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="form-input" style={{ width: 100, height: 34, padding: '4px 8px' }}
                  value={scheduleYear} onChange={e => setScheduleYear(parseInt(e.target.value))}>
                  {[0, 1, -1].map(off => new Date().getFullYear() + off)
                    .sort((a, b) => a - b)
                    .map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button className="btn btn-ghost" onClick={handleGenerateSchedule} disabled={generating}>
                  {generating ? 'Generating…' : '📅 Generate BIR Schedule'}
                </button>
                <button className="btn btn-primary" onClick={() => { setEditFiling(null); setShowFilingModal(true); }}>
                  + Add Filing
                </button>
              </div>
            )}
          </div>

          <div className="alert alert-info mb-16" style={{ fontSize: 12 }}>
            ⚠ Due dates follow standard BIR rules and are <strong>guidance only</strong> — verify against the BIR
            and your filing method (eFPS/eBIRForms). Every date is editable, and holidays may move a deadline to the next business day.
          </div>

          <div className="card">
            {filings.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><BookOpen size={40} strokeWidth={1.4} /></div>
                <div className="empty-state-title">No filing records yet</div>
                <div className="empty-state-sub">Add a filing record to track your tax submissions.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Form / Tax</th>
                      <th>Period Type</th>
                      <th>Period</th>
                      <th>Due Date</th>
                      <th className="td-right">Tax Amount</th>
                      <th>Reference</th>
                      <th>Status</th>
                      <th>Filed At</th>
                      <th>Paid At</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filings.map(f => {
                      const todayStr = new Date().toISOString().slice(0, 10);
                      const soonStr  = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); })();
                      const isPending = f.status === 'pending';
                      const overdue   = isPending && f.due_date && f.due_date < todayStr;
                      const dueSoon   = isPending && f.due_date && !overdue && f.due_date <= soonStr;
                      const dueColor  = overdue ? 'var(--danger)' : dueSoon ? 'var(--warning, #7A5C0A)' : 'var(--text-muted)';
                      return (
                        <tr key={f.id}>
                          <td style={{ fontWeight: 500 }}>{f.form_name || f.tax_name || <span style={{ color: 'var(--color-ink-mid)' }}>— General —</span>}</td>
                          <td style={{ fontSize: 12 }}>{FREQ_LABELS[f.period_type] || f.period_type}</td>
                          <td style={{ fontSize: 12 }}>
                            {fmtDate(f.period_start)} → {fmtDate(f.period_end)}
                            {f.notes && <div style={{ fontSize: 11, color: 'var(--color-ink-mid)', marginTop: 2 }}>{f.notes}</div>}
                          </td>
                          <td style={{ fontSize: 12, color: dueColor, fontWeight: overdue || dueSoon ? 600 : 400, whiteSpace: 'nowrap' }}>
                            {f.due_date ? fmtDate(f.due_date) : '—'}
                            {overdue && <div style={{ fontSize: 10, fontWeight: 700 }}>OVERDUE</div>}
                            {dueSoon && <div style={{ fontSize: 10, fontWeight: 700 }}>DUE SOON</div>}
                          </td>
                          <td className="td-right tabular" style={{ fontWeight: 700 }}>{fmt(f.total_tax_amount)}</td>
                          <td style={{ fontSize: 12, color: 'var(--color-ink-mid)' }}>{f.reference || '—'}</td>
                          <td>
                            <StatusPill status={f.status === 'paid' ? 'paid' : f.status === 'filed' ? 'posted' : 'pending'}
                              label={f.status === 'paid' ? 'Paid' : f.status === 'filed' ? 'Filed' : 'Pending'} />
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.filed_at ? fmtDate(f.filed_at) : '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.paid_at  ? fmtDate(f.paid_at)  : '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              {f.status === 'pending' && can('finance') && (
                                <button className="btn btn-ghost btn-sm" onClick={() => handleUpdateFilingStatus(f, 'filed')}>Mark Filed</button>
                              )}
                              {f.status === 'filed' && can('finance') && (
                                <button className="btn btn-success btn-sm" onClick={() => handleUpdateFilingStatus(f, 'paid')}>Mark Paid</button>
                              )}
                              {can('finance') && (
                                <>
                                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditFiling(f); setShowFilingModal(true); }}>Edit</button>
                                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteFiling(f)}><Trash2 size={14} /></button>
                                </>
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
        </div>
      )}
    </div>
  );
}
