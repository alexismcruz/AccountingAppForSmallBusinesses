import { useState } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { CURRENCIES } from '../data/currencies.js';

export default function Settings() {
  const { settings, setSettings } = useSettings();
  const [form, setForm] = useState({ ...settings });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleCurrencyChange = (code) => {
    const cur = CURRENCIES.find(c => c.code === code);
    if (cur) setForm(f => ({ ...f, currency: cur.code, currency_symbol: cur.symbol }));
  };

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: 'Failed to save settings.' }); return; }
      setSettings(data);
      setMsg({ type: 'success', text: 'Settings saved successfully.' });
    } catch { setMsg({ type: 'error', text: 'Network error.' }); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Business Settings</div>
          <div className="page-subtitle">Configure your business information and preferences</div>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'} mb-16`}>{msg.type === 'success' ? '✓ ' : '⚠ '}{msg.text}</div>}

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="section-title">Business Information</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Business Name *</label>
            <input className="form-input" value={form.business_name || ''}
              onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
              placeholder="Your business name" />
          </div>
          <div className="grid-2 gap-16">
            <div className="form-group">
              <label className="form-label">Registration Number</label>
              <input className="form-input" value={form.registration_number || ''}
                onChange={e => setForm(f => ({ ...f, registration_number: e.target.value }))}
                placeholder="Business Registration Number / SEC Registration / Corp Registration" />
            </div>
            <div className="form-group">
              <label className="form-label">Tax Identification Number (TIN)</label>
              <input className="form-input" value={form.tax_id || ''}
                onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))}
                placeholder="Tax Identification Number" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Business Address</label>
            <textarea className="form-textarea" value={form.address || ''}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Street, City, Province, Country" rows={3} />
          </div>
        </div>

        <div className="divider" />
        <div className="section-title">Accounting Preferences</div>
        <div className="grid-2 gap-16">
          <div className="form-group">
            <label className="form-label">Currency</label>
            <select className="form-select" value={form.currency || 'USD'}
              onChange={e => handleCurrencyChange(e.target.value)}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Currency Symbol</label>
            <input className="form-input" value={form.currency_symbol || '$'}
              onChange={e => setForm(f => ({ ...f, currency_symbol: e.target.value }))}
              placeholder="$" style={{ maxWidth: 80 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Fiscal Year Start (MM-DD)</label>
            <input className="form-input" value={form.fiscal_year_start || '01-01'}
              onChange={e => setForm(f => ({ ...f, fiscal_year_start: e.target.value }))}
              placeholder="01-01" />
            <div className="text-muted text-sm mt-8">Most businesses use January 1 (01-01)</div>
          </div>
        </div>

        <div className="divider" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setForm({ ...settings })}>Reset</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : '✓ Save Settings'}
          </button>
        </div>
      </div>

      {/* Help section */}
      <div className="card mt-16" style={{ maxWidth: 640, background: 'var(--primary-light)', border: '1px solid #bfdbfe' }}>
        <div className="section-title">Getting Started Tips</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
          {[
            ['1', 'Set your business name and currency above first.'],
            ['2', 'Record your owner investment: Journal Entries → Use Template → "Owner Investment"'],
            ['3', 'Pay business registration fees: Journal Entries → Use Template → "Business Registration"'],
            ['4', 'Add your products: Inventory → Add Item'],
            ['5', 'Record a purchase: Journal Entries → "Buy Inventory (Cash or Credit)"'],
            ['6', 'Track who owes you money: Payments → Incoming'],
            ['7', 'Track what you owe: Payments → Pending'],
            ['8', 'View your financial health: Reports → Balance Sheet'],
          ].map(([num, text]) => (
            <div key={num} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{num}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
