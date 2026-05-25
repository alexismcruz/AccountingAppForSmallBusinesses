const express = require('express');
const router  = express.Router();
const { query, withTransaction } = require('../db/database');
const { logAction } = require('../utils/auditLog');

// GET /api/opening-balance
router.get('/', async (req, res) => {
  try {
    const { rows: accounts } = await query(
      `SELECT id, code, name, type, normal_balance
       FROM accounts WHERE is_active = 1 ORDER BY code`
    );

    const { rows: [entry] } = await query(
      `SELECT * FROM journal_entries WHERE entry_type = 'opening_balance' LIMIT 1`
    );

    let lines = [];
    if (entry) {
      const { rows } = await query(
        `SELECT account_id, debit, credit FROM journal_lines WHERE entry_id = $1`,
        [entry.id]
      );
      lines = rows;
    }

    res.json({ posted: !!entry, date: entry?.date || null, lines, accounts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/opening-balance
router.post('/', async (req, res) => {
  const user = req.session.user;
  if (!['finance', 'super_admin'].includes(user?.role))
    return res.status(403).json({ error: 'Finance role or above required to post opening balances' });

  const { date, lines } = req.body;
  if (!date) return res.status(400).json({ error: 'Cutover date is required' });
  if (!Array.isArray(lines) || lines.length === 0)
    return res.status(400).json({ error: 'At least one line is required' });

  const nonZero = lines.filter(l => (parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0);
  if (nonZero.length === 0)
    return res.status(400).json({ error: 'Please enter at least one non-zero balance' });

  const totalDebit  = nonZero.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = nonZero.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.005)
    return res.status(400).json({
      error: `Out of balance by ${Math.abs(totalDebit - totalCredit).toFixed(2)}. Total debits must equal total credits.`,
    });

  try {
    await withTransaction(async (client) => {
      const { rows: [existing] } = await client.query(
        `SELECT id FROM journal_entries WHERE entry_type = 'opening_balance' LIMIT 1`
      );
      if (existing) {
        await client.query('DELETE FROM journal_lines   WHERE entry_id = $1', [existing.id]);
        await client.query('DELETE FROM journal_entries WHERE id = $1',       [existing.id]);
      }

      const { rows: [entry] } = await client.query(
        `INSERT INTO journal_entries
           (date, reference, description, status, entry_type, created_by_email, created_by_name, created_by_role)
         VALUES ($1,'OPEN-BAL','Opening Balances','posted','opening_balance',$2,$3,$4)
         RETURNING id`,
        [date, user.email, user.name || user.email, user.role]
      );

      for (const l of nonZero) {
        const d = parseFloat(l.debit)  || 0;
        const c = parseFloat(l.credit) || 0;
        await client.query(
          `INSERT INTO journal_lines (entry_id, account_id, debit, credit, base_debit, base_credit)
           VALUES ($1,$2,$3,$4,$3,$4)`,
          [entry.id, parseInt(l.account_id), d, c]
        );
      }
    });

    logAction(user, 'POST_OPENING_BALANCE', 'journal_entry', null, 'OPEN-BAL', { date, lines: nonZero.length });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/opening-balance — clear so it can be re-entered
router.delete('/', async (req, res) => {
  const user = req.session.user;
  if (!['finance', 'super_admin'].includes(user?.role))
    return res.status(403).json({ error: 'Finance role or above required' });

  try {
    const { rows: [entry] } = await query(
      `SELECT id FROM journal_entries WHERE entry_type = 'opening_balance' LIMIT 1`
    );
    if (!entry) return res.status(404).json({ error: 'No opening balance entry found' });

    await query('DELETE FROM journal_lines   WHERE entry_id = $1', [entry.id]);
    await query('DELETE FROM journal_entries WHERE id = $1',       [entry.id]);

    logAction(user, 'VOID_OPENING_BALANCE', 'journal_entry', entry.id, 'OPEN-BAL');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
