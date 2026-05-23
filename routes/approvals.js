const express = require('express');
const router  = express.Router();
const { getDB, runTransaction } = require('../db/database');
const { logAction } = require('../utils/auditLog');

// ── Who can approve whose submissions ────────────────────────────────────────
// Staff    → can be approved by Manager or Finance
// Manager  → can be approved by Finance only
// Finance  → can be approved by another Finance user (not themselves)
// Nobody   → can approve their own request
// Admin    → view-only, cannot approve
function canApprove(approverRole, approverEmail, submitterRole, submitterEmail) {
  if (!approverRole || !submitterRole)     return false;
  if (approverEmail === submitterEmail)     return false;  // no self-approval
  if (approverRole === 'staff')             return false;
  if (approverRole === 'admin')             return false;
  if (approverRole === 'super_admin')       return true;   // super admin approves all
  if (approverRole === 'manager')           return submitterRole === 'staff';
  if (approverRole === 'finance')           return ['staff', 'manager', 'finance'].includes(submitterRole);
  return false;
}

// ── GET /api/approvals/pending-count ─────────────────────────────────────────
router.get('/pending-count', (req, res) => {
  const db   = getDB();
  const user = req.session.user;
  const all  = db.prepare("SELECT submitted_by_email, submitted_by_role FROM approval_requests WHERE status = 'pending'").all();
  const count = all.filter(r => canApprove(user.role, user.email, r.submitted_by_role, r.submitted_by_email)).length;
  res.json({ count });
});

// ── GET /api/approvals ────────────────────────────────────────────────────────
// Returns requests visible to the current user.
// - Finance/Admin/Super Admin see all requests
// - Manager/Staff see only requests they submitted + those they can approve
router.get('/', (req, res) => {
  const db     = getDB();
  const user   = req.session.user;
  const status = req.query.status || 'pending'; // pending | approved | rejected | all

  let sql    = 'SELECT * FROM approval_requests';
  const params = [];
  if (status !== 'all') { sql += ' WHERE status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';

  let rows = db.prepare(sql).all(...params);

  // Attach canApprove flag so the frontend knows which rows to show actions for
  rows = rows.map(r => ({
    ...r,
    can_approve: canApprove(user.role, user.email, r.submitted_by_role, r.submitted_by_email)
      && r.status === 'pending',
  }));

  // Staff and Manager only see their own submissions + rows they can approve
  if (user.role === 'staff' || user.role === 'manager') {
    rows = rows.filter(r => r.submitted_by_email === user.email || r.can_approve);
  }

  res.json(rows);
});

// ── GET /api/approvals/:id ────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const db  = getDB();
  const row = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Request not found' });
  const user = req.session.user;
  res.json({
    ...row,
    can_approve: canApprove(user.role, user.email, row.submitted_by_role, row.submitted_by_email)
      && row.status === 'pending',
  });
});

// ── POST /api/approvals/:id/approve ──────────────────────────────────────────
router.post('/:id/approve', (req, res) => {
  const db   = getDB();
  const user = req.session.user;
  const { note } = req.body;
  if (!note || !note.trim()) return res.status(400).json({ error: 'An approval note is required' });

  const request = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(req.params.id);
  if (!request)                    return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'This request has already been reviewed' });
  if (!canApprove(user.role, user.email, request.submitted_by_role, request.submitted_by_email)) {
    return res.status(403).json({ error: 'You do not have permission to approve this request' });
  }

  try {
    runTransaction((db) => {
      // Execute the approved action
      if (request.type === 'create_entry') {
        db.prepare("UPDATE journal_entries SET status = 'posted' WHERE id = ?").run(request.entity_id);
      } else if (request.type === 'delete_entry') {
        db.prepare("DELETE FROM journal_entries WHERE id = ?").run(request.entity_id);
      } else if (request.type === 'delete_receivable') {
        db.prepare('DELETE FROM receivables WHERE id = ?').run(request.entity_id);
      } else if (request.type === 'delete_payable') {
        db.prepare('DELETE FROM payables WHERE id = ?').run(request.entity_id);
      }

      // Mark request as approved
      db.prepare(`
        UPDATE approval_requests
        SET status = 'approved', reviewed_by_email = ?, reviewed_by_name = ?,
            reviewer_note = ?, reviewed_at = datetime('now')
        WHERE id = ?
      `).run(user.email, user.name || user.email, note.trim(), request.id);
    });

    logAction(user, `APPROVE_${request.type.toUpperCase()}`, request.type.includes('entry') ? 'journal_entry' : request.type.replace('delete_', ''),
      request.entity_id, request.entity_ref, { note: note.trim(), request_id: request.id });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/approvals/:id/reject ────────────────────────────────────────────
router.post('/:id/reject', (req, res) => {
  const db   = getDB();
  const user = req.session.user;
  const { note } = req.body;
  if (!note || !note.trim()) return res.status(400).json({ error: 'A rejection reason is required' });

  const request = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(req.params.id);
  if (!request)                    return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'This request has already been reviewed' });
  if (!canApprove(user.role, user.email, request.submitted_by_role, request.submitted_by_email)) {
    return res.status(403).json({ error: 'You do not have permission to reject this request' });
  }

  // Revert entity state on rejection
  if (request.type === 'create_entry') {
    db.prepare("UPDATE journal_entries SET status = 'rejected' WHERE id = ?").run(request.entity_id);
  } else if (request.type === 'delete_entry') {
    db.prepare("UPDATE journal_entries SET status = 'posted' WHERE id = ?").run(request.entity_id);
  } else if (request.type === 'delete_receivable') {
    db.prepare('UPDATE receivables SET pending_deletion = 0 WHERE id = ?').run(request.entity_id);
  } else if (request.type === 'delete_payable') {
    db.prepare('UPDATE payables SET pending_deletion = 0 WHERE id = ?').run(request.entity_id);
  }

  db.prepare(`
    UPDATE approval_requests
    SET status = 'rejected', reviewed_by_email = ?, reviewed_by_name = ?,
        reviewer_note = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `).run(user.email, user.name || user.email, note.trim(), request.id);

  logAction(user, `REJECT_${request.type.toUpperCase()}`, request.type.includes('entry') ? 'journal_entry' : request.type.replace('delete_', ''),
    request.entity_id, request.entity_ref, { note: note.trim(), request_id: request.id });

  res.json({ ok: true });
});

module.exports = router;
