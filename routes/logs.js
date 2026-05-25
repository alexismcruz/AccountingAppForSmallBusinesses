const express = require('express');
const router  = express.Router();
const { query } = require('../db/database');

function csvEsc(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Finance, Admin, Super Admin only
router.use((req, res, next) => {
  const role = req.session.user?.role;
  if (!['finance', 'admin', 'super_admin'].includes(role)) {
    return res.status(403).json({ error: 'Access denied — Finance or Admin role required' });
  }
  next();
});

// ── GET /api/logs ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { from, to, search, limit = 500 } = req.query;
  const params = [];
  let idx = 1;
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';

  if (from)   { sql += ` AND created_at >= $${idx++}`; params.push(from); }
  if (to)     { sql += ` AND created_at <= $${idx++}`; params.push(to + ' 23:59:59'); }
  if (search) {
    sql += ` AND (user_email ILIKE $${idx} OR user_name ILIKE $${idx+1} OR action ILIKE $${idx+2} OR entity_ref ILIKE $${idx+3})`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
    idx += 4;
  }
  sql += ` ORDER BY created_at DESC LIMIT $${idx}`;
  params.push(parseInt(limit) || 500);

  try {
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/logs/export/csv ──────────────────────────────────────────────────
router.get('/export/csv', async (req, res) => {
  const { from, to } = req.query;
  const params = [];
  let idx = 1;
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';

  if (from) { sql += ` AND created_at >= $${idx++}`; params.push(from); }
  if (to)   { sql += ` AND created_at <= $${idx++}`; params.push(to + ' 23:59:59'); }
  sql += ' ORDER BY created_at DESC';

  try {
    const { rows } = await query(sql, params);
    const cols = ['created_at', 'user_name', 'user_email', 'user_role', 'action', 'entity_type', 'entity_ref', 'details'];
    const csv  = [cols.join(','), ...rows.map(r => cols.map(c => csvEsc(r[c])).join(','))].join('\n');
    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${today}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
