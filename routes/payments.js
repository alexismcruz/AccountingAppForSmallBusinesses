const express = require('express');
const router = express.Router();
const { getDB, runTransaction } = require('../db/database');

// ── RECEIVABLES (Incoming / Accounts Receivable) ─────────────────────────

router.get('/receivables', (req, res) => {
  const db = getDB();
  res.json(db.prepare(
    'SELECT * FROM receivables ORDER BY due_date ASC, created_at DESC'
  ).all());
});

router.post('/receivables', (req, res) => {
  const db = getDB();
  const { customer_name, invoice_number, description, amount, due_date, scheduled_date, currency, exchange_rate } = req.body;
  if (!customer_name || !invoice_number || !amount) {
    return res.status(400).json({ error: 'customer_name, invoice_number, and amount are required' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO receivables (customer_name, invoice_number, description, amount, due_date, scheduled_date, currency, exchange_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customer_name, invoice_number, description || '', parseFloat(amount), due_date || null,
           scheduled_date || null, currency || 'USD', parseFloat(exchange_rate) || 1.0);
    res.json(db.prepare('SELECT * FROM receivables WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: 'Invoice number already exists' });
  }
});

// Record payment received from customer
router.post('/receivables/:id/pay', (req, res) => {
  const db = getDB();
  const rec = db.prepare('SELECT * FROM receivables WHERE id = ?').get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Record not found' });

  const { amount, date, reference, notes, currency, exchange_rate } = req.body;
  const payAmount = parseFloat(amount) || rec.amount - rec.paid_amount;
  const newPaid = rec.paid_amount + payAmount;
  const newStatus = newPaid >= rec.amount ? 'paid' : 'partial';
  const rate = parseFloat(exchange_rate) || rec.exchange_rate || 1.0;
  const cur  = currency || rec.currency || 'USD';

  try {
    runTransaction((db) => {
      const cashAccount = db.prepare("SELECT id FROM accounts WHERE code = '1010'").get();
      const arAccount = db.prepare("SELECT id FROM accounts WHERE code = '1100'").get();

      const entryResult = db.prepare(
        'INSERT INTO journal_entries (date, reference, description, status, currency, exchange_rate, entry_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        date || new Date().toISOString().split('T')[0],
        reference,
        `Payment received from ${rec.customer_name} — Invoice ${rec.invoice_number}`,
        'posted', cur, rate, 'regular'
      );
      const entryId = entryResult.lastInsertRowid;
      const lineStmt = db.prepare(
        'INSERT INTO journal_lines (entry_id, account_id, debit, credit, notes, base_debit, base_credit) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      lineStmt.run(entryId, cashAccount.id, payAmount, 0, notes || null, payAmount / rate, 0);
      lineStmt.run(entryId, arAccount.id, 0, payAmount, notes || null, 0, payAmount / rate);

      db.prepare(
        'UPDATE receivables SET paid_amount = ?, status = ?, entry_id = ? WHERE id = ?'
      ).run(newPaid, newStatus, entryId, rec.id);
    });
    res.json(db.prepare('SELECT * FROM receivables WHERE id = ?').get(rec.id));
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      res.status(400).json({ error: `Reference "${reference}" already exists` });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

// Update scheduled date for a receivable
router.patch('/receivables/:id/schedule', (req, res) => {
  const db = getDB();
  const { scheduled_date } = req.body;
  db.prepare('UPDATE receivables SET scheduled_date = ? WHERE id = ?').run(scheduled_date || null, req.params.id);
  res.json(db.prepare('SELECT * FROM receivables WHERE id = ?').get(req.params.id));
});

router.delete('/receivables/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM receivables WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── PAYABLES (Pending / Accounts Payable) ────────────────────────────────

router.get('/payables', (req, res) => {
  const db = getDB();
  res.json(db.prepare(
    'SELECT * FROM payables ORDER BY due_date ASC, created_at DESC'
  ).all());
});

router.post('/payables', (req, res) => {
  const db = getDB();
  const { supplier_name, reference_number, description, amount, due_date, scheduled_date, currency, exchange_rate } = req.body;
  if (!supplier_name || !amount) {
    return res.status(400).json({ error: 'supplier_name and amount are required' });
  }
  const result = db.prepare(`
    INSERT INTO payables (supplier_name, reference_number, description, amount, due_date, scheduled_date, currency, exchange_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(supplier_name, reference_number || '', description || '', parseFloat(amount), due_date || null,
         scheduled_date || null, currency || 'USD', parseFloat(exchange_rate) || 1.0);
  res.json(db.prepare('SELECT * FROM payables WHERE id = ?').get(result.lastInsertRowid));
});

// Record payment made to supplier
router.post('/payables/:id/pay', (req, res) => {
  const db = getDB();
  const payable = db.prepare('SELECT * FROM payables WHERE id = ?').get(req.params.id);
  if (!payable) return res.status(404).json({ error: 'Record not found' });

  const { amount, date, reference, notes, currency, exchange_rate } = req.body;
  const payAmount = parseFloat(amount) || payable.amount - payable.paid_amount;
  const newPaid = payable.paid_amount + payAmount;
  const newStatus = newPaid >= payable.amount ? 'paid' : 'partial';
  const rate = parseFloat(exchange_rate) || payable.exchange_rate || 1.0;
  const cur  = currency || payable.currency || 'USD';

  try {
    runTransaction((db) => {
      const cashAccount = db.prepare("SELECT id FROM accounts WHERE code = '1010'").get();
      const apAccount = db.prepare("SELECT id FROM accounts WHERE code = '2000'").get();

      const entryResult = db.prepare(
        'INSERT INTO journal_entries (date, reference, description, status, currency, exchange_rate, entry_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        date || new Date().toISOString().split('T')[0],
        reference,
        `Payment to ${payable.supplier_name}${payable.reference_number ? ' — Ref: ' + payable.reference_number : ''}`,
        'posted', cur, rate, 'regular'
      );
      const entryId = entryResult.lastInsertRowid;
      const lineStmt = db.prepare(
        'INSERT INTO journal_lines (entry_id, account_id, debit, credit, notes, base_debit, base_credit) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      lineStmt.run(entryId, apAccount.id, payAmount, 0, notes || null, payAmount / rate, 0);
      lineStmt.run(entryId, cashAccount.id, 0, payAmount, notes || null, 0, payAmount / rate);

      db.prepare(
        'UPDATE payables SET paid_amount = ?, status = ?, entry_id = ? WHERE id = ?'
      ).run(newPaid, newStatus, entryId, payable.id);
    });
    res.json(db.prepare('SELECT * FROM payables WHERE id = ?').get(payable.id));
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      res.status(400).json({ error: `Reference "${reference}" already exists` });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

// Update scheduled date for a payable
router.patch('/payables/:id/schedule', (req, res) => {
  const db = getDB();
  const { scheduled_date } = req.body;
  db.prepare('UPDATE payables SET scheduled_date = ? WHERE id = ?').run(scheduled_date || null, req.params.id);
  res.json(db.prepare('SELECT * FROM payables WHERE id = ?').get(req.params.id));
});

router.delete('/payables/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM payables WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── UNIFIED PAYMENT SCHEDULE ─────────────────────────────────────────────

router.get('/schedule', (req, res) => {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];

  const receivables = db.prepare(`
    SELECT id, customer_name AS party_name, invoice_number AS ref_number,
           description, amount, paid_amount, due_date, scheduled_date,
           status, currency, exchange_rate, created_at, 'incoming' AS direction
    FROM receivables WHERE status != 'paid'
  `).all();

  const payables = db.prepare(`
    SELECT id, supplier_name AS party_name, reference_number AS ref_number,
           description, amount, paid_amount, due_date, scheduled_date,
           status, currency, exchange_rate, created_at, 'outgoing' AS direction
    FROM payables WHERE status != 'paid'
  `).all();

  const all = [...receivables, ...payables]
    .map(r => ({ ...r, effective_date: r.scheduled_date || r.due_date, balance: r.amount - r.paid_amount }))
    .sort((a, b) => {
      if (!a.effective_date && !b.effective_date) return 0;
      if (!a.effective_date) return 1;
      if (!b.effective_date) return -1;
      return a.effective_date.localeCompare(b.effective_date);
    });

  res.json({ schedule: all, today });
});

module.exports = router;
