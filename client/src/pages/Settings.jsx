import { useState } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useUser } from '../context/UserContext.jsx';
import { CURRENCIES } from '../data/currencies.js';
import CharCount from '../components/CharCount.jsx';

const TOGGLEABLE_MODULES = [
  {
    key:         'hr',
    icon:        '👥',
    label:       'HR & Payroll',
    description: 'Employees, payroll runs, leave management, and BIR payroll forms',
  },
  {
    key:         'inventory',
    icon:        '📦',
    label:       'Inventory',
    description: 'Track stock levels, SKUs, reorder points, and inventory costs',
  },
  {
    key:         'payments',
    icon:        '💳',
    label:       'Payments (AR / AP)',
    description: 'Incoming receivables, pending payables, and payment schedules',
  },
  {
    key:         'tax',
    icon:        '🧾',
    label:       'Tax',
    description: 'Tax rates, applications, projections, and filing tracker',
  },
];

export default function Settings() {
  const { settings, setSettings } = useSettings();
  const { user } = useUser();
  const [form, setForm] = useState({ ...settings });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [moduleMsg, setModuleMsg] = useState(null);
  const [moduleSaving, setModuleSaving] = useState(false);

  // Derive current module list from live settings
  const enabledModules = Array.isArray(settings.enabled_modules)
    ? settings.enabled_modules
    : ['hr', 'inventory', 'payments', 'tax'];

  const handleModuleToggle = async (key) => {
    const next = enabledModules.includes(key)
      ? enabledModules.filter(m => m !== key)
      : [...enabledModules, key];
    setModuleSaving(true); setModuleMsg(null);
    try {
      const res = await fetch('/api/settings/modules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled_modules: next }),
      });
      const data = await res.json();
      if (!res.ok) { setModuleMsg({ type: 'error', text: data.error || 'Failed to update modules.' }); return; }
      setSettings(s => ({ ...s, enabled_modules: data.enabled_modules }));
      setModuleMsg({ type: 'success', text: '✓ Module settings updated.' });
      setTimeout(() => setModuleMsg(null), 3000);
    } catch { setModuleMsg({ type: 'error', text: 'Network error.' }); }
    finally { setModuleSaving(false); }
  };

  const handleCurrencyChange = (code) => {
    const cur = CURRENCIES.find(c => c.code === code);
    if (cur) setForm(f => ({ ...f, currency: cur.code, currency_symbol: cur.symbol }));
  };

  const handleReset = async () => {
    if (!window.confirm(
      'Reset sandbox to default demo data?\n\n' +
      'This will permanently erase ALL current data (journal entries, inventory, payments, approvals, logs) ' +
      'and restore the XYZ Trading Co. demo dataset.\n\nThis cannot be undone. Continue?'
    )) return;
    setResetting(true); setMsg(null);
    try {
      const res = await fetch('/api/sandbox/reset', {
        method: 'POST', credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.error || 'Reset failed.' }); return; }
      setMsg({ type: 'success', text: '✓ Sandbox reset complete — demo data restored. Refresh the page to see the changes.' });
    } catch { setMsg({ type: 'error', text: 'Network error. Please try again.' }); }
    finally { setResetting(false); }
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
              maxLength={100}
              onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
              placeholder="Your business name" />
            <CharCount value={form.business_name} max={100} />
          </div>
          <div className="grid-2 gap-16">
            <div className="form-group">
              <label className="form-label">Registration Number</label>
              <input className="form-input" value={form.registration_number || ''}
                maxLength={50}
                onChange={e => setForm(f => ({ ...f, registration_number: e.target.value }))}
                placeholder="Business Registration Number / SEC Registration / Corp Registration" />
              <CharCount value={form.registration_number} max={50} />
            </div>
            <div className="form-group">
              <label className="form-label">Tax Identification Number (TIN)</label>
              <input className="form-input" value={form.tax_id || ''}
                maxLength={50}
                onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))}
                placeholder="Tax Identification Number" />
              <CharCount value={form.tax_id} max={50} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Business Address</label>
            <textarea className="form-textarea" value={form.address || ''}
              maxLength={600}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Street, City, Province, Country"
              rows={7}
              style={{ resize: 'vertical' }} />
            <CharCount value={form.address} max={600} />
          </div>
        </div>

        <div className="divider" />
        <div className="section-title">Accounting Preferences</div>
        <div className="grid-2 gap-16">
          <div className="form-group">
            <label className="form-label">Currency</label>
            <select className="form-select" value={form.currency || 'PHP'}
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

      {/* Module Management — super_admin only */}
      {user?.role === 'super_admin' && (
        <div className="card mt-16" style={{ maxWidth: 640 }}>
          <div className="section-title">🧩 Module Management</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Turn modules on or off for this account. Disabled modules are hidden from all users
            immediately — no logout required.
          </p>

          {moduleMsg && (
            <div className={`alert alert-${moduleMsg.type === 'error' ? 'error' : 'success'} mb-16`}>
              {moduleMsg.text}
            </div>
          )}

          {/* Always-on modules (locked) */}
          <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Always included
          </div>
          {[
            { icon: '🏠', label: 'Core Accounting',   description: 'Dashboard, journal entries, chart of accounts, reports, approvals' },
            { icon: '✨', label: 'AI Chatbot',         description: 'AI accounting assistant — always available to all users' },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{m.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.description}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, background: '#dcfce7', padding: '2px 10px', borderRadius: 999 }}>
                Always On
              </span>
            </div>
          ))}

          {/* Toggleable modules */}
          <div style={{ marginTop: 16, marginBottom: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Optional modules
          </div>
          {TOGGLEABLE_MODULES.map(m => {
            const isOn = enabledModules.includes(m.key);
            return (
              <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.description}</div>
                </div>
                {/* Toggle switch */}
                <button
                  onClick={() => !moduleSaving && handleModuleToggle(m.key)}
                  disabled={moduleSaving}
                  title={isOn ? 'Click to disable' : 'Click to enable'}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: moduleSaving ? 'not-allowed' : 'pointer',
                    background: isOn ? 'var(--primary)' : '#cbd5e1',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: isOn ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Sandbox reset — only shown in SANDBOX_MODE and only to super_admin */}
      {settings.sandboxMode && user?.role === 'super_admin' && (
        <div className="card mt-16" style={{ maxWidth: 640, background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <div className="section-title" style={{ color: '#92400e' }}>🧪 Sandbox Controls</div>
          <p style={{ fontSize: 13, color: '#78350f', marginBottom: 16 }}>
            Reset all data back to the default XYZ Trading Co. demo dataset. This permanently erases
            all current entries, inventory, payments, approvals, and logs.
          </p>
          <button
            className="btn btn-danger"
            onClick={handleReset}
            disabled={resetting}
          >
            {resetting ? '⏳ Resetting…' : '🔄 Reset Sandbox to Demo Data'}
          </button>
        </div>
      )}
    </div>
  );
}
