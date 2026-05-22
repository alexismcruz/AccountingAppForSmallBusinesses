const express = require('express');
const router = express.Router();
const { getDB, runTransaction } = require('../db/database');

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
  const db = getDB();
  const { sku, name, category, unit, quantity, unit_cost, reorder_point, notes } = req.body;
  if (!sku || !name) return res.status(400).json({ error: 'SKU and name are required' });
  try {
    const result = db.prepare(`
      INSERT INTO inventory_items (sku, name, category, unit, quantity, unit_cost, reorder_point, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sku, name, category || '', unit || 'pcs',
       parseFloat(quantity) || 0, parseFloat(unit_cost) || 0,
       parseFloat(reorder_point) || 10, notes || null);
    res.json(db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: 'SKU already exists' });
  }
});

router.put('/:id', (req, res) => {
  const db = getDB();
  const { sku, name, category, unit, unit_cost, reorder_point, notes } = req.body;
  db.prepare(`
    UPDATE inventory_items SET sku=?, name=?, category=?, unit=?, unit_cost=?, reorder_point=?, notes=?
    WHERE id=?
  `).run(sku, name, category, unit, parseFloat(unit_cost) || 0,
     parseFloat(reorder_point) || 10, notes, req.params.id);
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
    res.json(db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(item.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('UPDATE inventory_items SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
