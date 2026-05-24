const express = require('express');
const router  = express.Router();
const { getDB } = require('../db/database');
const { seedSandboxData } = require('../db/sandboxSeed');

// Only available when SANDBOX_MODE=true
function sandboxOnly(req, res, next) {
  if (!process.env.SANDBOX_MODE) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

// Super admin only
function superAdminOnly(req, res, next) {
  if (req.session.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

// ── POST /api/sandbox/reset ───────────────────────────────────────────────────
router.post('/reset', sandboxOnly, superAdminOnly, (req, res) => {
  try {
    const db = getDB();
    seedSandboxData(db);
    res.json({ ok: true, message: 'Sandbox has been reset to default demo data.' });
  } catch (err) {
    console.error('Sandbox reset error:', err.message);
    res.status(500).json({ error: 'Reset failed: ' + err.message });
  }
});

module.exports = router;
