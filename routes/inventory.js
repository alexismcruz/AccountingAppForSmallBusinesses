const express = require('express');
const router = express.Router();
const { getDB, runTransaction } = require('../db/database');
const { logAction } = require('../utils/auditLog');

// ── CSV helpers ──────────────────────────────────────────────────────────────

function csvEsc(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function parseCSVText(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVRow(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}

function parseCSVRow(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && !inQ) { inQ = true; continue; }
    if (c === '"' && inQ) { if (line[i+1] === '"') { cur += '"'; i++; continue; } inQ = false; continue; }
    if (c === ',' && !inQ) { result.push(cur); cur = ''; continue; }
    cur += c;
  }
  result.push(cur);
  return result;
}

// ── CSV Export / Import / Template ───────────────────────────────────────────

router.get('/export/csv', (req, res) => {
  const db   = getDB();
  const rows = db.prepare('SELECT * FROM inventory_items WHERE is_active = 1 ORDER BY name').all();
  const cols = ['sku', 'name', 'category', 'unit', 'quantity', 'unit_cost', 'reorder_point', 'notes'];
  const csv  = [cols.join(','), ...rows.map(r => cols.map(c => csvEsc(r[c])).join(','))].join('\n');
  const today = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="inventory-${today}.csv"`);
  res.send(csv);
});

router.get('/import/template', (req, res) => {
  const sample = [
    'sku,name,category,unit,quantity,unit_cost,reorder_point,notes',
    'ITEM-001,Widget A,Electronics,pcs,100,25.00,20,Main product line',
    'ITEM-002,Widget B,Electronics,pcs,50,15.00,10,',
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="inventory-template.csv"');
  res.send(sample);
});

router.post('/import/csv', (req, res) => {
  const db = getDB();
  const { csv, dryRun } = req.body;
  if (!csv) return res.status(400).json({ error: 'No CSV data provided' });
  const rows = parseCSVText(csv);
  if (!rows.length) return res.status(400).json({ error: 'CSV has no data rows' });

  const errors = [];
  rows.forEach((r, i) => {
    if (!r.sku)  errors.push(`Row ${i+2}: missing sku`);
    if (!r.name) errors.push(`Row ${i+2}: missing name`);
    if (r.quantity  && isNaN(parseFloat(r.quantity)))   errors.push(`Row ${i+2}: invalid quantity`);
    if (r.unit_cost && isNaN(parseFloat(r.unit_cost)))  errors.push(`Row ${i+2}: invalid unit_cost`);
  });
  if (errors.length) return res.status(400).json({ error: 'Validation errors', details: errors });
  if (dryRun) return res.json({ ok: true, count: rows.length });

  const stmt = db.prepare(`
    INSERT INTO inventory_items (sku, name, category, unit, quantity, unit_cost, reorder_point, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const imported = [], skipped = [];
  for (const r of rows) {
    try {
      stmt.run(r.sku, r.name, r.category || '', r.unit || 'pcs',
        parseFloat(r.quantity) || 0, parseFloat(r.unit_cost) || 0,
        parseFloat(r.reorder_point) || 10, r.notes || null);
      imported.push(r.sku);
    } catch (e) {
      skipped.push(`${r.sku} — ${e.message.includes('UNIQUE') ? 'SKU already exists' : e.message}`);
    }
  }
  logAction(req.session.user, 'IMPORT_INVENTORY_CSV', 'inventory', null, null,
    { imported: imported.length, skipped: skipped.length });
  res.json({ ok: true, imported: imported.length, skipped: skipped.length, skippedRefs: skipped });
});

// ── CRUD ─────────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const db = getDB();
  res.json(db.prepare(
    'SELECT * FROM inventory_items WHERE is_active = 1 ORDER BY name'
  ).all());
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

router.post('/', (req, res) => {
  const db   = getDB();
  const user = req.session.user;
  const { sku, name, category, unit, quantity, unit_cost, reorder_point, notes, submitter_note } = req.body;
  if (!sku || !name) return res.status(400).json({ error: 'SKU and name are required' });

  const isSuperAdmin    = user?.role === 'super_admin';
  const pendingApproval = isSuperAdmin ? 0 : 1;

  try {
    const result = db.prepare(`
      INSERT INTO inventory_items
        (sku, name, category, unit, quantity, unit_cost, reorder_point, notes,
         pending_approval, created_by_email, created_by_name, created_by_role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sku, name, category || '', unit || 'pcs',
       parseFloat(quantity) || 0, parseFloat(unit_cost) || 0,
       parseFloat(reorder_point) || 10, notes || null,
       pendingApproval, user?.email || 'system', user?.name || 'System', user?.role || 'staff');

    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(result.lastInsertRowid);

    if (!isSuperAdmin) {
      db.prepare(`
        INSERT INTO approval_requests
          (type, entity_id, entity_ref, entity_snapshot, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
        VALUES ('create_inventory', ?, ?, ?, ?, ?, ?, ?)
      `).run(item.id, sku, JSON.stringify(item),
             user?.email, user?.name || user?.email, user?.role, submitter_note || null);
    }
    logAction(user, isSuperAdmin ? 'CREATE_INVENTORY_ITEM' : 'SUBMIT_INVENTORY_FOR_APPROVAL',
      'inventory_item', item.id, sku);
    res.json(item);
  } catch (e) {
    res.status(400).json({ error: 'SKU already exists' });
  }
});

// Recall a pending-approval inventory item (owner or super_admin only)
router.post('/:id/recall', (req, res) => {
  const db   = getDB();
  const user = req.session.user;
  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (!item.pending_approval) return res.status(400).json({ error: 'This item is not pending approval' });
  if (item.created_by_email !== user.email && user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only the creator or Super Admin can recall this submission' });
  }
  runTransaction((db) => {
    db.prepare('DELETE FROM inventory_items WHERE id = ?').run(item.id);
    db.prepare(`UPDATE approval_requests SET status = 'rejected', reviewer_note = 'Recalled by submitter',
      reviewed_at = datetime('now') WHERE entity_id = ? AND type = 'create_inventory' AND status = 'pending'`)
      .run(item.id);
  });
  logAction(user, 'RECALL_INVENTORY_ITEM', 'inventory_item', item.id, item.sku);
  res.json({ ok: true });
});

router.put('/:id', (req, res) => {
  const db   = getDB();
  const user = req.session.user;
  const { sku, name, category, unit, unit_cost, reorder_point, notes } = req.body;
  db.prepare(`
    UPDATE inventory_items SET sku=?, name=?, category=?, unit=?, unit_cost=?, reorder_point=?, notes=?
    WHERE id=?
  `).run(sku, name, category, unit, parseFloat(unit_cost) || 0,
     parseFloat(reorder_point) || 10, notes, req.params.id);
  logAction(user, 'UPDATE_INVENTORY_ITEM', 'inventory_item', req.params.id, sku);
  res.json(db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id));
});

// Replenish stock — updates quantity and creates a journal entry
router.post('/:id/replenish', (req, res) => {
  const db = getDB();
  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const { qty, unit_cost, payment_method, notes, date, reference, currency, exchange_rate } = req.body;
  const quantity = parseFloat(qty) || 0;
  const cost = parseFloat(unit_cost) || item.unit_cost;
  const totalCost = quantity * cost;
  const rate = parseFloat(exchange_rate) || 1.0;
  const cur  = currency || 'USD';

  if (quantity <= 0) return res.status(400).json({ error: 'Quantity must be greater than 0' });

  try {
    runTransaction((db) => {
      const newQty = item.quantity + quantity;
      const newCost = newQty > 0
        ? ((item.quantity * item.unit_cost) + (quantity * cost / rate)) / newQty
        : cost / rate;
      db.prepare(
        'UPDATE inventory_items SET quantity = ?, unit_cost = ? WHERE id = ?'
      ).run(newQty, newCost, item.id);

      const inventoryAccount = db.prepare("SELECT id FROM accounts WHERE code = '1200'").get();
      const creditAccount = payment_method === 'credit'
        ? db.prepare("SELECT id FROM accounts WHERE code = '2000'").get()
        : db.prepare("SELECT id FROM accounts WHERE code = '1010'").get();

      const entryResult = db.prepare(
        'INSERT INTO journal_entries (date, reference, description, status, currency, exchange_rate, entry_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        date || new Date().toISOString().split('T')[0],
        reference,
        `Stock replenishment: ${item.name} (${quantity} ${item.unit})`,
        'posted', cur, rate, 'regular'
      );
      const entryId = entryResult.lastInsertRowid;

      const lineStmt = db.prepare(
        'INSERT INTO journal_lines (entry_id, account_id, debit, credit, notes, base_debit, base_credit) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      lineStmt.run(entryId, inventoryAccount.id, totalCost, 0, notes || `${quantity} ${item.unit} @ ${cost}`, totalCost / rate, 0);
      lineStmt.run(entryId, creditAccount.id, 0, totalCost, notes || null, 0, totalCost / rate);
    });
    logAction(req.session.user, 'REPLENISH_INVENTORY', 'inventory_item', item.id, item.sku,
      { qty: quantity, cost });
    res.json(db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(item.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  const db   = getDB();
  const user = req.session.user;
  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.pending_deletion) return res.status(400).json({ error: 'A deletion request is already pending' });

  const { deletion_note } = req.body;

  // Super admin can delete directly
  if (user?.role === 'super_admin') {
    db.prepare('UPDATE inventory_items SET is_active = 0 WHERE id = ?').run(item.id);
    logAction(user, 'DELETE_INVENTORY_ITEM', 'inventory_item', item.id, item.sku);
    return res.json({ success: true, action: 'deleted' });
  }

  db.prepare('UPDATE inventory_items SET pending_deletion = 1 WHERE id = ?').run(item.id);
  db.prepare(`
    INSERT INTO approval_requests
      (type, entity_id, entity_ref, entity_snapshot, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
    VALUES ('delete_inventory', ?, ?, ?, ?, ?, ?, ?)
  `).run(item.id, item.sku, JSON.stringify(item), user.email, user.name || user.email, user.role, deletion_note || null);

  logAction(user, 'REQUEST_INVENTORY_DELETION', 'inventory_item', item.id, item.sku);
  res.json({ success: true, action: 'deletion_requested' });
});

module.exports = router;
