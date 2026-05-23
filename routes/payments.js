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

// ── RECEIVABLES — Export / Import / Template ─────────────────────────────────

router.get('/receivables/export/csv', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM receivables ORDER BY due_date, created_at').all();
  const cols = ['customer_name','invoice_number','description','amount','currency','exchange_rate','due_date','scheduled_date','status','paid_amount'];
  const csv  = [cols.join(','), ...rows.map(r => cols.map(c => csvEsc(r[c])).join(','))].join('\n');
  const today = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="receivables-${today}.csv"`);
  res.send(csv);
});

router.get('/receivables/import/template', (req, res) => {
  const sample = [
    'customer_name,invoice_number,description,amount,currency,exchange_rate,due_date,scheduled_date',
    'John Santos,INV-001,Website design services,5000,USD,1,2026-02-28,2026-02-15',
    'ABC Company,INV-002,Monthly retainer,2000,SGD,1,2026-03-01,',
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="receivables-template.csv"');
  res.send(sample);
});

router.post('/receivables/import/csv', (req, res) => {
  const db = getDB();
  const { csv, dryRun } = req.body;
  if (!csv) return res.status(400).json({ error: 'No CSV data provided' });
  const rows = parseCSVText(csv);
  if (!rows.length) return res.status(400).json({ error: 'CSV has no data rows' });

  const errors = [];
  rows.forEach((r, i) => {
    if (!r.customer_name) errors.push(`Row ${i+2}: missing customer_name`);
    if (!r.amount || isNaN(parseFloat(r.amount))) errors.push(`Row ${i+2}: invalid amount`);
  });
  if (errors.length) return res.status(400).json({ error: 'Validation errors', details: errors });
  if (dryRun) return res.json({ ok: true, count: rows.length });

  const stmt = db.prepare(`
    INSERT INTO receivables (customer_name, invoice_number, description, amount, currency, exchange_rate, due_date, scheduled_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const imported = [], skipped = [];
  for (const r of rows) {
    try {
      stmt.run(r.customer_name, r.invoice_number || `INV-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        r.description || '', parseFloat(r.amount), r.currency || 'USD',
        parseFloat(r.exchange_rate) || 1.0, r.due_date || null, r.scheduled_date || null);
      imported.push(r.invoice_number || r.customer_name);
    } catch (e) {
      skipped.push(`${r.invoice_number || r.customer_name} — ${e.message.includes('UNIQUE') ? 'invoice number already exists' : e.message}`);
    }
  }
  res.json({ ok: true, imported: imported.length, skipped: skipped.length, skippedRefs: skipped });
});

// ── PAYABLES — Export / Import / Template ────────────────────────────────────

router.get('/payables/export/csv', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM payables ORDER BY due_date, created_at').all();
  const cols = ['supplier_name','reference_number','description','amount','currency','exchange_rate','due_date','scheduled_date','status','paid_amount'];
  const csv  = [cols.join(','), ...rows.map(r => cols.map(c => csvEsc(r[c])).join(','))].join('\n');
  const today = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="payables-${today}.csv"`);
  res.send(csv);
});

router.get('/payables/import/template', (req, res) => {
  const sample = [
    'supplier_name,reference_number,description,amount,currency,exchange_rate,due_date,scheduled_date',
    'Office Supplies Co,PO-001,Monthly office supplies,800,USD,1,2026-02-15,2026-02-10',
    'Cloud Host Ltd,PO-002,Server hosting Q1,1200,USD,1,2026-03-31,',
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="payables-template.csv"');
  res.send(sample);
});

router.post('/payables/import/csv', (req, res) => {
  const db = getDB();
  const { csv, dryRun } = req.body;
  if (!csv) return res.status(400).json({ error: 'No CSV data provided' });
  const rows = parseCSVText(csv);
  if (!rows.length) return res.status(400).json({ error: 'CSV has no data rows' });

  const errors = [];
  rows.forEach((r, i) => {
    if (!r.supplier_name) errors.push(`Row ${i+2}: missing supplier_name`);
    if (!r.amount || isNaN(parseFloat(r.amount))) errors.push(`Row ${i+2}: invalid amount`);
  });
  if (errors.length) return res.status(400).json({ error: 'Validation errors', details: errors });
  if (dryRun) return res.json({ ok: true, count: rows.length });

  const stmt = db.prepare(`
    INSERT INTO payables (supplier_name, reference_number, description, amount, currency, exchange_rate, due_date, scheduled_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const imported = [], skipped = [];
  for (const r of rows) {
    try {
      stmt.run(r.supplier_name, r.reference_number || '', r.description || '',
        parseFloat(r.amount), r.currency || 'USD', parseFloat(r.exchange_rate) || 1.0,
        r.due_date || null, r.scheduled_date || null);
      imported.push(r.supplier_name);
    } catch (e) {
      skipped.push(`${r.supplier_name} — ${e.message}`);
    }
  }
  res.json({ ok: true, imported: imported.length, skipped: skipped.length, skippedRefs: skipped });
});

// ── RECEIVABLES (Incoming / Accounts Receivable) ─────────────────────────

router.get('/receivables', (req, res) => {
  const db = getDB();
  res.json(db.prepare(
    'SELECT * FROM receivables ORDER BY due_date ASC, created_at DESC'
  ).all());
});

router.post('/receivables', (req, res) => {
  const db   = getDB();
  const user = req.session.user;
  const { customer_name, invoice_number, description, amount, due_date, scheduled_date,
          currency, exchange_rate, submitter_note } = req.body;
  if (!customer_name || !amount) {
    return res.status(400).json({ error: 'customer_name and amount are required' });
  }
  const isSuperAdmin   = user?.role === 'super_admin';
  const pendingApproval = isSuperAdmin ? 0 : 1;
  const invNum         = invoice_number || `INV-${Date.now()}`;
  try {
    const result = db.prepare(`
      INSERT INTO receivables
        (customer_name, invoice_number, description, amount, due_date, scheduled_date,
         currency, exchange_rate, pending_approval, created_by_email, created_by_name, created_by_role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customer_name, invNum, description || '', parseFloat(amount), due_date || null,
           scheduled_date || null, currency || 'USD', parseFloat(exchange_rate) || 1.0,
           pendingApproval, user?.email || 'system', user?.name || 'System', user?.role || 'staff');
    const rec = db.prepare('SELECT * FROM receivables WHERE id = ?').get(result.lastInsertRowid);

    if (!isSuperAdmin) {
      db.prepare(`
        INSERT INTO approval_requests
          (type, entity_id, entity_ref, entity_snapshot, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
        VALUES ('create_receivable', ?, ?, ?, ?, ?, ?, ?)
      `).run(rec.id, invNum, JSON.stringify(rec),
             user?.email, user?.name || user?.email, user?.role, submitter_note || null);
    }
    logAction(user, isSuperAdmin ? 'CREATE_RECEIVABLE' : 'SUBMIT_RECEIVABLE_FOR_APPROVAL',
      'receivable', rec.id, invNum);
    res.json(rec);
  } catch (e) {
    res.status(400).json({ error: 'Invoice number already exists' });
  }
});

// Recall a pending-approval receivable (owner or super_admin only)
router.post('/receivables/:id/recall', (req, res) => {
  const db   = getDB();
  const user = req.session.user;
  const rec  = db.prepare('SELECT * FROM receivables WHERE id = ?').get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Record not found' });
  if (!rec.pending_approval) return res.status(400).json({ error: 'This record is not pending approval' });
  if (rec.created_by_email !== user.email && user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only the creator or Super Admin can recall this submission' });
  }
  runTransaction((db) => {
    db.prepare('DELETE FROM receivables WHERE id = ?').run(rec.id);
    db.prepare(`UPDATE approval_requests SET status = 'rejected', reviewer_note = 'Recalled by submitter',
      reviewed_at = datetime('now') WHERE entity_id = ? AND type = 'create_receivable' AND status = 'pending'`)
      .run(rec.id);
  });
  logAction(user, 'RECALL_RECEIVABLE', 'receivable', rec.id, rec.invoice_number);
  res.json({ ok: true });
});

// Record payment received from customer
router.post('/receivables/:id/pay', (req, res) => {
  const db = getDB();
  const rec = db.prepare('SELECT * FROM receivables WHERE id = ?').get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Record not found' });
  if (rec.pending_approval) return res.status(400).json({ error: 'This invoice is still pending approval and cannot be paid yet' });

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
  const db   = getDB();
  const user = req.session.user;
  const rec  = db.prepare('SELECT * FROM receivables WHERE id = ?').get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Receivable not found' });
  if (rec.pending_deletion) return res.status(400).json({ error: 'A deletion request is already pending' });

  const { deletion_note } = req.body;
  db.prepare('UPDATE receivables SET pending_deletion = 1 WHERE id = ?').run(rec.id);
  db.prepare(`
    INSERT INTO approval_requests
      (type, entity_id, entity_ref, entity_snapshot, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
    VALUES ('delete_receivable', ?, ?, ?, ?, ?, ?, ?)
  `).run(rec.id, rec.invoice_number, JSON.stringify(rec), user.email, user.name || user.email, user.role, deletion_note || null);

  logAction(user, 'REQUEST_RECEIVABLE_DELETION', 'receivable', rec.id, rec.invoice_number);
  res.json({ success: true, action: 'deletion_requested' });
});

// ── PAYABLES (Pending / Accounts Payable) ────────────────────────────────

router.get('/payables', (req, res) => {
  const db = getDB();
  res.json(db.prepare(
    'SELECT * FROM payables ORDER BY due_date ASC, created_at DESC'
  ).all());
});

router.post('/payables', (req, res) => {
  const db   = getDB();
  const user = req.session.user;
  const { supplier_name, reference_number, description, amount, due_date, scheduled_date,
          currency, exchange_rate, submitter_note } = req.body;
  if (!supplier_name || !amount) {
    return res.status(400).json({ error: 'supplier_name and amount are required' });
  }
  const isSuperAdmin    = user?.role === 'super_admin';
  const pendingApproval = isSuperAdmin ? 0 : 1;
  const result = db.prepare(`
    INSERT INTO payables (supplier_name, reference_number, description, amount, due_date, scheduled_date,
                          currency, exchange_rate, pending_approval, created_by_email, created_by_name, created_by_role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(supplier_name, reference_number || '', description || '', parseFloat(amount),
         due_date || null, scheduled_date || null, currency || 'USD', parseFloat(exchange_rate) || 1.0,
         pendingApproval, user?.email || 'system', user?.name || 'System', user?.role || 'staff');
  const pay = db.prepare('SELECT * FROM payables WHERE id = ?').get(result.lastInsertRowid);

  if (!isSuperAdmin) {
    db.prepare(`
      INSERT INTO approval_requests
        (type, entity_id, entity_ref, entity_snapshot, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
      VALUES ('create_payable', ?, ?, ?, ?, ?, ?, ?)
    `).run(pay.id, pay.reference_number || String(pay.id), JSON.stringify(pay),
           user?.email, user?.name || user?.email, user?.role, submitter_note || null);
  }
  logAction(user, isSuperAdmin ? 'CREATE_PAYABLE' : 'SUBMIT_PAYABLE_FOR_APPROVAL',
    'payable', pay.id, pay.reference_number || String(pay.id));
  res.json(pay);
});

// Recall a pending-approval payable (owner or super_admin only)
router.post('/payables/:id/recall', (req, res) => {
  const db   = getDB();
  const user = req.session.user;
  const pay  = db.prepare('SELECT * FROM payables WHERE id = ?').get(req.params.id);
  if (!pay) return res.status(404).json({ error: 'Record not found' });
  if (!pay.pending_approval) return res.status(400).json({ error: 'This record is not pending approval' });
  if (pay.created_by_email !== user.email && user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only the creator or Super Admin can recall this submission' });
  }
  runTransaction((db) => {
    db.prepare('DELETE FROM payables WHERE id = ?').run(pay.id);
    db.prepare(`UPDATE approval_requests SET status = 'rejected', reviewer_note = 'Recalled by submitter',
      reviewed_at = datetime('now') WHERE entity_id = ? AND type = 'create_payable' AND status = 'pending'`)
      .run(pay.id);
  });
  logAction(user, 'RECALL_PAYABLE', 'payable', pay.id, pay.reference_number);
  res.json({ ok: true });
});

// Record payment made to supplier
router.post('/payables/:id/pay', (req, res) => {
  const db = getDB();
  const payable = db.prepare('SELECT * FROM payables WHERE id = ?').get(req.params.id);
  if (!payable) return res.status(404).json({ error: 'Record not found' });
  if (payable.pending_approval) return res.status(400).json({ error: 'This bill is still pending approval and cannot be paid yet' });

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
  const db   = getDB();
  const user = req.session.user;
  const pay  = db.prepare('SELECT * FROM payables WHERE id = ?').get(req.params.id);
  if (!pay) return res.status(404).json({ error: 'Payable not found' });
  if (pay.pending_deletion) return res.status(400).json({ error: 'A deletion request is already pending' });

  const { deletion_note } = req.body;
  db.prepare('UPDATE payables SET pending_deletion = 1 WHERE id = ?').run(pay.id);
  db.prepare(`
    INSERT INTO approval_requests
      (type, entity_id, entity_ref, entity_snapshot, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
    VALUES ('delete_payable', ?, ?, ?, ?, ?, ?, ?)
  `).run(pay.id, pay.reference_number || String(pay.id), JSON.stringify(pay), user.email, user.name || user.email, user.role, deletion_note || null);

  logAction(user, 'REQUEST_PAYABLE_DELETION', 'payable', pay.id, pay.reference_number);
  res.json({ success: true, action: 'deletion_requested' });
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
