const crypto = require('crypto');
const { upsertReceivable, upsertInventory, touchLastSync } = require('./_shared');

// ── Manifest (read by registry + UI) ──────────────────────────────────────────
const MANIFEST = {
  name:        'Shopify',
  slug:        'shopify',
  description: 'Sync Shopify orders and products into CuentaIQ automatically.',
  icon:        '🛒',
  helpText:    'In Shopify admin: Settings → Apps and sales channels → Develop apps → Create an app. Add Admin API scopes read_orders and read_products, Install the app, then copy the Admin API access token. The "API secret key" (on the app\'s API credentials page) is used to verify incoming webhooks.',
  credentialFields: [
    { key: 'shop_domain',  label: 'Shop Domain',            type: 'text',     placeholder: 'your-store.myshopify.com' },
    { key: 'access_token', label: 'Admin API Access Token', type: 'password', placeholder: 'shpat_…' },
    { key: 'api_secret',   label: 'API Secret Key',         type: 'password', placeholder: 'Used to verify incoming webhooks' },
    { key: 'api_version',  label: 'API Version (optional)', type: 'text',     placeholder: '2025-01' },
  ],
};

const DEFAULT_VERSION = '2025-01';

function base(creds) {
  const shop = String(creds.shop_domain || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `https://${shop}/admin/api/${creds.api_version || DEFAULT_VERSION}`;
}

async function shopGet(creds, path) {
  const res = await fetch(`${base(creds)}${path}`, {
    headers: { 'X-Shopify-Access-Token': creds.access_token, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Shopify ${res.status} on GET ${path}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function shopPost(creds, path, body) {
  const res = await fetch(`${base(creds)}${path}`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': creds.access_token, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Shopify ${res.status} on POST ${path}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

// ── Webhook verification (HMAC-SHA256 of raw body with the API secret) ─────────
function verifyWebhook(req, credentials) {
  const secret = credentials.api_secret;
  const header = req.headers['x-shopify-hmac-sha256'];
  if (!secret || !header || !req.rawBody) return false;
  const digest = crypto.createHmac('sha256', secret).update(req.rawBody).digest('base64');
  try {
    const a = Buffer.from(digest), b = Buffer.from(String(header));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

function parseWebhook(req) {
  return { scope: req.headers['x-shopify-topic'], data: req.body || {} };
}

// ── Mapping ────────────────────────────────────────────────────────────────────
function mapOrder(order) {
  const c = order.customer || {};
  const b = order.billing_address || {};
  const name = [c.first_name || b.first_name, c.last_name || b.last_name].filter(Boolean).join(' ').trim()
            || order.email
            || `Shopify Customer #${c.id || order.id}`;
  return {
    invoice_number: `SH-${order.id}`,
    customer_name:  name,
    description:    `Shopify Order ${order.name || '#' + order.id}`,
    amount:         parseFloat(order.total_price) || 0,
    currency:       order.currency || 'PHP',
    exchange_rate:  1.0,
    status:         (order.financial_status || '').toLowerCase() === 'paid' ? 'paid' : 'pending',
    source:         'Shopify Sync',
  };
}

async function upsertProduct(product) {
  let count = 0;
  for (const v of (product.variants || [])) {
    const sku  = (v.sku || '').trim() || `SH-${v.id}`;
    const name = product.title + (v.title && v.title !== 'Default Title' ? ` - ${v.title}` : '');
    await upsertInventory({ sku, name, quantity: v.inventory_quantity ?? 0, unit_cost: parseFloat(v.price) || 0, source: 'Shopify Sync' });
    count++;
  }
  return { action: 'synced_variants', count };
}

// ── Webhook handler (Shopify sends the full resource in the body) ──────────────
async function handleWebhook(scope, data, _credentials) {
  if (!data || !data.id) return { action: 'ignored', scope };
  if (scope === 'orders/create' || scope === 'orders/updated') return upsertReceivable(mapOrder(data));
  if (scope === 'products/create' || scope === 'products/update') return upsertProduct(data);
  return { action: 'ignored', scope };
}

// ── Test / sync / register ─────────────────────────────────────────────────────
async function testConnection(creds) {
  if (!creds.shop_domain || !creds.access_token) throw new Error('Shop Domain and Access Token are required');
  const { shop } = await shopGet(creds, '/shop.json');
  return { ok: true, store_name: shop?.name, store_url: shop?.domain, plan: shop?.plan_display_name || shop?.plan_name };
}

async function syncOrders(creds) {
  const { orders } = await shopGet(creds, '/orders.json?status=any&limit=50');
  if (!Array.isArray(orders)) return { synced: 0, total: 0, errors: ['No orders returned — check credentials'] };
  let synced = 0; const errors = [];
  for (const o of orders) {
    try { await upsertReceivable(mapOrder(o)); synced++; }
    catch (err) { errors.push(`Order ${o.name || o.id}: ${err.message}`); }
  }
  await touchLastSync('shopify');
  return { synced, total: orders.length, errors };
}

async function syncInventory(creds) {
  const { products } = await shopGet(creds, '/products.json?limit=50');
  if (!Array.isArray(products)) return { synced: 0, total: 0, errors: ['No products returned — check credentials'] };
  let synced = 0; const errors = [];
  for (const p of products) {
    try { await upsertProduct(p); synced++; }
    catch (err) { errors.push(`Product ${p.title || p.id}: ${err.message}`); }
  }
  await touchLastSync('shopify');
  return { synced, total: products.length, errors };
}

async function registerWebhooks(creds, webhookBaseUrl) {
  if (!creds.shop_domain || !creds.access_token) throw new Error('Shop Domain and Access Token are required');
  const address = `${webhookBaseUrl.replace(/\/$/, '')}/api/webhooks/shopify`;
  const TOPICS = ['orders/create', 'orders/updated', 'products/create', 'products/update'];

  let existing = new Set();
  try {
    const { webhooks } = await shopGet(creds, '/webhooks.json?limit=250');
    (webhooks || []).filter(w => w.address === address).forEach(w => existing.add(w.topic));
  } catch { /* ignore */ }

  const results = [];
  for (const topic of TOPICS) {
    if (existing.has(topic)) { results.push({ scope: topic, status: 'already_registered' }); continue; }
    try {
      await shopPost(creds, '/webhooks.json', { webhook: { topic, address, format: 'json' } });
      results.push({ scope: topic, status: 'registered' });
    } catch (err) {
      results.push({ scope: topic, status: 'error', message: err.message });
    }
  }
  return { destination: address, results };
}

module.exports = {
  MANIFEST, verifyWebhook, parseWebhook, handleWebhook,
  testConnection, syncOrders, syncInventory, registerWebhooks,
};
