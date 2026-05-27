const express = require('express');
const router = express.Router();
const { query, withTransaction } = require('../db/database');
const { logAction } = require('../utils/auditLog');

// ── Tax calculation helper (mirrors routes/tax.js) ───────────────────────────
function computeTax(taxRate, baseAmount) {
  const base    = parseFloat(baseAmount) || 0;
  const exempt  = parseFloat(taxRate.exempt_threshold) || 0;
  const taxable = Math.max(0, base - exempt);
  let   tax     = 0;
  if (taxRate.type === 'percentage') {
    const rate = parseFloat(taxRate.rate) || 0;
    tax = taxRate.is_inclusive ? taxable * rate / (100 + rate) : taxable * rate / 100;
  } else if (taxRate.type === 'fixed_amount') {
    tax = taxable > 0 ? (parseFloat(taxRate.amount) || 0) : 0;
  } else if (taxRate.type === 'tiered') {
    const tiers  = typeof taxRate.tiers === 'string' ? JSON.parse(taxRate.tiers) : (taxRate.tiers || []);
    const sorted = [...tiers].sort((a, b) => (parseFloat(a.min) || 0) - (parseFloat(b.min) || 0));
    for (const tier of sorted) {
      const tMin  = parseFloat(tier.min) || 0;
      const tMax  = tier.max != null && tier.max !== '' ? parseFloat(tier.max) : Infinity;
      const tRate = parseFloat(tier.rate) || 0;
      if (taxable <= tMin) break;
      tax += (Math.min(taxable, tMax) - tMin) * tRate / 100;
    }
  }
  return Math.round(tax * 100) / 100;
}

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

router.get('/receivables/export/csv', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT r.*,
        COALESCE(STRING_AGG(tr.code, ', ' ORDER BY ta.created_at), '') AS tax_codes,
        COALESCE(SUM(ta.tax_amount), 0)                                 AS total_tax_applied
      FROM receivables r
      LEFT JOIN tax_applications ta ON ta.entity_id = r.id AND ta.entity_type = 'receivable'
      LEFT JOIN tax_rates tr ON tr.id = ta.tax_rate_id
      GROUP BY r.id
      ORDER BY r.due_date, r.created_at
    `);
    const cols = ['customer_name','invoice_number','description','amount','currency','exchange_rate',
                  'due_date','scheduled_date','status','paid_amount','tax_codes','total_tax_applied'];
    const csv  = [cols.join(','), ...rows.map(r => cols.map(c => csvEsc(r[c])).join(','))].join('\n');
    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="receivables-${today}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/receivables/import/template', (req, res) => {
  const sample = [
    'customer_name,invoice_number,description,amount,currency,exchange_rate,due_date,scheduled_date,tax_rate_code,tax_base_amount',
    'John Santos,INV-001,Website design services,5000,USD,1,2026-02-28,2026-02-15,VAT-OUT,5000',
    'ABC Company,INV-002,Monthly retainer (non-VAT),2000,PHP,1,2026-03-01,,PT-3,2000',
    'Maria Reyes,INV-003,Consulting fee (no tax),8000,PHP,1,2026-03-15,,,'
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="receivables-template.csv"');
  res.send(sample);
});

router.post('/receivables/import/csv', async (req, res) => {
  const { csv, dryRun } = req.body;
  if (!csv) return res.status(400).json({ error: 'No CSV data provided' });
  const rows = parseCSVText(csv);
  if (!rows.length) return res.status(400).json({ error: 'CSV has no data rows' });

  // ── Validate ───────────────────────────────────────────────────────────────
  const errors = [];
  const taxRateCache = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.customer_name) errors.push(`Row ${i+2}: missing customer_name`);
    if (!r.amount || isNaN(parseFloat(r.amount))) errors.push(`Row ${i+2}: invalid amount`);
    if (r.exchange_rate !== undefined && r.exchange_rate !== '') {
      const rate = Number(r.exchange_rate);
      if (!isFinite(rate) || rate <= 0)
        errors.push(`Row ${i+2}: invalid exchange_rate "${r.exchange_rate}" — must be a positive number`);
    }
    if (r.tax_rate_code) {
      const code = r.tax_rate_code.trim().toUpperCase();
      if (!taxRateCache[code]) {
        const { rows: [tr] } = await query('SELECT * FROM tax_rates WHERE code = $1 AND is_active = 1', [code]);
        taxRateCache[code] = tr || null;
      }
      if (!taxRateCache[r.tax_rate_code.trim().toUpperCase()])
        errors.push(`Row ${i+2}: tax_rate_code "${r.tax_rate_code}" not found or inactive`);
    }
  }
  if (errors.length) return res.status(400).json({ error: 'Validation errors', details: errors });
  if (dryRun) return res.json({ ok: true, count: rows.length });

  // ── Import ─────────────────────────────────────────────────────────────────
  try {
    const imported = [], skipped = [];
    for (const r of rows) {
      try {
        const exchangeRate = (r.exchange_rate && isFinite(Number(r.exchange_rate)) && Number(r.exchange_rate) > 0)
          ? Number(r.exchange_rate) : 1.0;
        const { rows: [rec] } = await query(
          `INSERT INTO receivables
             (customer_name, invoice_number, description, amount, currency, exchange_rate, due_date, scheduled_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [r.customer_name,
           r.invoice_number || `INV-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
           r.description || '', parseFloat(r.amount),
           r.currency || 'USD', exchangeRate,
           r.due_date || null, r.scheduled_date || null]
        );

        // Apply tax if specified
        if (r.tax_rate_code) {
          const code    = r.tax_rate_code.trim().toUpperCase();
          const taxRate = taxRateCache[code];
          if (taxRate) {
            const base   = parseFloat(r.tax_base_amount) || parseFloat(r.amount);
            const taxAmt = computeTax(taxRate, base);
            await query(
              `INSERT INTO tax_applications (tax_rate_id, entity_type, entity_id, base_amount, tax_amount, notes)
               VALUES ($1,'receivable',$2,$3,$4,'Imported via CSV')`,
              [taxRate.id, rec.id, base, taxAmt]
            );
          }
        }

        imported.push(r.invoice_number || r.customer_name);
      } catch (e) {
        skipped.push(`${r.invoice_number || r.customer_name} — ${e.code === '23505' ? 'invoice number already exists' : e.message}`);
      }
    }
    res.json({ ok: true, imported: imported.length, skipped: skipped.length, skippedRefs: skipped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PAYABLES — Export / Import / Template ────────────────────────────────────

router.get('/payables/export/csv', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT p.*,
        COALESCE(STRING_AGG(tr.code, ', ' ORDER BY ta.created_at), '') AS tax_codes,
        COALESCE(SUM(ta.tax_amount), 0)                                 AS total_tax_applied
      FROM payables p
      LEFT JOIN tax_applications ta ON ta.entity_id = p.id AND ta.entity_type = 'payable'
      LEFT JOIN tax_rates tr ON tr.id = ta.tax_rate_id
      GROUP BY p.id
      ORDER BY p.due_date, p.created_at
    `);
    const cols = ['supplier_name','reference_number','description','amount','currency','exchange_rate',
                  'due_date','scheduled_date','status','paid_amount','tax_codes','total_tax_applied'];
    const csv  = [cols.join(','), ...rows.map(r => cols.map(c => csvEsc(r[c])).join(','))].join('\n');
    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payables-${today}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/payables/import/template', (req, res) => {
  const sample = [
    'supplier_name,reference_number,description,amount,currency,exchange_rate,due_date,scheduled_date,tax_rate_code,tax_base_amount',
    'Office Supplies Co,PO-001,Monthly office supplies,800,PHP,1,2026-02-15,2026-02-10,VAT-IN,800',
    'Juan dela Cruz,PO-002,Professional consulting fee,5000,PHP,1,2026-03-31,,EWT-10,5000',
    'Cloud Host Ltd,PO-003,Server hosting Q1,1200,USD,1,2026-03-31,,,'
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="payables-template.csv"');
  res.send(sample);
});

router.post('/payables/import/csv', async (req, res) => {
  const { csv, dryRun } = req.body;
  if (!csv) return res.status(400).json({ error: 'No CSV data provided' });
  const rows = parseCSVText(csv);
  if (!rows.length) return res.status(400).json({ error: 'CSV has no data rows' });

  // ── Validate ───────────────────────────────────────────────────────────────
  const errors = [];
  const taxRateCache = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.supplier_name) errors.push(`Row ${i+2}: missing supplier_name`);
    if (!r.amount || isNaN(parseFloat(r.amount))) errors.push(`Row ${i+2}: invalid amount`);
    if (r.exchange_rate !== undefined && r.exchange_rate !== '') {
      const rate = Number(r.exchange_rate);
      if (!isFinite(rate) || rate <= 0)
        errors.push(`Row ${i+2}: invalid exchange_rate "${r.exchange_rate}" — must be a positive number`);
    }
    if (r.tax_rate_code) {
      const code = r.tax_rate_code.trim().toUpperCase();
      if (!taxRateCache[code]) {
        const { rows: [tr] } = await query('SELECT * FROM tax_rates WHERE code = $1 AND is_active = 1', [code]);
        taxRateCache[code] = tr || null;
      }
      if (!taxRateCache[r.tax_rate_code.trim().toUpperCase()])
        errors.push(`Row ${i+2}: tax_rate_code "${r.tax_rate_code}" not found or inactive`);
    }
  }
  if (errors.length) return res.status(400).json({ error: 'Validation errors', details: errors });
  if (dryRun) return res.json({ ok: true, count: rows.length });

  // ── Import ─────────────────────────────────────────────────────────────────
  try {
    const imported = [], skipped = [];
    for (const r of rows) {
      try {
        const exchangeRate = (r.exchange_rate && isFinite(Number(r.exchange_rate)) && Number(r.exchange_rate) > 0)
          ? Number(r.exchange_rate) : 1.0;
        const { rows: [pay] } = await query(
          `INSERT INTO payables
             (supplier_name, reference_number, description, amount, currency, exchange_rate, due_date, scheduled_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [r.supplier_name, r.reference_number || '', r.description || '',
           parseFloat(r.amount), r.currency || 'USD', exchangeRate,
           r.due_date || null, r.scheduled_date || null]
        );

        // Apply tax if specified
        if (r.tax_rate_code) {
          const code    = r.tax_rate_code.trim().toUpperCase();
          const taxRate = taxRateCache[code];
          if (taxRate) {
            const base   = parseFloat(r.tax_base_amount) || parseFloat(r.amount);
            const taxAmt = computeTax(taxRate, base);
            await query(
              `INSERT INTO tax_applications (tax_rate_id, entity_type, entity_id, base_amount, tax_amount, notes)
               VALUES ($1,'payable',$2,$3,$4,'Imported via CSV')`,
              [taxRate.id, pay.id, base, taxAmt]
            );
          }
        }

        imported.push(r.supplier_name);
      } catch (e) {
        skipped.push(`${r.supplier_name} — ${e.message}`);
      }
    }
    res.json({ ok: true, imported: imported.length, skipped: skipped.length, skippedRefs: skipped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── RECEIVABLES CRUD ──────────────────────────────────────────────────────────

router.get('/receivables', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT r.*,
        COALESCE(STRING_AGG(tr.code, ', ' ORDER BY ta.created_at), '') AS tax_codes,
        COALESCE(SUM(ta.tax_amount), 0)                                 AS total_tax_applied
      FROM receivables r
      LEFT JOIN tax_applications ta ON ta.entity_id = r.id AND ta.entity_type = 'receivable'
      LEFT JOIN tax_rates tr ON tr.id = ta.tax_rate_id
      GROUP BY r.id
      ORDER BY r.due_date ASC, r.created_at DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/receivables', async (req, res) => {
  const user = req.session.user;
  const { customer_name, invoice_number, description, amount, due_date, scheduled_date,
          currency, exchange_rate, submitter_note } = req.body;
  if (!customer_name || !amount)
    return res.status(400).json({ error: 'customer_name and amount are required' });

  const isSuperAdmin    = user?.role === 'super_admin';
  const pendingApproval = isSuperAdmin ? 0 : 1;
  const invNum          = invoice_number || `INV-${Date.now()}`;

  try {
    const { rows: [rec] } = await query(
      `INSERT INTO receivables
         (customer_name, invoice_number, description, amount, due_date, scheduled_date,
          currency, exchange_rate, pending_approval, created_by_email, created_by_name, created_by_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [customer_name, invNum, description || '', parseFloat(amount),
       due_date || null, scheduled_date || null, currency || 'USD', parseFloat(exchange_rate) || 1.0,
       pendingApproval, user?.email || 'system', user?.name || 'System', user?.role || 'staff']
    );

    if (!isSuperAdmin) {
      await query(
        `INSERT INTO approval_requests
           (type, entity_id, entity_ref, entity_snapshot, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
         VALUES ('create_receivable', $1, $2, $3, $4, $5, $6, $7)`,
        [rec.id, invNum, JSON.stringify(rec), user?.email, user?.name || user?.email, user?.role, submitter_note || null]
      );
    }
    logAction(user, isSuperAdmin ? 'CREATE_RECEIVABLE' : 'SUBMIT_RECEIVABLE_FOR_APPROVAL', 'receivable', rec.id, invNum);
    res.json(rec);
  } catch (e) {
    res.status(e.code === '23505' ? 400 : 500).json({ error: e.code === '23505' ? 'Invoice number already exists' : e.message });
  }
});

router.post('/receivables/:id/recall', async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [rec] } = await query('SELECT * FROM receivables WHERE id = $1', [req.params.id]);
    if (!rec) return res.status(404).json({ error: 'Record not found' });
    if (!rec.pending_approval) return res.status(400).json({ error: 'This record is not pending approval' });
    if (rec.created_by_email !== user.email && user.role !== 'super_admin')
      return res.status(403).json({ error: 'Only the creator or Super Admin can recall this submission' });

    await withTransaction(async (client) => {
      await client.query('DELETE FROM receivables WHERE id = $1', [rec.id]);
      await client.query(
        "UPDATE approval_requests SET status = 'rejected', reviewer_note = 'Recalled by submitter', reviewed_at = NOW() WHERE entity_id = $1 AND type = 'create_receivable' AND status = 'pending'",
        [rec.id]
      );
    });
    logAction(user, 'RECALL_RECEIVABLE', 'receivable', rec.id, rec.invoice_number);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/receivables/:id/pay', async (req, res) => {
  try {
    const { rows: [rec] } = await query('SELECT * FROM receivables WHERE id = $1', [req.params.id]);
    if (!rec) return res.status(404).json({ error: 'Record not found' });
    if (rec.pending_approval) return res.status(400).json({ error: 'This invoice is still pending approval and cannot be paid yet' });

    const { amount, date, reference, notes, currency, exchange_rate } = req.body;
    const payAmount = parseFloat(amount) || (parseFloat(rec.amount) - parseFloat(rec.paid_amount));
    const newPaid   = parseFloat(rec.paid_amount) + payAmount;
    const newStatus = newPaid >= parseFloat(rec.amount) ? 'paid' : 'partial';
    const rate      = parseFloat(exchange_rate) || parseFloat(rec.exchange_rate) || 1.0;
    const cur       = currency || rec.currency || 'USD';

    await withTransaction(async (client) => {
      const { rows: [cashAcct] } = await client.query("SELECT id FROM accounts WHERE code = '1010'");
      const { rows: [arAcct] }   = await client.query("SELECT id FROM accounts WHERE code = '1100'");

      const { rows: [entry] } = await client.query(
        'INSERT INTO journal_entries (date, reference, description, status, currency, exchange_rate, entry_type) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [date || new Date().toISOString().split('T')[0], reference,
         `Payment received from ${rec.customer_name} — Invoice ${rec.invoice_number}`,
         'posted', cur, rate, 'regular']
      );
      await client.query(
        'INSERT INTO journal_lines (entry_id, account_id, debit, credit, notes, base_debit, base_credit) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [entry.id, cashAcct.id, payAmount, 0, notes || null, payAmount / rate, 0]
      );
      await client.query(
        'INSERT INTO journal_lines (entry_id, account_id, debit, credit, notes, base_debit, base_credit) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [entry.id, arAcct.id, 0, payAmount, notes || null, 0, payAmount / rate]
      );
      await client.query(
        'UPDATE receivables SET paid_amount = $1, status = $2, entry_id = $3 WHERE id = $4',
        [newPaid, newStatus, entry.id, rec.id]
      );
    });

    const { rows: [updated] } = await query('SELECT * FROM receivables WHERE id = $1', [rec.id]);
    res.json(updated);
  } catch (e) {
    res.status(e.code === '23505' ? 400 : 500)
       .json({ error: e.code === '23505' ? `Reference "${req.body.reference}" already exists` : e.message });
  }
});

router.patch('/receivables/:id/schedule', async (req, res) => {
  try {
    const { scheduled_date } = req.body;
    const { rows: [updated] } = await query(
      'UPDATE receivables SET scheduled_date = $1 WHERE id = $2 RETURNING *',
      [scheduled_date || null, req.params.id]
    );
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/receivables/:id', async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [rec] } = await query('SELECT * FROM receivables WHERE id = $1', [req.params.id]);
    if (!rec) return res.status(404).json({ error: 'Receivable not found' });
    if (rec.pending_deletion) return res.status(400).json({ error: 'A deletion request is already pending' });

    const { deletion_note } = req.body;
    await query('UPDATE receivables SET pending_deletion = 1 WHERE id = $1', [rec.id]);
    await query(
      `INSERT INTO approval_requests
         (type, entity_id, entity_ref, entity_snapshot, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
       VALUES ('delete_receivable', $1, $2, $3, $4, $5, $6, $7)`,
      [rec.id, rec.invoice_number, JSON.stringify(rec), user.email, user.name || user.email, user.role, deletion_note || null]
    );
    logAction(user, 'REQUEST_RECEIVABLE_DELETION', 'receivable', rec.id, rec.invoice_number);
    res.json({ success: true, action: 'deletion_requested' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PAYABLES CRUD ─────────────────────────────────────────────────────────────

router.get('/payables', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT p.*,
        COALESCE(STRING_AGG(tr.code, ', ' ORDER BY ta.created_at), '') AS tax_codes,
        COALESCE(SUM(ta.tax_amount), 0)                                 AS total_tax_applied
      FROM payables p
      LEFT JOIN tax_applications ta ON ta.entity_id = p.id AND ta.entity_type = 'payable'
      LEFT JOIN tax_rates tr ON tr.id = ta.tax_rate_id
      GROUP BY p.id
      ORDER BY p.due_date ASC, p.created_at DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/payables', async (req, res) => {
  const user = req.session.user;
  const { supplier_name, reference_number, description, amount, due_date, scheduled_date,
          currency, exchange_rate, submitter_note } = req.body;
  if (!supplier_name || !amount)
    return res.status(400).json({ error: 'supplier_name and amount are required' });

  const isSuperAdmin    = user?.role === 'super_admin';
  const pendingApproval = isSuperAdmin ? 0 : 1;

  try {
    const { rows: [pay] } = await query(
      `INSERT INTO payables
         (supplier_name, reference_number, description, amount, due_date, scheduled_date,
          currency, exchange_rate, pending_approval, created_by_email, created_by_name, created_by_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [supplier_name, reference_number || '', description || '', parseFloat(amount),
       due_date || null, scheduled_date || null, currency || 'USD', parseFloat(exchange_rate) || 1.0,
       pendingApproval, user?.email || 'system', user?.name || 'System', user?.role || 'staff']
    );

    if (!isSuperAdmin) {
      await query(
        `INSERT INTO approval_requests
           (type, entity_id, entity_ref, entity_snapshot, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
         VALUES ('create_payable', $1, $2, $3, $4, $5, $6, $7)`,
        [pay.id, pay.reference_number || String(pay.id), JSON.stringify(pay),
         user?.email, user?.name || user?.email, user?.role, submitter_note || null]
      );
    }
    logAction(user, isSuperAdmin ? 'CREATE_PAYABLE' : 'SUBMIT_PAYABLE_FOR_APPROVAL',
      'payable', pay.id, pay.reference_number || String(pay.id));
    res.json(pay);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/payables/:id/recall', async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [pay] } = await query('SELECT * FROM payables WHERE id = $1', [req.params.id]);
    if (!pay) return res.status(404).json({ error: 'Record not found' });
    if (!pay.pending_approval) return res.status(400).json({ error: 'This record is not pending approval' });
    if (pay.created_by_email !== user.email && user.role !== 'super_admin')
      return res.status(403).json({ error: 'Only the creator or Super Admin can recall this submission' });

    await withTransaction(async (client) => {
      await client.query('DELETE FROM payables WHERE id = $1', [pay.id]);
      await client.query(
        "UPDATE approval_requests SET status = 'rejected', reviewer_note = 'Recalled by submitter', reviewed_at = NOW() WHERE entity_id = $1 AND type = 'create_payable' AND status = 'pending'",
        [pay.id]
      );
    });
    logAction(user, 'RECALL_PAYABLE', 'payable', pay.id, pay.reference_number);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/payables/:id/pay', async (req, res) => {
  try {
    const { rows: [payable] } = await query('SELECT * FROM payables WHERE id = $1', [req.params.id]);
    if (!payable) return res.status(404).json({ error: 'Record not found' });
    if (payable.pending_approval) return res.status(400).json({ error: 'This bill is still pending approval and cannot be paid yet' });

    const { amount, date, reference, notes, currency, exchange_rate } = req.body;
    const payAmount = parseFloat(amount) || (parseFloat(payable.amount) - parseFloat(payable.paid_amount));
    const newPaid   = parseFloat(payable.paid_amount) + payAmount;
    const newStatus = newPaid >= parseFloat(payable.amount) ? 'paid' : 'partial';
    const rate      = parseFloat(exchange_rate) || parseFloat(payable.exchange_rate) || 1.0;
    const cur       = currency || payable.currency || 'USD';

    await withTransaction(async (client) => {
      const { rows: [cashAcct] } = await client.query("SELECT id FROM accounts WHERE code = '1010'");
      const { rows: [apAcct] }   = await client.query("SELECT id FROM accounts WHERE code = '2000'");

      const { rows: [entry] } = await client.query(
        'INSERT INTO journal_entries (date, reference, description, status, currency, exchange_rate, entry_type) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [date || new Date().toISOString().split('T')[0], reference,
         `Payment to ${payable.supplier_name}${payable.reference_number ? ' — Ref: ' + payable.reference_number : ''}`,
         'posted', cur, rate, 'regular']
      );
      await client.query(
        'INSERT INTO journal_lines (entry_id, account_id, debit, credit, notes, base_debit, base_credit) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [entry.id, apAcct.id, payAmount, 0, notes || null, payAmount / rate, 0]
      );
      await client.query(
        'INSERT INTO journal_lines (entry_id, account_id, debit, credit, notes, base_debit, base_credit) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [entry.id, cashAcct.id, 0, payAmount, notes || null, 0, payAmount / rate]
      );
      await client.query(
        'UPDATE payables SET paid_amount = $1, status = $2, entry_id = $3 WHERE id = $4',
        [newPaid, newStatus, entry.id, payable.id]
      );
    });

    const { rows: [updated] } = await query('SELECT * FROM payables WHERE id = $1', [payable.id]);
    res.json(updated);
  } catch (e) {
    res.status(e.code === '23505' ? 400 : 500)
       .json({ error: e.code === '23505' ? `Reference "${req.body.reference}" already exists` : e.message });
  }
});

router.patch('/payables/:id/schedule', async (req, res) => {
  try {
    const { scheduled_date } = req.body;
    const { rows: [updated] } = await query(
      'UPDATE payables SET scheduled_date = $1 WHERE id = $2 RETURNING *',
      [scheduled_date || null, req.params.id]
    );
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/payables/:id', async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [pay] } = await query('SELECT * FROM payables WHERE id = $1', [req.params.id]);
    if (!pay) return res.status(404).json({ error: 'Payable not found' });
    if (pay.pending_deletion) return res.status(400).json({ error: 'A deletion request is already pending' });

    const { deletion_note } = req.body;
    await query('UPDATE payables SET pending_deletion = 1 WHERE id = $1', [pay.id]);
    await query(
      `INSERT INTO approval_requests
         (type, entity_id, entity_ref, entity_snapshot, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
       VALUES ('delete_payable', $1, $2, $3, $4, $5, $6, $7)`,
      [pay.id, pay.reference_number || String(pay.id), JSON.stringify(pay),
       user.email, user.name || user.email, user.role, deletion_note || null]
    );
    logAction(user, 'REQUEST_PAYABLE_DELETION', 'payable', pay.id, pay.reference_number);
    res.json({ success: true, action: 'deletion_requested' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── UNIFIED PAYMENT SCHEDULE ─────────────────────────────────────────────────

router.get('/schedule', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { rows: receivables } = await query(`
      SELECT id, customer_name AS party_name, invoice_number AS ref_number,
             description, amount, paid_amount, due_date, scheduled_date,
             status, currency, exchange_rate, created_at, 'incoming' AS direction
      FROM receivables WHERE status != 'paid'
    `);

    const { rows: payables } = await query(`
      SELECT id, supplier_name AS party_name, reference_number AS ref_number,
             description, amount, paid_amount, due_date, scheduled_date,
             status, currency, exchange_rate, created_at, 'outgoing' AS direction
      FROM payables WHERE status != 'paid'
    `);

    const all = [...receivables, ...payables]
      .map(r => ({
        ...r,
        amount:     parseFloat(r.amount)     || 0,
        paid_amount: parseFloat(r.paid_amount) || 0,
        effective_date: r.scheduled_date || r.due_date,
        balance: (parseFloat(r.amount) || 0) - (parseFloat(r.paid_amount) || 0),
      }))
      .sort((a, b) => {
        if (!a.effective_date && !b.effective_date) return 0;
        if (!a.effective_date) return 1;
        if (!b.effective_date) return -1;
        return a.effective_date.localeCompare(b.effective_date);
      });

    res.json({ schedule: all, today });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
