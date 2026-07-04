// Shared upsert helpers for e-commerce connectors.
// Orders -> receivables (AR), products -> inventory. Matches the columns the
// BigCommerce connector uses so all connectors behave identically.

const { query } = require('../../db/database');

// Create or update a receivable from a store order.
// Never downgrades a paid invoice back to pending; matches by invoice_number.
async function upsertReceivable(r) {
  const {
    invoice_number, customer_name, description,
    amount, currency = 'PHP', exchange_rate = 1.0,
    status = 'pending', source = 'Integration',
  } = r;

  const { rows: [existing] } = await query(
    'SELECT id, status FROM receivables WHERE invoice_number = $1', [invoice_number]
  );

  if (existing) {
    if (status === 'paid' && existing.status !== 'paid') {
      await query(`UPDATE receivables SET status='paid', paid_amount=amount WHERE id=$1`, [existing.id]);
    }
    return { action: 'updated', id: existing.id };
  }

  const { rows: [rec] } = await query(
    `INSERT INTO receivables
       (customer_name, invoice_number, description, amount, currency, exchange_rate,
        status, pending_approval, created_by_email, created_by_name, created_by_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,0,'system',$8,'integration')
     RETURNING id`,
    [customer_name, invoice_number, description, amount, currency, exchange_rate, status, source]
  );
  return { action: 'created', id: rec.id };
}

// Create or update an inventory item from a store product/variant. Matches by SKU.
async function upsertInventory(p) {
  const { sku, name, quantity = 0, unit_cost = 0, source = 'Integration' } = p;

  const { rows: [existing] } = await query(
    'SELECT id FROM inventory_items WHERE sku = $1', [sku]
  );

  if (existing) {
    await query(`UPDATE inventory_items SET name=$1, quantity=$2, unit_cost=$3 WHERE id=$4`,
      [name, quantity, unit_cost, existing.id]);
    return { action: 'updated', id: existing.id };
  }

  const { rows: [item] } = await query(
    `INSERT INTO inventory_items
       (sku, name, quantity, unit_cost, reorder_point, is_active, pending_approval,
        created_by_email, created_by_name, created_by_role)
     VALUES ($1,$2,$3,$4,10,1,0,'system',$5,'integration')
     RETURNING id`,
    [sku, name, quantity, unit_cost, source]
  );
  return { action: 'created', id: item.id };
}

async function touchLastSync(provider) {
  try { await query(`UPDATE integrations SET last_sync_at=NOW() WHERE provider=$1`, [provider]); }
  catch (_) { /* non-fatal */ }
}

module.exports = { upsertReceivable, upsertInventory, touchLastSync };
