const express = require('express');
const router  = express.Router();
const { query, withTransaction } = require('../db/database');
const { logAction } = require('../utils/auditLog');

// ── Who can approve whose submissions ────────────────────────────────────────
function canApprove(approverRole, approverEmail, submitterRole, submitterEmail) {
  if (!approverRole || !submitterRole)   return false;
  if (approverEmail === submitterEmail)  return false;
  if (approverRole === 'staff')          return false;
  if (approverRole === 'admin')          return false;
  if (approverRole === 'super_admin')    return true;
  if (approverRole === 'manager')        return submitterRole === 'staff';
  if (approverRole === 'finance')        return ['staff', 'manager', 'finance'].includes(submitterRole);
  return false;
}

// ── GET /api/approvals/pending-count ─────────────────────────────────────────
router.get('/pending-count', async (req, res) => {
  try {
    const user = req.session.user;
    const { rows } = await query("SELECT submitted_by_email, submitted_by_role FROM approval_requests WHERE status = 'pending'");
    const count = rows.filter(r => canApprove(user.role, user.email, r.submitted_by_role, r.submitted_by_email)).length;
    res.json({ count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/approvals ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const user   = req.session.user;
    const status = req.query.status || 'pending';

    let sql = 'SELECT * FROM approval_requests';
    const params = [];
    if (status !== 'all') { sql += ' WHERE status = $1'; params.push(status); }
    sql += ' ORDER BY created_at DESC';

    let { rows } = await query(sql, params);
    rows = rows.map(r => ({
      ...r,
      can_approve: canApprove(user.role, user.email, r.submitted_by_role, r.submitted_by_email) && r.status === 'pending',
    }));

    if (user.role === 'staff' || user.role === 'manager') {
      rows = rows.filter(r => r.submitted_by_email === user.email || r.can_approve);
    }

    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/approvals/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows: [row] } = await query('SELECT * FROM approval_requests WHERE id = $1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Request not found' });
    const user = req.session.user;
    res.json({
      ...row,
      can_approve: canApprove(user.role, user.email, row.submitted_by_role, row.submitted_by_email) && row.status === 'pending',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/approvals/:id/approve ──────────────────────────────────────────
router.post('/:id/approve', async (req, res) => {
  const user = req.session.user;
  const { note } = req.body;
  if (!note || !note.trim()) return res.status(400).json({ error: 'An approval note is required' });

  try {
    const { rows: [request] } = await query('SELECT * FROM approval_requests WHERE id = $1', [req.params.id]);
    if (!request)                    return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'This request has already been reviewed' });
    if (!canApprove(user.role, user.email, request.submitted_by_role, request.submitted_by_email))
      return res.status(403).json({ error: 'You do not have permission to approve this request' });

    await withTransaction(async (client) => {
      if (request.type === 'create_entry') {
        await client.query("UPDATE journal_entries SET status = 'posted' WHERE id = $1", [request.entity_id]);
      } else if (request.type === 'delete_entry') {
        await client.query('DELETE FROM journal_entries WHERE id = $1', [request.entity_id]);
      } else if (request.type === 'delete_receivable') {
        await client.query('DELETE FROM receivables WHERE id = $1', [request.entity_id]);
      } else if (request.type === 'delete_payable') {
        await client.query('DELETE FROM payables WHERE id = $1', [request.entity_id]);
      } else if (request.type === 'create_receivable') {
        await client.query('UPDATE receivables SET pending_approval = 0 WHERE id = $1', [request.entity_id]);
      } else if (request.type === 'create_payable') {
        await client.query('UPDATE payables SET pending_approval = 0 WHERE id = $1', [request.entity_id]);
      } else if (request.type === 'create_inventory') {
        await client.query('UPDATE inventory_items SET pending_approval = 0 WHERE id = $1', [request.entity_id]);
      } else if (request.type === 'delete_inventory') {
        await client.query('UPDATE inventory_items SET is_active = 0, pending_deletion = 0 WHERE id = $1', [request.entity_id]);
      }

      await client.query(
        `UPDATE approval_requests
         SET status = 'approved', reviewed_by_email = $1, reviewed_by_name = $2,
             reviewer_note = $3, reviewed_at = NOW()
         WHERE id = $4`,
        [user.email, user.name || user.email, note.trim(), request.id]
      );
    });

    const entityType = request.type.includes('entry') ? 'journal_entry' : request.type.replace(/^(create|delete)_/, '');
    logAction(user, `APPROVE_${request.type.toUpperCase()}`, entityType,
      request.entity_id, request.entity_ref, { note: note.trim(), request_id: request.id });

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/approvals/:id/reject ────────────────────────────────────────────
router.post('/:id/reject', async (req, res) => {
  const user = req.session.user;
  const { note } = req.body;
  if (!note || !note.trim()) return res.status(400).json({ error: 'A rejection reason is required' });

  try {
    const { rows: [request] } = await query('SELECT * FROM approval_requests WHERE id = $1', [req.params.id]);
    if (!request)                    return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'This request has already been reviewed' });
    if (!canApprove(user.role, user.email, request.submitted_by_role, request.submitted_by_email))
      return res.status(403).json({ error: 'You do not have permission to reject this request' });

    if (request.type === 'create_entry') {
      await query("UPDATE journal_entries SET status = 'rejected' WHERE id = $1", [request.entity_id]);
    } else if (request.type === 'delete_entry') {
      await query("UPDATE journal_entries SET status = 'posted' WHERE id = $1", [request.entity_id]);
    } else if (request.type === 'delete_receivable') {
      await query('UPDATE receivables SET pending_deletion = 0 WHERE id = $1', [request.entity_id]);
    } else if (request.type === 'delete_payable') {
      await query('UPDATE payables SET pending_deletion = 0 WHERE id = $1', [request.entity_id]);
    } else if (request.type === 'create_receivable') {
      await query('DELETE FROM receivables WHERE id = $1', [request.entity_id]);
    } else if (request.type === 'create_payable') {
      await query('DELETE FROM payables WHERE id = $1', [request.entity_id]);
    } else if (request.type === 'create_inventory') {
      await query('DELETE FROM inventory_items WHERE id = $1', [request.entity_id]);
    } else if (request.type === 'delete_inventory') {
      await query('UPDATE inventory_items SET pending_deletion = 0 WHERE id = $1', [request.entity_id]);
    }

    await query(
      `UPDATE approval_requests
       SET status = 'rejected', reviewed_by_email = $1, reviewed_by_name = $2,
           reviewer_note = $3, reviewed_at = NOW()
       WHERE id = $4`,
      [user.email, user.name || user.email, note.trim(), request.id]
    );

    const entityType = request.type.includes('entry') ? 'journal_entry' : request.type.replace(/^(create|delete)_/, '');
    logAction(user, `REJECT_${request.type.toUpperCase()}`, entityType,
      request.entity_id, request.entity_ref, { note: note.trim(), request_id: request.id });

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
