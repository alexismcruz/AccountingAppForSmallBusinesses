const express = require('express');
const router = express.Router();
const { getDB, runTransaction } = require('../db/database');

// Returns all fiscal years that have been closed
router.get('/years', (req, res) => {
  const db = getDB();
  const rows = db.prepare(
    "SELECT DISTINCT substr(date, 1, 4) as year FROM journal_entries ORDER BY year DESC"
  ).all();
  const closed = db.prepare(
    "SELECT DISTINCT substr(date, 1, 4) as year FROM journal_entries WHERE entry_type = 'closing' ORDER BY year DESC"
  ).all().map(r => r.year);
  res.json({ years: rows.map(r => r.year), closedYears: closed });
});

// Preview what the year-end closing entry will look like
router.get('/preview-close', (req, res) => {
  const db = getDB();
  const year = req.query.year || new Date().getFullYear();
  const from = `${year}-01-01`;
  const to   = `${year}-12-31`;

  const rows = db.prepare(`
    SELECT a.id, a.code, a.name, a.type, a.normal_balance,
           COALESCE(SUM(COALESCE(jl.base_debit, jl.debit)), 0)   AS total_debits,
           COALESCE(SUM(COALESCE(jl.base_credit, jl.credit)), 0) AS total_credits
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id
      AND je.status = 'posted'
      AND je.entry_type != 'closing'
      AND je.date >= ? AND je.date <= ?
    WHERE a.type IN ('Revenue', 'COGS', 'Expense')
    GROUP BY a.id
    ORDER BY a.code
  `).all(from, to);

  const lines = [];
  let netIncome = 0;

  for (const row of rows) {
    const balance = row.normal_balance === 'Debit'
      ? row.total_debits - row.total_credits
      : row.total_credits - row.total_debits;

    if (Math.abs(balance) < 0.005) continue;

    if (row.type === 'Revenue') {
      // Dr. Revenue (to zero it out)
      lines.push({ account_id: row.id, code: row.code, name: row.name, type: row.type, debit: balance, credit: 0 });
      netIncome += balance;
    } else {
      // Cr. COGS / Expense (to zero them out)
      lines.push({ account_id: row.id, code: row.code, name: row.name, type: row.type, debit: 0, credit: balance });
      netIncome -= balance;
    }
  }

  // Retained Earnings balancing entry
  const reAccount = db.prepare("SELECT id, code, name FROM accounts WHERE code = '3200'").get();
  if (reAccount) {
    if (netIncome > 0) {
      lines.push({ account_id: reAccount.id, code: reAccount.code, name: reAccount.name, type: 'Equity', debit: 0, credit: netIncome });
    } else if (netIncome < 0) {
      lines.push({ account_id: reAccount.id, code: reAccount.code, name: reAccount.name, type: 'Equity', debit: Math.abs(netIncome), credit: 0 });
    }
  }

  res.json({ year, lines, netIncome });
});

// Execute year-end closing
router.post('/close-year', (req, res) => {
  const db = getDB();
  const { year } = req.body;
  if (!year) return res.status(400).json({ error: 'year is required' });

  // Check if already closed
  const already = db.prepare(
    "SELECT id FROM journal_entries WHERE entry_type = 'closing' AND date LIKE ?"
  ).get(`${year}%`);
  if (already) return res.status(400).json({ error: `Year ${year} has already been closed.` });

  const from = `${year}-01-01`;
  const to   = `${year}-12-31`;

  const rows = db.prepare(`
    SELECT a.id, a.code, a.name, a.type, a.normal_balance,
           COALESCE(SUM(COALESCE(jl.base_debit, jl.debit)), 0)   AS total_debits,
           COALESCE(SUM(COALESCE(jl.base_credit, jl.credit)), 0) AS total_credits
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id
      AND je.status = 'posted'
      AND je.entry_type != 'closing'
      AND je.date >= ? AND je.date <= ?
    WHERE a.type IN ('Revenue', 'COGS', 'Expense')
    GROUP BY a.id
    ORDER BY a.code
  `).all(from, to);

  const closingLines = [];
  let netIncome = 0;

  for (const row of rows) {
    const balance = row.normal_balance === 'Debit'
      ? row.total_debits - row.total_credits
      : row.total_credits - row.total_debits;

    if (Math.abs(balance) < 0.005) continue;

    if (row.type === 'Revenue') {
      closingLines.push({ account_id: row.id, debit: balance, credit: 0 });
      netIncome += balance;
    } else {
      closingLines.push({ account_id: row.id, debit: 0, credit: balance });
      netIncome -= balance;
    }
  }

  if (closingLines.length === 0) {
    return res.status(400).json({ error: 'No revenue or expense accounts have balances for this year. Nothing to close.' });
  }

  const reAccount = db.prepare("SELECT id FROM accounts WHERE code = '3200'").get();
  if (!reAccount) return res.status(500).json({ error: 'Retained Earnings account (3200) not found.' });

  if (Math.abs(netIncome) >= 0.005) {
    if (netIncome > 0) {
      closingLines.push({ account_id: reAccount.id, debit: 0, credit: netIncome });
    } else {
      closingLines.push({ account_id: reAccount.id, debit: Math.abs(netIncome), credit: 0 });
    }
  }

  try {
    const entryId = runTransaction((db) => {
      // Auto-generate a closing reference
      const last = db.prepare(
        "SELECT reference FROM journal_entries WHERE reference LIKE 'CE-%' ORDER BY id DESC LIMIT 1"
      ).get();
      const num = last ? parseInt(last.reference.replace('CE-', ''), 10) + 1 : 1;
      const reference = `CE-${String(num).padStart(4, '0')}`;

      const result = db.prepare(`
        INSERT INTO journal_entries (date, reference, description, status, entry_type)
        VALUES (?, ?, ?, 'posted', 'closing')
      `).run(`${year}-12-31`, reference, `Year-End Closing Entry — FY ${year}`);

      const id = result.lastInsertRowid;
      const lineStmt = db.prepare(
        'INSERT INTO journal_lines (entry_id, account_id, debit, credit, base_debit, base_credit) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const line of closingLines) {
        lineStmt.run(id, line.account_id, line.debit, line.credit, line.debit, line.credit);
      }
      return id;
    });

    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(entryId);
    res.json({ success: true, entry, netIncome });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get opening balances for a year (Balance Sheet accounts as of Dec 31 prior year)
router.get('/opening-balances', (req, res) => {
  const db = getDB();
  const year = req.query.year || new Date().getFullYear();
  const priorDec31 = `${parseInt(year) - 1}-12-31`;

  const rows = db.prepare(`
    SELECT a.id, a.code, a.name, a.type, a.normal_balance,
           COALESCE(SUM(COALESCE(jl.base_debit, jl.debit)), 0)   AS total_debits,
           COALESCE(SUM(COALESCE(jl.base_credit, jl.credit)), 0) AS total_credits
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id
      AND je.status = 'posted'
      AND je.date <= ?
    WHERE a.type IN ('Asset', 'Liability', 'Equity')
    GROUP BY a.id
    ORDER BY a.code
  `).all(priorDec31);

  const balances = rows.map(row => ({
    ...row,
    balance: row.normal_balance === 'Debit'
      ? row.total_debits - row.total_credits
      : row.total_credits - row.total_debits,
  })).filter(r => Math.abs(r.balance) >= 0.005);

  res.json({ year, priorDate: priorDec31, balances });
});

module.exports = router;
