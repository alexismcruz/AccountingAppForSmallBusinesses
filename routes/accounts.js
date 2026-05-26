const express = require('express');
const router  = express.Router();
const { query, withTransaction } = require('../db/database');
const { logAction } = require('../utils/auditLog');

const ACCOUNT_TYPES    = ['Asset','Liability','Equity','Revenue','COGS','Expense'];
const NORMAL_BALANCES  = ['Debit','Credit'];

// ── Who can create/modify accounts directly (no approval) ────────────────────
function canDirect(role) { return role === 'super_admin'; }
function canView(role)   { return !!role; }

// ── CSV helpers ───────────────────────────────────────────────────────────────
function csvEsc(v) {
  const s = String(v ?? '');
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function parseCSVRow(line) {
  const result = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && !inQ)  { inQ = true; continue; }
    if (c === '"' && inQ)   { if (line[i+1] === '"') { cur += '"'; i++; } else inQ = false; continue; }
    if (c === ',' && !inQ)  { result.push(cur); cur = ''; continue; }
    cur += c;
  }
  result.push(cur);
  return result;
}
function parseCSV(text) {
  const lines   = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]);
  return lines.slice(1).map(l => {
    const vals = parseCSVRow(l);
    const obj  = {};
    headers.forEach((h,i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}

// ── GET /api/accounts — active + approved only (used by all dropdowns) ────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM accounts WHERE is_active = 1 AND pending_approval = 0 ORDER BY code`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/accounts/manage — all accounts for CoA management page ───────────
router.get('/manage', async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM accounts ORDER BY code`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/accounts/import/template ────────────────────────────────────────
router.get('/import/template', (req, res) => {
  const csv = [
    'code,name,type,normal_balance,description',
    '8000,Other Asset,Asset,Debit,Example asset account',
    '9000,Other Expense,Expense,Debit,Example expense account',
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="chart-of-accounts-template.csv"');
  res.send(csv);
});

// ── GET /api/accounts/export/csv ──────────────────────────────────────────────
router.get('/export/csv', async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM accounts WHERE is_active = 1 AND pending_approval = 0 ORDER BY code`);
    const cols = ['code','name','type','normal_balance','description'];
    const csv  = [cols.join(','), ...rows.map(r => cols.map(c => csvEsc(r[c])).join(','))].join('\n');
    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="chart-of-accounts-${today}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/accounts/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows: [acc] } = await query('SELECT * FROM accounts WHERE id = $1', [req.params.id]);
    if (!acc) return res.status(404).json({ error: 'Account not found' });
    res.json(acc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/accounts — create (with approval flow) ─────────────────────────
router.post('/', async (req, res) => {
  const user = req.session.user;
  if (user?.role === 'admin') return res.status(403).json({ error: 'Admin role is view-only for Chart of Accounts' });

  const { code, name, type, normal_balance, description, submitter_note } = req.body;
  if (!code || !name || !type || !normal_balance)
    return res.status(400).json({ error: 'code, name, type, and normal_balance are required' });
  if (!ACCOUNT_TYPES.includes(type))
    return res.status(400).json({ error: `type must be one of: ${ACCOUNT_TYPES.join(', ')}` });
  if (!NORMAL_BALANCES.includes(normal_balance))
    return res.status(400).json({ error: 'normal_balance must be Debit or Credit' });

  const direct = canDirect(user?.role);
  try {
    const { rows: [acc] } = await query(
      `INSERT INTO accounts
         (code, name, type, normal_balance, description, pending_approval,
          created_by_email, created_by_name, created_by_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [code.trim().toUpperCase(), name.trim(), type, normal_balance,
       description || '', direct ? 0 : 1,
       user?.email || 'system', user?.name || 'System', user?.role || 'staff']
    );
    if (!direct) {
      await query(
        `INSERT INTO approval_requests
           (type, entity_id, entity_ref, entity_snapshot, submitted_by_email,
            submitted_by_name, submitted_by_role, submitter_note)
         VALUES ('create_account',$1,$2,$3,$4,$5,$6,$7)`,
        [acc.id, acc.code,
         JSON.stringify({ code: acc.code, name: acc.name, type: acc.type, normal_balance: acc.normal_balance }),
         user?.email, user?.name || user?.email, user?.role, submitter_note || null]
      );
    }
    logAction(user, direct ? 'CREATE_ACCOUNT' : 'SUBMIT_ACCOUNT_FOR_APPROVAL', 'account', acc.id, acc.code);
    res.json(acc);
  } catch (e) {
    res.status(e.code === '23505' ? 400 : 500).json({
      error: e.code === '23505' ? `Account code "${code.toUpperCase()}" already exists` : e.message,
    });
  }
});

// ── POST /api/accounts/import/csv — bulk import ───────────────────────────────
router.post('/import/csv', async (req, res) => {
  const user = req.session.user;
  if (user?.role === 'admin') return res.status(403).json({ error: 'Admin role is view-only' });

  const { csv: csvText, dryRun } = req.body;
  if (!csvText) return res.status(400).json({ error: 'No CSV data provided' });
  const rows = parseCSV(csvText);
  if (!rows.length) return res.status(400).json({ error: 'CSV has no data rows' });

  const errors = [];
  rows.forEach((r, i) => {
    if (!r.code)           errors.push(`Row ${i+2}: missing code`);
    if (!r.name)           errors.push(`Row ${i+2}: missing name`);
    if (r.type && !ACCOUNT_TYPES.includes(r.type))
      errors.push(`Row ${i+2}: invalid type "${r.type}"`);
    if (r.normal_balance && !NORMAL_BALANCES.includes(r.normal_balance))
      errors.push(`Row ${i+2}: invalid normal_balance "${r.normal_balance}"`);
  });
  if (errors.length) return res.status(400).json({ error: 'Validation errors', details: errors });
  if (dryRun) return res.json({ ok: true, count: rows.length });

  const direct = canDirect(user?.role);
  const imported = [], skipped = [];

  for (const r of rows) {
    try {
      const { rows: [acc] } = await query(
        `INSERT INTO accounts
           (code, name, type, normal_balance, description, pending_approval,
            created_by_email, created_by_name, created_by_role)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [r.code.trim().toUpperCase(), r.name.trim(),
         r.type || 'Expense', r.normal_balance || 'Debit',
         r.description || '', direct ? 0 : 1,
         user?.email, user?.name, user?.role]
      );
      if (!direct) {
        await query(
          `INSERT INTO approval_requests
             (type, entity_id, entity_ref, entity_snapshot,
              submitted_by_email, submitted_by_name, submitted_by_role)
           VALUES ('create_account',$1,$2,$3,$4,$5,$6)`,
          [acc.id, acc.code,
           JSON.stringify({ code: acc.code, name: acc.name, type: acc.type }),
           user?.email, user?.name || user?.email, user?.role]
        );
      }
      imported.push(r.code);
    } catch (e) {
      skipped.push(`${r.code} — ${e.code === '23505' ? 'code already exists' : e.message}`);
    }
  }
  logAction(user, 'IMPORT_CSV_ACCOUNTS', 'account', null, null,
    { imported: imported.length, skipped: skipped.length, mode: direct ? 'direct' : 'pending_approval' });
  res.json({ ok: true, imported: imported.length, skipped: skipped.length, skippedRefs: skipped, pendingApproval: !direct });
});

// ── PUT /api/accounts/:id — update name/description ──────────────────────────
router.put('/:id', async (req, res) => {
  const user = req.session.user;
  if (user?.role === 'admin') return res.status(403).json({ error: 'Admin role is view-only' });

  const { name, description, type, normal_balance } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const { rows: [acc] } = await query(
      `UPDATE accounts SET name=$1, description=$2, type=COALESCE($3,type), normal_balance=COALESCE($4,normal_balance)
       WHERE id=$5 RETURNING *`,
      [name.trim(), description || '', type || null, normal_balance || null, req.params.id]
    );
    if (!acc) return res.status(404).json({ error: 'Account not found' });
    logAction(user, 'UPDATE_ACCOUNT', 'account', acc.id, acc.code);
    res.json(acc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/accounts/:id — soft-deactivate (direct for super_admin, else approval) ──
router.delete('/:id', async (req, res) => {
  const user = req.session.user;
  if (user?.role === 'admin') return res.status(403).json({ error: 'Admin role is view-only' });

  try {
    const { rows: [acc] } = await query('SELECT * FROM accounts WHERE id = $1', [req.params.id]);
    if (!acc) return res.status(404).json({ error: 'Account not found' });
    if (acc.pending_deletion) return res.status(400).json({ error: 'A deletion request is already pending' });

    // Prevent deactivating accounts with journal line activity
    const { rowCount: usageCount } = await query(
      'SELECT 1 FROM journal_lines WHERE account_id = $1 LIMIT 1', [acc.id]
    );
    if (usageCount > 0 && !canDirect(user?.role))
      return res.status(400).json({ error: 'This account has journal entries. Only Super Admin can deactivate it.' });

    if (canDirect(user?.role)) {
      await query('UPDATE accounts SET is_active = 0 WHERE id = $1', [acc.id]);
      logAction(user, 'DEACTIVATE_ACCOUNT', 'account', acc.id, acc.code);
      return res.json({ success: true, action: 'deactivated' });
    }

    const { deletion_note } = req.body;
    await query('UPDATE accounts SET pending_deletion = 1 WHERE id = $1', [acc.id]);
    await query(
      `INSERT INTO approval_requests
         (type, entity_id, entity_ref, entity_snapshot, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
       VALUES ('delete_account',$1,$2,$3,$4,$5,$6,$7)`,
      [acc.id, acc.code, JSON.stringify(acc),
       user.email, user.name || user.email, user.role, deletion_note || null]
    );
    logAction(user, 'REQUEST_ACCOUNT_DELETION', 'account', acc.id, acc.code);
    res.json({ success: true, action: 'deletion_requested' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/accounts/:id/recall — recall pending-approval account ───────────
router.post('/:id/recall', async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [acc] } = await query('SELECT * FROM accounts WHERE id = $1', [req.params.id]);
    if (!acc) return res.status(404).json({ error: 'Account not found' });
    if (!acc.pending_approval) return res.status(400).json({ error: 'This account is not pending approval' });
    if (acc.created_by_email !== user.email && !canDirect(user?.role))
      return res.status(403).json({ error: 'Only the creator or Super Admin can recall this submission' });

    await withTransaction(async (client) => {
      await client.query('DELETE FROM accounts WHERE id = $1', [acc.id]);
      await client.query(
        `UPDATE approval_requests SET status='rejected', reviewer_note='Recalled by submitter', reviewed_at=NOW()
         WHERE entity_id=$1 AND type='create_account' AND status='pending'`,
        [acc.id]
      );
    });
    logAction(user, 'RECALL_ACCOUNT', 'account', acc.id, acc.code);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/accounts/:id/reactivate ────────────────────────────────────────
router.post('/:id/reactivate', async (req, res) => {
  const user = req.session.user;
  if (!['finance','super_admin'].includes(user?.role))
    return res.status(403).json({ error: 'Finance role or above required to reactivate accounts' });
  try {
    const { rows: [acc] } = await query(
      `UPDATE accounts SET is_active = 1, pending_deletion = 0 WHERE id = $1 RETURNING *`, [req.params.id]
    );
    if (!acc) return res.status(404).json({ error: 'Account not found' });
    logAction(user, 'REACTIVATE_ACCOUNT', 'account', acc.id, acc.code);
    res.json(acc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
