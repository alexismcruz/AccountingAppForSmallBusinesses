const router = require('express').Router();
const { query } = require('../db/database');
const { addSuppression, isValidEmail } = require('../utils/email');

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

// ── Suppression list ──────────────────────────────────────────────────────────

router.get('/suppressions', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM email_suppressions ORDER BY created_at DESC LIMIT 500');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/suppressions', async (req, res) => {
  const email = (req.body?.email || '').trim();
  if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
  try {
    await addSuppression(email, 'manual', `Added by ${req.session.user?.email || 'admin'}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Remove an address from the suppression list (re-enable sending to it)
router.delete('/suppressions/:id', async (req, res) => {
  try {
    const { rowCount } = await query('DELETE FROM email_suppressions WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
