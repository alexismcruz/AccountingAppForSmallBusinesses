const crypto = require('crypto');
const { upsertReceivable, upsertInventory, touchLastSync } = require('./_shared');

// ── Manifest ───────────────────────────────────────────────────────────────────
const MANIFEST = {
  name:        'WooCommerce',
  slug:        'woocommerce',
  description: 'Sync WooCommerce orders and products into CuentaIQ automatically.',
  icon:        '🟣',
  helpText:    'In WooCommerce: WooCommerce → Settings → Advanced → REST API → Add key, give it Read/Write access, and copy the Consumer key & secret. Set a Webhook Secret below (any strong random string) FIRST, then click Register Webhooks — CuentaIQ creates the webhooks for you and uses the secret to verify them. Your store must be reachable over HTTPS.',
  credentialFields: [
    { key: 'store_url',       label: 'Store URL',       type: 'text',     placeholder: 'https://yourstore.com' },
    { key: 'consumer_key',    label: 'Consumer Key',    type: 'password', placeholder: 'ck_…' },
    { key: 'consumer_secret', label: 'Consumer Secret', type: 'password', placeholder: 'cs_…' },
    { key: 'webhook_secret',  label: 'Webhook Secret',  type: 'password', placeholder: 'Any strong random string — verifies incoming webhooks' },
  ],
};

function apiBase(creds) { return `${String(creds.store_url || '').replace(/\/$/, '')}/wp-json/wc/v3`; }
function authHeader(creds) {
  return 'Basic ' + Buffer.from(`${creds.consumer_key}:${creds.consumer_secret}`).toString('base64');
}

async function wcGet(creds, path) {
  const res = await fetch(`${apiBase(creds)}${path}`, {
    headers: { 'Authorization': authHeader(creds), 'Accept': 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`WooCommerce ${res.status} on GET ${path}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function wcPost(creds, path, body) {
  const res = await fetch(`${apiBase(creds)}${path}`, {
    method: 'POST',
    headers: { 'Authorization': authHeader(creds), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WooCommerce ${res.status} on POST ${path}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

// ── Webhook verification (HMAC-SHA256 of raw body with the webhook secret) ─────
function verifyWebhook(req, credentials) {
  const secret = credentials.webhook_secret;
  const header = req.headers['x-wc-webhook-signature'];
  if (!secret || !header || !req.rawBody) return false;
  const digest = crypto.createHmac('sha256', secret).update(req.rawBody).digest('base64');
  try {
    const a = Buffer.from(digest), b = Buffer.from(String(header));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

function parseWebhook(req) {
  return { scope: req.headers['x-wc-webhook-topic'], data: req.body || {} };
}

// ── Mapping ────────────────────────────────────────────────────────────────────
function mapOrder(order) {
  const b = order.billing || {};
  const name = [b.first_name, b.last_name].filter(Boolean).join(' ').trim()
            || b.company || b.email
            || `WooCommerce Customer #${order.customer_id || order.id}`;
  const paid = ['processing', 'completed'].includes((order.status || '').toLowerCase()) || !!order.date_paid;
  return {
    invoice_number: `WC-${order.id}`,
    customer_name:  name,
    description:    `WooCommerce Order #${order.number || order.id}`,
    amount:         parseFloat(order.total) || 0,
    currency:       order.currency || 'PHP',
    exchange_rate:  1.0,
    status:         paid ? 'paid' : 'pending',
    source:         'WooCommerce Sync',
  };
}

function mapProduct(p) {
  return {
    sku:       (p.sku || '').trim() || `WC-${p.id}`,
    name:      p.name,
    quantity:  p.stock_quantity ?? 0,
    unit_cost: parseFloat(p.price) || 0,
    source:    'WooCommerce Sync',
  };
}

// ── Webhook handler (WooCommerce sends the full resource in the body) ──────────
async function handleWebhook(scope, data, _credentials) {
  if (!data || !data.id) return { action: 'ignored', scope };
  if (scope === 'order.created' || scope === 'order.updated') return upsertReceivable(mapOrder(data));
  if (scope === 'product.created' || scope === 'product.updated') return upsertInventory(mapProduct(data));
  return { action: 'ignored', scope };
}

// ── Test / sync / register ─────────────────────────────────────────────────────
async function testConnection(creds) {
  if (!creds.store_url || !creds.consumer_key || !creds.consumer_secret)
    throw new Error('Store URL, Consumer Key and Consumer Secret are required');
  const data = await wcGet(creds, '/system_status');
  const env = data?.environment || {};
  return { ok: true, store_name: env.site_url || creds.store_url, store_url: env.site_url, plan: `WooCommerce ${env.version || ''}`.trim() };
}

async function syncOrders(creds) {
  const orders = await wcGet(creds, '/orders?per_page=50&orderby=date&order=desc');
  if (!Array.isArray(orders)) return { synced: 0, total: 0, errors: ['No orders returned — check credentials'] };
  let synced = 0; const errors = [];
  for (const o of orders) {
    try { await upsertReceivable(mapOrder(o)); synced++; }
    catch (err) { errors.push(`Order #${o.number || o.id}: ${err.message}`); }
  }
  await touchLastSync('woocommerce');
  return { synced, total: orders.length, errors };
}

async function syncInventory(creds) {
  const products = await wcGet(creds, '/products?per_page=50');
  if (!Array.isArray(products)) return { synced: 0, total: 0, errors: ['No products returned — check credentials'] };
  let synced = 0; const errors = [];
  for (const p of products) {
    try { await upsertInventory(mapProduct(p)); synced++; }
    catch (err) { errors.push(`Product ${p.name || p.id}: ${err.message}`); }
  }
  await touchLastSync('woocommerce');
  return { synced, total: products.length, errors };
}

async function registerWebhooks(creds, webhookBaseUrl) {
  if (!creds.store_url || !creds.consumer_key || !creds.consumer_secret)
    throw new Error('Store URL, Consumer Key and Consumer Secret are required');
  const delivery_url = `${webhookBaseUrl.replace(/\/$/, '')}/api/webhooks/woocommerce`;
  const TOPICS = ['order.created', 'order.updated', 'product.created', 'product.updated'];

  let existing = new Set();
  try {
    const hooks = await wcGet(creds, '/webhooks?per_page=100');
    (Array.isArray(hooks) ? hooks : []).filter(h => h.delivery_url === delivery_url).forEach(h => existing.add(h.topic));
  } catch { /* ignore */ }

  const results = [];
  for (const topic of TOPICS) {
    if (existing.has(topic)) { results.push({ scope: topic, status: 'already_registered' }); continue; }
    try {
      await wcPost(creds, '/webhooks', { name: `CuentaIQ — ${topic}`, topic, delivery_url, secret: creds.webhook_secret || '' });
      results.push({ scope: topic, status: 'registered' });
    } catch (err) {
      results.push({ scope: topic, status: 'error', message: err.message });
    }
  }
  return { destination: delivery_url, results };
}

module.exports = {
  MANIFEST, verifyWebhook, parseWebhook, handleWebhook,
  testConnection, syncOrders, syncInventory, registerWebhooks,
};
