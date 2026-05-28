const express = require('express');
const router  = express.Router();
const { query } = require('../../db/database');

// ── Connector registry — add future connectors here ───────────────────────────
const CONNECTORS = {
  bigcommerce: require('./bigcommerce'),
  // shopify:  require('./shopify'),   // future
  // woocommerce: require('./woocommerce'), // future
};

// Mask sensitive credential fields for API responses
function maskCredentials(creds = {}) {
  const SENSITIVE = ['access_token', 'client_secret', 'webhook_secret', 'api_key', 'api_secret'];
  const masked = { ...creds };
  for (const key of SENSITIVE) {
    if (masked[key]) masked[key] = '••••••••';
  }
  return masked;
}

// Only admins/super_admins can manage integrations
function requireAdmin(req, res, next) {
  const role = req.session?.user?.role;
  if (!['admin', 'super_admin'].includes(role))
    return res.status(403).json({ error: 'Admin access required to manage integrations' });
  next();
}

// ── GET /api/integrations — list all connectors + their stored status ─────────
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { rows } = await query('SELECT provider, enabled, settings, last_sync_at, updated_at FROM integrations');
    const stored   = Object.fromEntries(rows.map(r => [r.provider, r]));

    const list = Object.values(CONNECTORS).map(c => {
      const s = stored[c.MANIFEST.slug] || {};
      return {
        ...c.MANIFEST,
        enabled:      s.enabled      || false,
        last_sync_at: s.last_sync_at || null,
        updated_at:   s.updated_at   || null,
        configured:   !!s.enabled,   // true if row exists and enabled
      };
    });

    // Add placeholder "coming soon" connectors so UI knows what's planned
    const COMING_SOON = [
      { slug: 'shopify',    name: 'Shopify',    icon: '🟢', description: 'Sync Shopify orders and products.',           coming_soon: true },
      { slug: 'woocommerce',name: 'WooCommerce', icon: '🔵', description: 'Sync WooCommerce orders and inventory.',       coming_soon: true },
    ].filter(cs => !CONNECTORS[cs.slug]);

    res.json([...list, ...COMING_SOON]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/integrations/:provider — get settings (credentials masked) ───────
router.get('/:provider', requireAdmin, async (req, res) => {
  const { provider } = req.params;
  const connector = CONNECTORS[provider];
  if (!connector) return res.status(404).json({ error: `Unknown provider: ${provider}` });

  try {
    const { rows: [row] } = await query(
      'SELECT provider, enabled, credentials, settings, last_sync_at, updated_at FROM integrations WHERE provider=$1',
      [provider]
    );
    res.json({
      ...connector.MANIFEST,
      enabled:      row?.enabled      || false,
      credentials:  maskCredentials(row?.credentials || {}),
      settings:     row?.settings     || {},
      last_sync_at: row?.last_sync_at || null,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/integrations/:provider — save credentials + enabled ──────────────
router.put('/:provider', requireAdmin, async (req, res) => {
  const { provider } = req.params;
  const connector = CONNECTORS[provider];
  if (!connector) return res.status(404).json({ error: `Unknown provider: ${provider}` });

  const { enabled, credentials: newCreds = {}, settings = {} } = req.body;

  try {
    // Merge with existing (don't overwrite masked fields with "••••••••")
    const { rows: [existing] } = await query(
      'SELECT credentials FROM integrations WHERE provider=$1', [provider]
    );
    const prevCreds = existing?.credentials || {};
    const merged    = { ...prevCreds };
    for (const [k, v] of Object.entries(newCreds)) {
      if (v && v !== '••••••••') merged[k] = v;  // only write real values
    }

    await query(
      `INSERT INTO integrations (provider, enabled, credentials, settings, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (provider) DO UPDATE
         SET enabled=$2, credentials=$3, settings=$4, updated_at=NOW()`,
      [provider, enabled ?? false, JSON.stringify(merged), JSON.stringify(settings)]
    );

    res.json({ ok: true, enabled: enabled ?? false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/integrations/:provider/test — verify API credentials ────────────
router.post('/:provider/test', requireAdmin, async (req, res) => {
  const { provider } = req.params;
  const connector = CONNECTORS[provider];
  if (!connector) return res.status(404).json({ error: `Unknown provider: ${provider}` });

  try {
    const { rows: [row] } = await query(
      'SELECT credentials FROM integrations WHERE provider=$1', [provider]
    );
    if (!row) return res.status(400).json({ error: 'No credentials saved yet' });
    const result = await connector.testConnection(row.credentials);
    res.json(result);
  } catch (e) { res.status(422).json({ error: e.message }); }
});

// ── POST /api/integrations/:provider/sync/orders ──────────────────────────────
router.post('/:provider/sync/orders', requireAdmin, async (req, res) => {
  const { provider } = req.params;
  const connector = CONNECTORS[provider];
  if (!connector?.syncOrders) return res.status(404).json({ error: `Unknown provider or no order sync: ${provider}` });

  try {
    const { rows: [row] } = await query(
      'SELECT credentials, enabled FROM integrations WHERE provider=$1', [provider]
    );
    if (!row?.enabled) return res.status(400).json({ error: 'Integration is disabled' });
    const result = await connector.syncOrders(row.credentials);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/integrations/:provider/sync/inventory ───────────────────────────
router.post('/:provider/sync/inventory', requireAdmin, async (req, res) => {
  const { provider } = req.params;
  const connector = CONNECTORS[provider];
  if (!connector?.syncInventory) return res.status(404).json({ error: `Unknown provider or no inventory sync: ${provider}` });

  try {
    const { rows: [row] } = await query(
      'SELECT credentials, enabled FROM integrations WHERE provider=$1', [provider]
    );
    if (!row?.enabled) return res.status(400).json({ error: 'Integration is disabled' });
    const result = await connector.syncInventory(row.credentials);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/integrations/:provider/webhooks/register ────────────────────────
router.post('/:provider/webhooks/register', requireAdmin, async (req, res) => {
  const { provider }    = req.params;
  const { webhookBaseUrl } = req.body;
  const connector = CONNECTORS[provider];
  if (!connector?.registerWebhooks) return res.status(404).json({ error: `Unknown provider: ${provider}` });

  if (!webhookBaseUrl) return res.status(400).json({ error: 'webhookBaseUrl is required' });

  try {
    const { rows: [row] } = await query(
      'SELECT credentials FROM integrations WHERE provider=$1', [provider]
    );
    if (!row) return res.status(400).json({ error: 'No credentials saved yet' });
    const result = await connector.registerWebhooks(row.credentials, webhookBaseUrl);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
