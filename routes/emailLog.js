const router = require('express').Router();
const { query } = require('../db/database');

// Finance, Admin, Super Admin only (same gate as audit logs)
router.use((req, res, next) => {
  const role = req.session?.user?.role;
  if (!['finance', 'admin', 'super_admin'].includes(role))
    return res.status(403).json({ error: 'Access denied — Finance or Admin role required' });
  next();
});

// ── GET /api/email-log ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { status, search, limit = 200 } = req.query;
  const params = [];
  let idx = 1;
  let sql = 'SELECT * FROM email_log WHERE 1=1';

  if (status) { sql += ` AND status = $${idx++}`; params.push(status); }
  if (search) {
    sql += ` AND (to_email ILIKE $${idx} OR subject ILIKE $${idx + 1} OR template ILIKE $${idx + 2})`;
    const s = `%${search}%`;
    params.push(s, s, s);
    idx += 3;
  }
  sql += ` ORDER BY sent_at DESC LIMIT $${idx}`;
  params.push(Math.min(parseInt(limit) || 200, 1000));

  try {
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
