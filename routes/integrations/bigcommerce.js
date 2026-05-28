const crypto = require('crypto');
const { query } = require('../../db/database');

// ── Connector manifest (read by registry UI) ──────────────────────────────────
const MANIFEST = {
  name:        'BigCommerce',
  slug:        'bigcommerce',
  description: 'Sync orders and inventory from your BigCommerce store into CuentaIQ automatically.',
  icon:        '🛍️',
  credentialFields: [
    { key: 'store_hash',     label: 'Store Hash',     type: 'text',     placeholder: 'abc123xyz — found in your BC store URL' },
    { key: 'client_id',     label: 'Client ID',       type: 'text',     placeholder: 'From your BC API Account' },
    { key: 'access_token',  label: 'Access Token',    type: 'password', placeholder: 'From your BC API Account' },
    { key: 'webhook_secret', label: 'Webhook Token',  type: 'password', placeholder: 'Any strong random string — used to authenticate incoming webhooks' },
  ],
};

// ── BC API helpers ────────────────────────────────────────────────────────────
function bcHeaders(accessToken) {
  return {
    'X-Auth-Token': accessToken,
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  };
}

async function bcGet(storeHash, accessToken, path) {
  const url = `https://api.bigcommerce.com/stores/${storeHash}${path}`;
  const res  = await fetch(url, { headers: bcHeaders(accessToken), signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`BC API ${res.status} on GET ${path}: ${err.title || err.message || JSON.stringify(err)}`);
  }
  return res.json();
}

async function bcPost(storeHash, accessToken, path, body) {
  const url  = `https://api.bigcommerce.com/stores/${storeHash}${path}`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: bcHeaders(accessToken),
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`BC API ${res.status} on POST ${path}: ${data.title || data.message || JSON.stringify(data)}`);
  return data;
}

// ── Webhook token verification ────────────────────────────────────────────────
// BigCommerce sends the custom header we set at webhook registration time.
// We verify it with timing-safe comparison to prevent timing attacks.
function verifyWebhookToken(headerValue, secret) {
  if (!secret || !headerValue) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(String(headerValue), 'utf8'),
      Buffer.from(String(secret),      'utf8')
    );
  } catch { return false; }
}

// ── Field mapping: BC order → receivable ─────────────────────────────────────
function mapOrderToReceivable(order) {
  const bill = order.billing_address || {};
  const name = [bill.first_name, bill.last_name].filter(Boolean).join(' ').trim()
            || bill.email
            || `BC Customer #${order.customer_id || order.id}`;

  const paidStatuses = ['completed', 'partially_refunded'];
  const paidPayments = ['captured', 'paid'];
  const isPaid = paidStatuses.includes((order.status        || '').toLowerCase())
              || paidPayments.includes((order.payment_status || '').toLowerCase());

  return {
    customer_name:  name,
    invoice_number: `BC-${order.id}`,
    description:    `BigCommerce Order #${order.id}`,
    amount:         parseFloat(order.total_inc_tax) || 0,
    currency:       order.currency_code   || 'PHP',
    exchange_rate:  parseFloat(order.currency_exchange_rate) || 1.0,
    status:         isPaid ? 'paid' : 'pending',
  };
}

// ── Upsert receivable from BC order ──────────────────────────────────────────
async function upsertReceivableFromOrder(order) {
  const invoiceNum = `BC-${order.id}`;
  const { rows: [existing] } = await query(
    'SELECT id, status FROM receivables WHERE invoice_number = $1', [invoiceNum]
  );

  if (existing) {
    // Only promote to paid — never downgrade
    const newStatus = mapOrderToReceivable(order).status;
    if (newStatus === 'paid' && existing.status !== 'paid') {
      await query(
        `UPDATE receivables SET status='paid', paid_amount=amount WHERE id=$1`,
        [existing.id]
      );
    }
    return { action: 'updated', id: existing.id };
  }

  const r = mapOrderToReceivable(order);
  const { rows: [rec] } = await query(
    `INSERT INTO receivables
       (customer_name, invoice_number, description, amount, currency, exchange_rate,
        status, pending_approval, created_by_email, created_by_name, created_by_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,0,'system','BigCommerce Sync','integration')
     RETURNING id`,
    [r.customer_name, r.invoice_number, r.description, r.amount,
     r.currency, r.exchange_rate, r.status]
  );
  return { action: 'created', id: rec.id };
}

// ── Upsert inventory item from BC product ─────────────────────────────────────
async function upsertInventoryFromProduct(product) {
  const sku = (product.sku || '').trim() || `BC-${product.id}`;
  const { rows: [existing] } = await query(
    'SELECT id FROM inventory_items WHERE sku = $1', [sku]
  );

  const qty      = product.inventory_level ?? 0;
  const unitCost = parseFloat(product.cost_price) || parseFloat(product.price) || 0;

  if (existing) {
    await query(
      `UPDATE inventory_items SET name=$1, quantity=$2, unit_cost=$3 WHERE id=$4`,
      [product.name, qty, unitCost, existing.id]
    );
    return { action: 'updated', id: existing.id };
  }

  const { rows: [item] } = await query(
    `INSERT INTO inventory_items
       (sku, name, quantity, unit_cost, reorder_point, is_active, pending_approval,
        created_by_email, created_by_name, created_by_role)
     VALUES ($1,$2,$3,$4,10,1,0,'system','BigCommerce Sync','integration')
     RETURNING id`,
    [sku, product.name, qty, unitCost]
  );
  return { action: 'created', id: item.id };
}

// ── Webhook handler (called by routes/webhooks.js) ────────────────────────────
async function handleWebhook(scope, data, credentials) {
  const { store_hash, access_token } = credentials;

  // ── Orders ──────────────────────────────────────────────────────────────────
  if (scope === 'store/order/created' || scope === 'store/order/statusUpdated') {
    const order = await bcGet(store_hash, access_token, `/v2/orders/${data.id}`);
    return upsertReceivableFromOrder(order);
  }

  // ── Products ─────────────────────────────────────────────────────────────────
  if (scope === 'store/product/created' || scope === 'store/product/updated') {
    const { data: product } = await bcGet(store_hash, access_token, `/v3/catalog/products/${data.id}`);
    return upsertInventoryFromProduct(product);
  }

  // ── Inventory level change ───────────────────────────────────────────────────
  if (scope === 'store/product/inventory/updated') {
    const productId = data.id;
    const qty       = data.inventory?.value ?? null;
    if (qty !== null) {
      await query(
        `UPDATE inventory_items SET quantity=$1 WHERE sku=$2`,
        [qty, `BC-${productId}`]
      );
      // Also try matching by sku from BC API (product may have a real SKU)
      try {
        const { data: product } = await bcGet(store_hash, access_token, `/v3/catalog/products/${productId}`);
        if (product.sku) {
          await query(
            `UPDATE inventory_items SET quantity=$1 WHERE sku=$2 AND sku != $3`,
            [qty, product.sku, `BC-${productId}`]
          );
        }
      } catch { /* best-effort */ }
    }
    return { action: 'inventory_updated', productId, qty };
  }

  // Unknown scope — silently acknowledge
  return { action: 'ignored', scope };
}

// ── Test connection ────────────────────────────────────────────────────────────
async function testConnection(credentials) {
  const { store_hash, access_token } = credentials;
  if (!store_hash || !access_token)
    throw new Error('store_hash and access_token are required');
  const data = await bcGet(store_hash, access_token, '/v2/store');
  return { ok: true, store_name: data.name, store_url: data.secure_url, plan: data.plan_name };
}

// ── Manual sync: most recent 50 orders → AR ───────────────────────────────────
async function syncOrders(credentials) {
  const { store_hash, access_token } = credentials;
  const orders = await bcGet(store_hash, access_token,
    '/v2/orders?sort=date_created:desc&limit=50&is_deleted=false'
  );
  if (!Array.isArray(orders))
    return { synced: 0, errors: ['No orders returned — check store_hash and access_token'] };

  let synced = 0;
  const errors = [];
  for (const order of orders) {
    try { await upsertReceivableFromOrder(order); synced++; }
    catch (err) { errors.push(`Order #${order.id}: ${err.message}`); }
  }

  await query(
    `UPDATE integrations SET last_sync_at=NOW() WHERE provider='bigcommerce'`
  );
  return { synced, total: orders.length, errors };
}

// ── Manual sync: first 50 products → Inventory ────────────────────────────────
async function syncInventory(credentials) {
  const { store_hash, access_token } = credentials;
  const { data: products } = await bcGet(store_hash, access_token,
    '/v3/catalog/products?limit=50&is_visible=true'
  );
  if (!Array.isArray(products))
    return { synced: 0, errors: ['No products returned — check store_hash and access_token'] };

  let synced = 0;
  const errors = [];
  for (const product of products) {
    try { await upsertInventoryFromProduct(product); synced++; }
    catch (err) { errors.push(`Product #${product.id} (${product.name}): ${err.message}`); }
  }

  await query(
    `UPDATE integrations SET last_sync_at=NOW() WHERE provider='bigcommerce'`
  );
  return { synced, total: products.length, errors };
}

// ── Register webhooks in BigCommerce ──────────────────────────────────────────
async function registerWebhooks(credentials, webhookBaseUrl) {
  const { store_hash, access_token, webhook_secret } = credentials;
  if (!store_hash || !access_token)
    throw new Error('store_hash and access_token are required');

  const destination = `${webhookBaseUrl.replace(/\/$/, '')}/api/webhooks/bigcommerce`;

  const SCOPES = [
    'store/order/created',
    'store/order/statusUpdated',
    'store/product/created',
    'store/product/updated',
    'store/product/inventory/updated',
  ];

  // Fetch existing hooks to avoid duplicates
  let existingScopes = new Set();
  try {
    const existing = await bcGet(store_hash, access_token, '/v3/hooks?limit=250');
    (existing.data || [])
      .filter(h => h.destination === destination && h.is_active)
      .forEach(h => existingScopes.add(h.scope));
  } catch { /* ignore — will try to register all */ }

  const results = [];
  for (const scope of SCOPES) {
    if (existingScopes.has(scope)) {
      results.push({ scope, status: 'already_registered' });
      continue;
    }
    try {
      await bcPost(store_hash, access_token, '/v3/hooks', {
        scope,
        destination,
        is_active: true,
        headers: webhook_secret ? { 'X-BC-Webhook-Token': webhook_secret } : {},
      });
      results.push({ scope, status: 'registered' });
    } catch (err) {
      results.push({ scope, status: 'error', message: err.message });
    }
  }
  return { destination, results };
}

module.exports = {
  MANIFEST,
  verifyWebhookToken,
  handleWebhook,
  testConnection,
  syncOrders,
  syncInventory,
  registerWebhooks,
};
