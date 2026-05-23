const express = require('express');
const router  = express.Router();
const { getDB } = require('../db/database');

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
router.get('/', (req, res) => {
  const db = getDB();
  const { from, to, search, limit = 500 } = req.query;

  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  if (from)   { sql += ' AND created_at >= ?'; params.push(from); }
  if (to)     { sql += ' AND created_at <= ?'; params.push(to + ' 23:59:59'); }
  if (search) {
    sql += ' AND (user_email LIKE ? OR user_name LIKE ? OR action LIKE ? OR entity_ref LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit) || 500);

  res.json(db.prepare(sql).all(...params));
});

// ── GET /api/logs/export/csv ──────────────────────────────────────────────────
router.get('/export/csv', (req, res) => {
  const db = getDB();
  const { from, to } = req.query;

  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  if (from) { sql += ' AND created_at >= ?'; params.push(from); }
  if (to)   { sql += ' AND created_at <= ?'; params.push(to + ' 23:59:59'); }
  sql += ' ORDER BY created_at DESC';

  const rows = db.prepare(sql).all(...params);
  const cols = ['created_at', 'user_name', 'user_email', 'user_role', 'action', 'entity_type', 'entity_ref', 'details'];
  const csv  = [cols.join(','), ...rows.map(r => cols.map(c => csvEsc(r[c])).join(','))].join('\n');

  const today = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${today}.csv"`);
  res.send(csv);
});

module.exports = router;
