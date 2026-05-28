import { useState, useEffect } from 'react';

// ── Copy-to-clipboard helper ──────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className="btn btn-ghost btn-sm" onClick={handleCopy} style={{ fontSize: 11 }}>
      {copied ? '✓ Copied' : '📋 Copy'}
    </button>
  );
}

// ── Credential field ──────────────────────────────────────────────────────────
function CredField({ field, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div className="form-group">
      <label className="form-label">{field.label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="form-input"
          type={field.type === 'password' && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          style={{ flex: 1 }}
        />
        {field.type === 'password' && (
          <button type="button" className="btn btn-ghost btn-sm"
            onClick={() => setShow(s => !s)} style={{ flexShrink: 0 }}>
            {show ? '🙈' : '👁'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── BigCommerce connector card ─────────────────────────────────────────────────
function ConnectorCard({ connector, onRefresh }) {
  const [expanded,    setExpanded]    = useState(false);
  const [detail,      setDetail]      = useState(null);
  const [creds,       setCreds]       = useState({});
  const [enabled,     setEnabled]     = useState(connector.enabled);
  const [saving,      setSaving]      = useState(false);
  const [testing,     setTesting]     = useState(false);
  const [syncing,     setSyncing]     = useState('');
  const [registering, setRegistering] = useState(false);
  const [msg,         setMsg]         = useState(null);
  const [webhookUrl,  setWebhookUrl]  = useState('');

  // Auto-detect base URL for webhook registration
  useEffect(() => {
    setWebhookUrl(window.location.origin);
  }, []);

  // Load detail when expanded
  useEffect(() => {
    if (!expanded || detail) return;
    fetch(`/api/integrations/${connector.slug}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setDetail(d);
        setEnabled(d.enabled);
        // Pre-fill credential fields (masked values show as placeholder text)
        const filled = {};
        (d.credentialFields || []).forEach(f => {
          filled[f.key] = d.credentials?.[f.key] || '';
        });
        setCreds(filled);
      })
      .catch(() => {});
  }, [expanded]);

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const res  = await fetch(`/api/integrations/${connector.slug}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled, credentials: creds }),
      });
      const data = await res.json();
      if (!res.ok) { showMsg('error', data.error); return; }
      showMsg('success', 'Settings saved.');
      onRefresh();
    } catch { showMsg('error', 'Network error.'); }
    finally   { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true); setMsg(null);
    try {
      const res  = await fetch(`/api/integrations/${connector.slug}/test`, {
        method: 'POST', credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { showMsg('error', `Connection failed: ${data.error}`); return; }
      showMsg('success', `✓ Connected to "${data.store_name}" (${data.plan || 'standard'} plan)`);
    } catch { showMsg('error', 'Network error during test.'); }
    finally   { setTesting(false); }
  };

  const handleSync = async (type) => {
    setSyncing(type); setMsg(null);
    try {
      const res  = await fetch(`/api/integrations/${connector.slug}/sync/${type}`, {
        method: 'POST', credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { showMsg('error', data.error); return; }
      const errs = data.errors?.length ? ` (${data.errors.length} errors)` : '';
      showMsg('success', `✓ Synced ${data.synced} of ${data.total} ${type}${errs}`);
      onRefresh();
    } catch { showMsg('error', `Network error syncing ${type}.`); }
    finally   { setSyncing(''); }
  };

  const handleRegisterWebhooks = async () => {
    if (!webhookUrl) { showMsg('error', 'Enter your app base URL first.'); return; }
    setRegistering(true); setMsg(null);
    try {
      const res  = await fetch(`/api/integrations/${connector.slug}/webhooks/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ webhookBaseUrl: webhookUrl }),
      });
      const data = await res.json();
      if (!res.ok) { showMsg('error', data.error); return; }
      const registered = data.results?.filter(r => r.status === 'registered').length || 0;
      const existing   = data.results?.filter(r => r.status === 'already_registered').length || 0;
      showMsg('success', `✓ ${registered} webhook(s) registered, ${existing} already existed.`);
    } catch { showMsg('error', 'Network error registering webhooks.'); }
    finally   { setRegistering(false); }
  };

  if (connector.coming_soon) {
    return (
      <div className="card" style={{ opacity: 0.6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>{connector.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{connector.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{connector.description}</div>
          </div>
          <span className="badge" style={{ background: '#e2e8f0', color: '#64748b' }}>Coming Soon</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* ── Header row ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
           onClick={() => setExpanded(e => !e)}>
        <span style={{ fontSize: 28 }}>{connector.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{connector.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{connector.description}</div>
          {connector.last_sync_at && (
            <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>
              Last synced: {new Date(connector.last_sync_at).toLocaleString()}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`badge ${connector.enabled ? 'badge-success' : ''}`}
                style={!connector.enabled ? { background: '#e2e8f0', color: '#64748b' } : {}}>
            {connector.enabled ? '● Active' : '○ Disabled'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ── Expanded config panel ────────────────────────────────────────── */}
      {expanded && (
        <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 20 }}>

          {msg && (
            <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'} mb-16`}>
              {msg.type === 'error' ? '⚠ ' : '✓ '}{msg.text}
            </div>
          )}

          {/* Enable toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <label style={{ fontWeight: 600, fontSize: 14 }}>Enable integration</label>
            <div
              onClick={() => setEnabled(e => !e)}
              style={{
                width: 44, height: 24, borderRadius: 12, cursor: 'pointer', position: 'relative',
                background: enabled ? 'var(--primary)' : '#cbd5e1', transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: enabled ? 22 : 2,
                width: 20, height: 20, borderRadius: 10, background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {enabled ? 'Webhooks and sync are active' : 'Integration is paused'}
            </span>
          </div>

          {/* Credential fields */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              API Credentials
            </div>
            <div className="grid-2">
              {(detail?.credentialFields || connector.credentialFields || []).map(field => (
                <CredField key={field.key} field={field}
                  value={creds[field.key] || ''}
                  onChange={val => setCreds(c => ({ ...c, [field.key]: val }))} />
              ))}
            </div>
            <div className="alert alert-info" style={{ fontSize: 12, marginTop: 8 }}>
              💡 Find your Store Hash, Client ID, and Access Token in your BigCommerce admin under
              <strong> Settings → API → API Accounts</strong>. Create a V2/V3 API account with
              Orders (read) and Products (read/write) scope.
            </div>
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : '💾 Save Settings'}
            </button>
            <button className="btn btn-ghost" onClick={handleTest} disabled={testing}>
              {testing ? 'Testing…' : '🔌 Test Connection'}
            </button>
          </div>

          {/* Divider */}
          <div className="divider" />

          {/* Webhook registration */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Webhook Setup
            </div>
            <div className="alert alert-info" style={{ fontSize: 12, marginBottom: 12 }}>
              Click <strong>Register Webhooks</strong> to auto-register all required webhooks in your BigCommerce store.
              Orders and product changes will then sync automatically in real time.
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Your App Base URL</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" value={webhookUrl} style={{ flex: 1 }}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://yourstore.cuentaiq.com" />
                <CopyButton text={`${webhookUrl}/api/webhooks/bigcommerce`} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Webhook endpoint: <code>{webhookUrl}/api/webhooks/bigcommerce</code>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={handleRegisterWebhooks} disabled={registering}>
              {registering ? 'Registering…' : '🔗 Register Webhooks in BigCommerce'}
            </button>
          </div>

          {/* Divider */}
          <div className="divider" />

          {/* Manual sync */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Manual Sync
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Pulls the most recent 50 records from BigCommerce. Use this for the initial import or if a webhook was missed.
              Existing records are matched by invoice number / SKU and updated — no duplicates.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={() => handleSync('orders')}
                disabled={!!syncing || !connector.enabled}>
                {syncing === 'orders' ? '⏳ Syncing orders…' : '📥 Sync Orders → AR'}
              </button>
              <button className="btn btn-ghost" onClick={() => handleSync('inventory')}
                disabled={!!syncing || !connector.enabled}>
                {syncing === 'inventory' ? '⏳ Syncing inventory…' : '📦 Sync Products → Inventory'}
              </button>
            </div>
            {!connector.enabled && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                ↑ Enable the integration and save first.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Integrations() {
  const [connectors, setConnectors] = useState([]);
  const [loading,    setLoading]    = useState(true);

  const load = () => {
    setLoading(true);
    fetch('/api/integrations', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setConnectors(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-muted text-center" style={{ padding: 60 }}>Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Integrations</div>
          <div className="page-subtitle">Connect CuentaIQ to your e-commerce and business tools</div>
        </div>
      </div>

      <div className="alert alert-info mb-16" style={{ fontSize: 13 }}>
        🔗 Integrations automatically sync orders and inventory between your store and CuentaIQ.
        Orders become <strong>Accounts Receivable</strong> entries; products sync to <strong>Inventory</strong>.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {connectors.map(c => (
          <ConnectorCard key={c.slug} connector={c} onRefresh={load} />
        ))}
      </div>
    </div>
  );
}
