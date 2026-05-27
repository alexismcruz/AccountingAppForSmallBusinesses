const express = require('express');
const router = express.Router();
const { query, withTransaction } = require('../db/database');
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

router.get('/export/csv', async (req, res) => {
  const { from, to } = req.query;
  const params = [];
  let idx = 1;
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
  if (from) { sql += ` AND je.date >= $${idx++}`; params.push(from); }
  if (to)   { sql += ` AND je.date <= $${idx++}`; params.push(to); }
  sql += ' ORDER BY je.date, je.reference, jl.id';

  try {
    const { rows } = await query(sql, params);
    const cols = ['date','reference','description','entry_type','currency','exchange_rate','account_code','account_name','debit','credit','line_notes'];
    const csv  = [cols.join(','), ...rows.map(r => cols.map(c => csvEsc(r[c])).join(','))].join('\n');
    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="journal-entries-${today}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
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

router.post('/import/csv', async (req, res) => {
  const { csv, dryRun } = req.body;
  if (!csv) return res.status(400).json({ error: 'No CSV data provided' });

  const rows = parseCSVText(csv);
  if (rows.length === 0) return res.status(400).json({ error: 'CSV has no data rows' });

  try {
    const { rows: allAccounts } = await query('SELECT id, code FROM accounts');
    const byCode = {};
    for (const a of allAccounts) byCode[a.code] = a.id;

    const entriesMap = new Map();
    const errors = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const lineNum = i + 2;
      if (!r.reference)    { errors.push(`Row ${lineNum}: missing reference`); continue; }
      if (!r.account_code) { errors.push(`Row ${lineNum}: missing account_code`); continue; }
      if (!byCode[r.account_code]) { errors.push(`Row ${lineNum}: account code "${r.account_code}" not found`); continue; }

      if (!entriesMap.has(r.reference)) {
        if (!r.date) { errors.push(`Row ${lineNum}: missing date`); continue; }

        let exchangeRate = 1.0;
        if (r.exchange_rate !== undefined && r.exchange_rate !== '') {
          const parsed = Number(r.exchange_rate);
          if (!isFinite(parsed) || parsed <= 0) {
            errors.push(`Row ${lineNum}: invalid exchange_rate "${r.exchange_rate}" — must be a positive number`);
            continue;
          }
          exchangeRate = parsed;
        }

        entriesMap.set(r.reference, {
          date: r.date, reference: r.reference,
          description: r.description || r.reference,
          entry_type: r.entry_type || 'regular',
          currency: r.currency || 'USD',
          exchange_rate: exchangeRate,
          lines: [],
        });
      }

      const debitN  = Number(r.debit  === '' || r.debit  === undefined ? '0' : r.debit);
      const creditN = Number(r.credit === '' || r.credit === undefined ? '0' : r.credit);
      if (!isFinite(debitN)  || debitN  < 0) { errors.push(`Row ${lineNum}: invalid debit "${r.debit}" — must be a non-negative number`);  continue; }
      if (!isFinite(creditN) || creditN < 0) { errors.push(`Row ${lineNum}: invalid credit "${r.credit}" — must be a non-negative number`); continue; }

      entriesMap.get(r.reference).lines.push({
        account_id: byCode[r.account_code],
        debit:  debitN,
        credit: creditN,
        notes:  r.line_notes || null,
      });
    }

    if (errors.length) return res.status(400).json({ error: 'Validation errors', details: errors });

    const entries = [...entriesMap.values()];
    for (const e of entries) {
      const dr = e.lines.reduce((s, l) => s + l.debit, 0);
      const cr = e.lines.reduce((s, l) => s + l.credit, 0);
      if (Math.abs(dr - cr) > 0.005) {
        errors.push(`Entry "${e.reference}": not balanced (Dr ${dr.toFixed(2)} ≠ Cr ${cr.toFixed(2)})`);
      }
    }
    if (errors.length) return res.status(400).json({ error: 'Balance errors', details: errors });
    if (dryRun) return res.json({ ok: true, count: entries.length, entries: entries.map(e => e.reference) });

    const imported = [], skipped = [];
    for (const e of entries) {
      try {
        await withTransaction(async (client) => {
          const { rows: [entry] } = await client.query(
            'INSERT INTO journal_entries (date, reference, description, status, currency, exchange_rate, entry_type) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
            [e.date, e.reference, e.description, 'posted', e.currency, e.exchange_rate, e.entry_type]
          );
          for (const l of e.lines) {
            await client.query(
              'INSERT INTO journal_lines (entry_id, account_id, debit, credit, notes, base_debit, base_credit) VALUES ($1,$2,$3,$4,$5,$6,$7)',
              [entry.id, l.account_id, l.debit, l.credit, l.notes, l.debit / e.exchange_rate, l.credit / e.exchange_rate]
            );
          }
        });
        imported.push(e.reference);
      } catch (err) {
        skipped.push(`${e.reference} — ${err.code === '23505' ? 'already exists' : err.message}`);
      }
    }

    res.json({ ok: true, imported: imported.length, skipped: skipped.length, importedRefs: imported, skippedRefs: skipped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Get all entries (paginated) ──────────────────────────────────────────────

router.get('/', async (req, res) => {
  const { from, to, search, page, limit } = req.query;
  const PAGE_SIZE   = Math.min(parseInt(limit) || 50, 200);
  const currentPage = Math.max(1, parseInt(page) || 1);
  const offset      = (currentPage - 1) * PAGE_SIZE;

  const params = [];
  let idx = 1;
  let where = 'WHERE 1=1';
  if (from)   { where += ` AND je.date >= $${idx++}`; params.push(from); }
  if (to)     { where += ` AND je.date <= $${idx++}`; params.push(to); }
  if (search) {
    where += ` AND (je.description ILIKE $${idx} OR je.reference ILIKE $${idx + 1})`;
    params.push(`%${search}%`, `%${search}%`);
    idx += 2;
  }

  const countSql = `SELECT COUNT(DISTINCT je.id) AS total FROM journal_entries je ${where}`;
  const dataSql  = `
    SELECT je.*, COALESCE(SUM(jl.debit), 0) AS total_amount
    FROM journal_entries je
    LEFT JOIN journal_lines jl ON je.id = jl.entry_id
    ${where}
    GROUP BY je.id ORDER BY je.date DESC, je.id DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  try {
    const [{ rows }, { rows: countRows }] = await Promise.all([
      query(dataSql,  [...params, PAGE_SIZE, offset]),
      query(countSql, params),
    ]);
    const total = parseInt(countRows[0].total);
    res.json({ rows, total, page: currentPage, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Get single entry with lines ──────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const { rows: [entry] } = await query('SELECT * FROM journal_entries WHERE id = $1', [req.params.id]);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    const { rows: lines } = await query(`
      SELECT jl.*, a.code, a.name as account_name, a.type as account_type,
             a.normal_balance, a.description as account_description
      FROM journal_lines jl
      JOIN accounts a ON jl.account_id = a.id
      WHERE jl.entry_id = $1 ORDER BY jl.id
    `, [req.params.id]);
    res.json({ ...entry, lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Create new journal entry ─────────────────────────────────────────────────

router.post('/', async (req, res) => {
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

  const isSuperAdmin = user?.role === 'super_admin';
  const entryStatus  = isSuperAdmin ? 'posted' : (submit ? 'pending_approval' : 'draft');

  try {
    const entryId = await withTransaction(async (client) => {
      const { rows: [result] } = await client.query(
        `INSERT INTO journal_entries
           (date, reference, description, status, currency, exchange_rate, entry_type,
            created_by_email, created_by_name, created_by_role)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [date, reference, description, entryStatus, cur, rate, entry_type || 'regular',
         user?.email || 'system', user?.name || 'System', user?.role || 'admin']
      );
      const id = result.id;
      for (const line of lines) {
        const debit  = parseFloat(line.debit)  || 0;
        const credit = parseFloat(line.credit) || 0;
        await client.query(
          'INSERT INTO journal_lines (entry_id, account_id, debit, credit, notes, base_debit, base_credit) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [id, line.account_id, debit, credit, line.notes || null, debit / rate, credit / rate]
        );
      }
      if (submit && !isSuperAdmin) {
        await client.query(
          `INSERT INTO approval_requests
             (type, entity_id, entity_ref, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
           VALUES ('create_entry', $1, $2, $3, $4, $5, $6)`,
          [id, reference, user?.email || 'system', user?.name || 'System', user?.role || 'staff', submitter_note || null]
        );
      }
      return id;
    });

    logAction(user, submit ? 'SUBMIT_ENTRY_FOR_APPROVAL' : 'CREATE_ENTRY_DRAFT', 'journal_entry', entryId, reference);

    const { rows: [entry] } = await query('SELECT * FROM journal_entries WHERE id = $1', [entryId]);
    const { rows: entryLines } = await query(
      'SELECT jl.*, a.code, a.name as account_name FROM journal_lines jl JOIN accounts a ON jl.account_id = a.id WHERE jl.entry_id = $1 ORDER BY jl.id',
      [entryId]
    );
    res.json({ ...entry, lines: entryLines });
  } catch (e) {
    res.status(e.code === '23505' ? 400 : 500)
       .json({ error: e.code === '23505' ? `Reference "${reference}" already exists` : e.message });
  }
});

// ── Submit a draft entry for approval ────────────────────────────────────────

router.post('/:id/submit', async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [entry] } = await query('SELECT * FROM journal_entries WHERE id = $1', [req.params.id]);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    if (entry.status !== 'draft') return res.status(400).json({ error: 'Only draft entries can be submitted' });

    const { submitter_note } = req.body;
    await withTransaction(async (client) => {
      await client.query("UPDATE journal_entries SET status = 'pending_approval' WHERE id = $1", [entry.id]);
      await client.query(
        `INSERT INTO approval_requests
           (type, entity_id, entity_ref, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
         VALUES ('create_entry', $1, $2, $3, $4, $5, $6)`,
        [entry.id, entry.reference, user?.email, user?.name || user?.email, user?.role, submitter_note || null]
      );
    });

    logAction(user, 'SUBMIT_ENTRY_FOR_APPROVAL', 'journal_entry', entry.id, entry.reference);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Recall a pending entry back to draft ─────────────────────────────────────

router.post('/:id/recall', async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [entry] } = await query('SELECT * FROM journal_entries WHERE id = $1', [req.params.id]);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    if (entry.status !== 'pending_approval') return res.status(400).json({ error: 'Only pending entries can be recalled' });

    await query("UPDATE journal_entries SET status = 'draft' WHERE id = $1", [entry.id]);
    await query(
      "UPDATE approval_requests SET status = 'rejected', reviewer_note = 'Recalled by submitter', reviewed_at = NOW() WHERE entity_id = $1 AND type = 'create_entry' AND status = 'pending'",
      [entry.id]
    );

    logAction(user, 'RECALL_ENTRY', 'journal_entry', entry.id, entry.reference);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Delete / request deletion ─────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [entry] } = await query('SELECT * FROM journal_entries WHERE id = $1', [req.params.id]);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    if (entry.status === 'draft') {
      const isOwner = entry.created_by_email === user.email;
      if (!isOwner && user.role !== 'super_admin')
        return res.status(403).json({ error: 'Only the creator or Super Admin can delete a draft entry' });
      await query('DELETE FROM journal_entries WHERE id = $1', [entry.id]);
      logAction(user, 'DELETE_ENTRY_DRAFT', 'journal_entry', entry.id, entry.reference);
      return res.json({ success: true, action: 'deleted' });
    }

    if (entry.status === 'pending_deletion')
      return res.status(400).json({ error: 'A deletion request is already pending for this entry' });

    if (entry.status === 'pending_approval') {
      const isOwner = entry.created_by_email === user.email;
      if (!isOwner && user.role !== 'super_admin')
        return res.status(403).json({ error: 'Only the creator or Super Admin can cancel a pending entry' });
      await query('DELETE FROM journal_entries WHERE id = $1', [entry.id]);
      await query(
        "UPDATE approval_requests SET status = 'rejected', reviewer_note = 'Cancelled by submitter', reviewed_at = NOW() WHERE entity_id = $1 AND type = 'create_entry' AND status = 'pending'",
        [entry.id]
      );
      logAction(user, 'CANCEL_PENDING_ENTRY', 'journal_entry', entry.id, entry.reference);
      return res.json({ success: true, action: 'cancelled' });
    }

    if (user.role === 'super_admin') {
      await withTransaction(async (client) => {
        await client.query('DELETE FROM journal_lines WHERE entry_id = $1', [entry.id]);
        await client.query('DELETE FROM journal_entries WHERE id = $1', [entry.id]);
      });
      logAction(user, 'DELETE_POSTED_ENTRY', 'journal_entry', entry.id, entry.reference);
      return res.json({ success: true, action: 'deleted' });
    }

    const { deletion_note } = req.body;
    await query("UPDATE journal_entries SET status = 'pending_deletion' WHERE id = $1", [entry.id]);
    await query(
      `INSERT INTO approval_requests
         (type, entity_id, entity_ref, entity_snapshot, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
       VALUES ('delete_entry', $1, $2, $3, $4, $5, $6, $7)`,
      [entry.id, entry.reference, JSON.stringify(entry), user.email, user.name || user.email, user.role, deletion_note || null]
    );

    logAction(user, 'REQUEST_ENTRY_DELETION', 'journal_entry', entry.id, entry.reference);
    res.json({ success: true, action: 'deletion_requested' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
