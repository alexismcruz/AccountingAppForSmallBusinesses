const express = require('express');
const router = express.Router();
const { getDB, runTransaction } = require('../db/database');
const { logAction } = require('../utils/auditLog');

// ── CSV helpers ──────────────────────────────────────────────────────────────

function csvEsc(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
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
    if (c === '"' && inQ) {
      if (line[i + 1] === '"') { cur += '"'; i++; continue; }
      inQ = false; continue;
    }
    if (c === ',' && !inQ) { result.push(cur); cur = ''; continue; }
    cur += c;
  }
  result.push(cur);
  return result;
}

// ── Export journal entries as CSV ────────────────────────────────────────────

router.get('/export/csv', (req, res) => {
  const db = getDB();
  const { from, to } = req.query;
  let sql = `
    SELECT je.date, je.reference, je.description, je.entry_type,
           je.currency, je.exchange_rate,
           a.code AS account_code, a.name AS account_name,
           jl.debit, jl.credit, COALESCE(jl.notes,'') AS line_notes
    FROM journal_entries je
    JOIN journal_lines jl ON jl.entry_id = je.id
    JOIN accounts a ON a.id = jl.account_id
    WHERE 1=1
  `;
  const params = [];
  if (from) { sql += ' AND je.date >= ?'; params.push(from); }
  if (to)   { sql += ' AND je.date <= ?'; params.push(to); }
  sql += ' ORDER BY je.date, je.reference, jl.id';

  const rows = db.prepare(sql).all(...params);
  const cols = ['date','reference','description','entry_type','currency','exchange_rate','account_code','account_name','debit','credit','line_notes'];
  const csv  = [cols.join(','), ...rows.map(r => cols.map(c => csvEsc(r[c])).join(','))].join('\n');

  const today = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="journal-entries-${today}.csv"`);
  res.send(csv);
});

// ── CSV import template ──────────────────────────────────────────────────────

router.get('/import/template', (req, res) => {
  const sample = [
    'date,reference,description,entry_type,currency,exchange_rate,account_code,debit,credit,line_notes',
    '2026-01-01,JE-0001,Owner investment,regular,USD,1,1010,5000,0,Cash deposited',
    '2026-01-01,JE-0001,Owner investment,regular,USD,1,3000,0,5000,Initial capital',
    '2026-01-15,JE-0002,January rent payment,regular,USD,1,6100,1200,0,',
    '2026-01-15,JE-0002,January rent payment,regular,USD,1,1010,0,1200,',
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="journal-entries-template.csv"');
  res.send(sample);
});

// ── Import journal entries from CSV ──────────────────────────────────────────

router.post('/import/csv', (req, res) => {
  const db  = getDB();
  const { csv, dryRun } = req.body;
  if (!csv) return res.status(400).json({ error: 'No CSV data provided' });

  const rows = parseCSVText(csv);
  if (rows.length === 0) return res.status(400).json({ error: 'CSV has no data rows' });

  // Build account lookup by code
  const allAccounts = db.prepare('SELECT id, code FROM accounts').all();
  const byCode = {};
  for (const a of allAccounts) byCode[a.code] = a.id;

  // Group rows by reference
  const entriesMap = new Map();
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const lineNum = i + 2; // +2 because row 1 is the header
    if (!r.reference) { errors.push(`Row ${lineNum}: missing reference`); continue; }
    if (!r.account_code) { errors.push(`Row ${lineNum}: missing account_code`); continue; }
    if (!byCode[r.account_code]) { errors.push(`Row ${lineNum}: account code "${r.account_code}" not found`); continue; }

    if (!entriesMap.has(r.reference)) {
      if (!r.date) { errors.push(`Row ${lineNum}: missing date`); continue; }
      entriesMap.set(r.reference, {
        date: r.date,
        reference: r.reference,
        description: r.description || r.reference,
        entry_type: r.entry_type || 'regular',
        currency: r.currency || 'USD',
        exchange_rate: parseFloat(r.exchange_rate) || 1.0,
        lines: [],
      });
    }
    entriesMap.get(r.reference).lines.push({
      account_id: byCode[r.account_code],
      debit:  parseFloat(r.debit)  || 0,
      credit: parseFloat(r.credit) || 0,
      notes:  r.line_notes || null,
    });
  }

  if (errors.length) return res.status(400).json({ error: 'Validation errors', details: errors });

  // Validate each entry balances
  const entries = [...entriesMap.values()];
  for (const e of entries) {
    const dr = e.lines.reduce((s, l) => s + l.debit,  0);
    const cr = e.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(dr - cr) > 0.005) {
      errors.push(`Entry "${e.reference}": not balanced (Dr ${dr.toFixed(2)} ≠ Cr ${cr.toFixed(2)})`);
    }
  }
  if (errors.length) return res.status(400).json({ error: 'Balance errors', details: errors });

  if (dryRun) return res.json({ ok: true, count: entries.length, entries: entries.map(e => e.reference) });

  // Insert
  const imported = [], skipped = [];
  const entryStmt = db.prepare(
    'INSERT INTO journal_entries (date, reference, description, status, currency, exchange_rate, entry_type) VALUES (?,?,?,?,?,?,?)'
  );
  const lineStmt = db.prepare(
    'INSERT INTO journal_lines (entry_id, account_id, debit, credit, notes, base_debit, base_credit) VALUES (?,?,?,?,?,?,?)'
  );

  for (const e of entries) {
    try {
      runTransaction((db) => {
        const r = entryStmt.run(e.date, e.reference, e.description, 'posted', e.currency, e.exchange_rate, e.entry_type);
        const id = r.lastInsertRowid;
        for (const l of e.lines) {
          lineStmt.run(id, l.account_id, l.debit, l.credit, l.notes, l.debit / e.exchange_rate, l.credit / e.exchange_rate);
        }
      });
      imported.push(e.reference);
    } catch (err) {
      skipped.push(`${e.reference} — ${err.message.includes('UNIQUE') ? 'already exists' : err.message}`);
    }
  }

  res.json({ ok: true, imported: imported.length, skipped: skipped.length, importedRefs: imported, skippedRefs: skipped });
});

// ── Get all entries with optional search/date filter ─────────────────────────

router.get('/', (req, res) => {
  const db = getDB();
  const { from, to, search } = req.query;
  let sql = `
    SELECT je.*, COALESCE(SUM(jl.debit), 0) as total_amount
    FROM journal_entries je
    LEFT JOIN journal_lines jl ON je.id = jl.entry_id
    WHERE 1=1
  `;
  const params = [];
  if (from)   { sql += ' AND je.date >= ?'; params.push(from); }
  if (to)     { sql += ' AND je.date <= ?'; params.push(to); }
  if (search) {
    sql += ' AND (je.description LIKE ? OR je.reference LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' GROUP BY je.id ORDER BY je.date DESC, je.id DESC';
  res.json(db.prepare(sql).all(...params));
});

// ── Get single entry with lines ──────────────────────────────────────────────

router.get('/:id', (req, res) => {
  const db = getDB();
  const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  entry.lines = db.prepare(`
    SELECT jl.*, a.code, a.name as account_name, a.type as account_type,
           a.normal_balance, a.description as account_description
    FROM journal_lines jl
    JOIN accounts a ON jl.account_id = a.id
    WHERE jl.entry_id = ?
    ORDER BY jl.id
  `).all(req.params.id);
  res.json(entry);
});

// ── Create new journal entry ─────────────────────────────────────────────────
// Body: { date, reference, description, lines, currency, exchange_rate,
//         entry_type, submit: bool, submitter_note: string }
// submit=false  → status: 'draft'
// submit=true   → status: 'pending_approval' + creates approval_request

router.post('/', (req, res) => {
  const db = getDB();
  const { date, reference, description, lines, currency, exchange_rate, entry_type, submit, submitter_note } = req.body;
  const user = req.session.user;

  if (!date || !reference || !description)
    return res.status(400).json({ error: 'date, reference, and description are required' });
  if (!lines || lines.length < 2)
    return res.status(400).json({ error: 'At least 2 line items are required' });

  const rate = parseFloat(exchange_rate) || 1.0;
  const cur  = currency || 'USD';
  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.005)
    return res.status(400).json({ error: `Entry is not balanced. Debits: ${totalDebit.toFixed(2)}, Credits: ${totalCredit.toFixed(2)}` });

  // super_admin can post directly; everyone else goes through approval
  const isSuperAdmin = user?.role === 'super_admin';
  const entryStatus  = isSuperAdmin ? 'posted' : (submit ? 'pending_approval' : 'draft');

  try {
    const entryId = runTransaction((db) => {
      const result = db.prepare(
        `INSERT INTO journal_entries
           (date, reference, description, status, currency, exchange_rate, entry_type,
            created_by_email, created_by_name, created_by_role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(date, reference, description, entryStatus, cur, rate, entry_type || 'regular',
            user?.email || 'system', user?.name || 'System', user?.role || 'admin');
      const id = result.lastInsertRowid;
      const lineStmt = db.prepare(
        'INSERT INTO journal_lines (entry_id, account_id, debit, credit, notes, base_debit, base_credit) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      for (const line of lines) {
        const debit  = parseFloat(line.debit)  || 0;
        const credit = parseFloat(line.credit) || 0;
        lineStmt.run(id, line.account_id, debit, credit, line.notes || null, debit / rate, credit / rate);
      }
      // Create approval request when submitting
      if (submit && !isSuperAdmin) {
        db.prepare(`
          INSERT INTO approval_requests
            (type, entity_id, entity_ref, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
          VALUES ('create_entry', ?, ?, ?, ?, ?, ?)
        `).run(id, reference, user?.email || 'system', user?.name || 'System', user?.role || 'staff', submitter_note || null);
      }
      return id;
    });

    logAction(user, submit ? 'SUBMIT_ENTRY_FOR_APPROVAL' : 'CREATE_ENTRY_DRAFT',
      'journal_entry', entryId, reference);

    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(entryId);
    entry.lines = db.prepare(`
      SELECT jl.*, a.code, a.name as account_name
      FROM journal_lines jl JOIN accounts a ON jl.account_id = a.id
      WHERE jl.entry_id = ? ORDER BY jl.id
    `).all(entryId);
    res.json(entry);
  } catch (e) {
    res.status(e.message.includes('UNIQUE') ? 400 : 500)
       .json({ error: e.message.includes('UNIQUE') ? `Reference "${reference}" already exists` : e.message });
  }
});

// ── Submit a draft entry for approval ────────────────────────────────────────
router.post('/:id/submit', (req, res) => {
  const db    = getDB();
  const user  = req.session.user;
  const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  if (entry.status !== 'draft') return res.status(400).json({ error: 'Only draft entries can be submitted' });

  const { submitter_note } = req.body;
  runTransaction((db) => {
    db.prepare("UPDATE journal_entries SET status = 'pending_approval' WHERE id = ?").run(entry.id);
    db.prepare(`
      INSERT INTO approval_requests
        (type, entity_id, entity_ref, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
      VALUES ('create_entry', ?, ?, ?, ?, ?, ?)
    `).run(entry.id, entry.reference, user?.email, user?.name || user?.email, user?.role, submitter_note || null);
  });

  logAction(user, 'SUBMIT_ENTRY_FOR_APPROVAL', 'journal_entry', entry.id, entry.reference);
  res.json({ ok: true });
});

// ── Recall a pending entry back to draft ─────────────────────────────────────
router.post('/:id/recall', (req, res) => {
  const db    = getDB();
  const user  = req.session.user;
  const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  if (entry.status !== 'pending_approval') return res.status(400).json({ error: 'Only pending entries can be recalled' });

  db.prepare("UPDATE journal_entries SET status = 'draft' WHERE id = ?").run(entry.id);
  db.prepare("UPDATE approval_requests SET status = 'rejected', reviewer_note = 'Recalled by submitter', reviewed_at = datetime('now') WHERE entity_id = ? AND type = 'create_entry' AND status = 'pending'")
    .run(entry.id);

  logAction(user, 'RECALL_ENTRY', 'journal_entry', entry.id, entry.reference);
  res.json({ ok: true });
});

// ── Delete / request deletion ─────────────────────────────────────────────────
// Draft entries: deleted immediately (if owner or super_admin)
// Posted entries: creates a deletion approval request
// Pending-deletion entries: already waiting, error

router.delete('/:id', (req, res) => {
  const db    = getDB();
  const user  = req.session.user;
  const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  // Draft — delete immediately (owner or super_admin only)
  if (entry.status === 'draft') {
    const isOwner = entry.created_by_email === user.email;
    if (!isOwner && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only the creator or Super Admin can delete a draft entry' });
    }
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(entry.id);
    logAction(user, 'DELETE_ENTRY_DRAFT', 'journal_entry', entry.id, entry.reference);
    return res.json({ success: true, action: 'deleted' });
  }

  // Already awaiting deletion
  if (entry.status === 'pending_deletion') {
    return res.status(400).json({ error: 'A deletion request is already pending for this entry' });
  }

  // Pending-approval entry — submitter can cancel it
  if (entry.status === 'pending_approval') {
    const isOwner = entry.created_by_email === user.email;
    if (!isOwner && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only the creator or Super Admin can cancel a pending entry' });
    }
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(entry.id);
    db.prepare("UPDATE approval_requests SET status = 'rejected', reviewer_note = 'Cancelled by submitter', reviewed_at = datetime('now') WHERE entity_id = ? AND type = 'create_entry' AND status = 'pending'")
      .run(entry.id);
    logAction(user, 'CANCEL_PENDING_ENTRY', 'journal_entry', entry.id, entry.reference);
    return res.json({ success: true, action: 'cancelled' });
  }

  // Posted — super_admin can delete directly (bypasses approval workflow)
  if (user.role === 'super_admin') {
    runTransaction((db) => {
      db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(entry.id);
      db.prepare('DELETE FROM journal_entries WHERE id = ?').run(entry.id);
    });
    logAction(user, 'DELETE_POSTED_ENTRY', 'journal_entry', entry.id, entry.reference);
    return res.json({ success: true, action: 'deleted' });
  }

  // Posted — create deletion request (all other roles)
  const { deletion_note } = req.body;
  db.prepare("UPDATE journal_entries SET status = 'pending_deletion' WHERE id = ?").run(entry.id);
  db.prepare(`
    INSERT INTO approval_requests
      (type, entity_id, entity_ref, entity_snapshot, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
    VALUES ('delete_entry', ?, ?, ?, ?, ?, ?, ?)
  `).run(entry.id, entry.reference, JSON.stringify(entry), user.email, user.name || user.email, user.role, deletion_note || null);

  logAction(user, 'REQUEST_ENTRY_DELETION', 'journal_entry', entry.id, entry.reference);
  res.json({ success: true, action: 'deletion_requested' });
});

module.exports = router;
