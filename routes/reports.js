const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

function getBalances(db, toDate = null, fromDate = null, excludeClosing = false) {
  let sql = `
    SELECT
      a.id, a.code, a.name, a.type, a.normal_balance, a.description,
      COALESCE(SUM(COALESCE(jl.base_debit,  jl.debit)),  0) AS total_debits,
      COALESCE(SUM(COALESCE(jl.base_credit, jl.credit)), 0) AS total_credits
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id AND je.status = 'posted'
  `;
  const params = [];
  const conditions = [];
  if (fromDate)       { conditions.push('je.date >= ?');              params.push(fromDate); }
  if (toDate)         { conditions.push('je.date <= ?');              params.push(toDate); }
  if (excludeClosing) { conditions.push("je.entry_type != 'closing'"); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' GROUP BY a.id ORDER BY a.code';

  return db.prepare(sql).all(...params).map(row => ({
    ...row,
    balance: row.normal_balance === 'Debit'
      ? row.total_debits - row.total_credits
      : row.total_credits - row.total_debits,
  }));
}

// Dashboard summary
router.get('/dashboard', (req, res) => {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  const balances = getBalances(db, today);

  const byCode = {};
  for (const b of balances) byCode[b.code] = b.balance;

  const totalAssets = balances
    .filter(b => b.type === 'Asset' && b.normal_balance === 'Debit')
    .reduce((s, b) => s + Math.max(0, b.balance), 0);

  const arBalance = db.prepare(
    "SELECT COALESCE(SUM(amount - paid_amount), 0) as v FROM receivables WHERE status != 'paid'"
  ).get().v;
  const apBalance = db.prepare(
    "SELECT COALESCE(SUM(amount - paid_amount), 0) as v FROM payables WHERE status != 'paid'"
  ).get().v;
  const overdueAR = db.prepare(
    "SELECT COUNT(*) as c FROM receivables WHERE status != 'paid' AND due_date < ?"
  ).get(today).c;
  const overdueAP = db.prepare(
    "SELECT COUNT(*) as c FROM payables WHERE status != 'paid' AND due_date < ?"
  ).get(today).c;
  const lowStock = db.prepare(
    'SELECT COUNT(*) as c FROM inventory_items WHERE is_active = 1 AND quantity <= reorder_point'
  ).get().c;

  const recentEntries = db.prepare(`
    SELECT je.*, COALESCE(SUM(jl.debit), 0) as total_amount
    FROM journal_entries je
    LEFT JOIN journal_lines jl ON je.id = jl.entry_id
    GROUP BY je.id ORDER BY je.date DESC, je.id DESC LIMIT 5
  `).all();

  res.json({
    totalAssets,
    cashBalance: (byCode['1000'] || 0) + (byCode['1010'] || 0) + (byCode['1020'] || 0),
    arBalance,
    apBalance,
    overdueAR,
    overdueAP,
    lowStock,
    recentEntries,
  });
});

// Balance Sheet
router.get('/balance-sheet', (req, res) => {
  const db = getDB();
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const balances = getBalances(db, date);

  const assets = balances.filter(b => b.type === 'Asset');
  const liabilities = balances.filter(b => b.type === 'Liability');
  const equityAccounts = balances.filter(b => b.type === 'Equity');
  const revenue = balances.filter(b => b.type === 'Revenue');
  const cogs = balances.filter(b => b.type === 'COGS');
  const expenses = balances.filter(b => b.type === 'Expense');

  const totalRevenue = revenue.reduce((s, b) => s + b.balance, 0);
  const totalCOGS = cogs.reduce((s, b) => s + b.balance, 0);
  const totalExpenses = expenses.reduce((s, b) => s + b.balance, 0);
  const netIncome = totalRevenue - totalCOGS - totalExpenses;

  const currentAssets = assets.filter(b =>
    ['1000','1010','1020','1100','1200','1300','1400'].includes(b.code)
  );
  const fixedAssets = assets.filter(b =>
    !['1000','1010','1020','1100','1200','1300','1400'].includes(b.code)
  );
  const totalCurrentAssets = currentAssets.reduce((s, b) => s + b.balance, 0);
  const totalFixedAssets = fixedAssets.reduce((s, b) => s + b.balance, 0);
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  const currentLiabilities = liabilities.filter(b =>
    ['2000','2100','2200','2300','2400'].includes(b.code)
  );
  const longTermLiabilities = liabilities.filter(b => !['2000','2100','2200','2300','2400'].includes(b.code));
  const totalCurrentLiabilities = currentLiabilities.reduce((s, b) => s + b.balance, 0);
  const totalLongTermLiabilities = longTermLiabilities.reduce((s, b) => s + b.balance, 0);
  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

  // Equity: capital - drawings + retained earnings + net income
  const equityItems = equityAccounts.map(b => ({
    ...b,
    displayBalance: b.code === '3100' ? -b.balance : b.balance,
  }));
  const totalEquity = equityItems.reduce((s, b) => s + b.displayBalance, 0) + netIncome;

  res.json({
    date,
    assets: { currentAssets, fixedAssets, totalCurrentAssets, totalFixedAssets, totalAssets },
    liabilities: { currentLiabilities, longTermLiabilities, totalCurrentLiabilities, totalLongTermLiabilities, totalLiabilities },
    equity: { items: equityItems, netIncome, totalEquity },
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  });
});

// Income Statement
router.get('/income-statement', (req, res) => {
  const db = getDB();
  const to = req.query.to || new Date().toISOString().split('T')[0];
  const from = req.query.from || (to.substring(0, 4) + '-01-01');
  const balances = getBalances(db, to, from, true); // excludeClosing=true

  const revenue = balances.filter(b => b.type === 'Revenue');
  const cogs = balances.filter(b => b.type === 'COGS');
  const expenses = balances.filter(b => b.type === 'Expense');

  const totalRevenue = revenue.reduce((s, b) => s + b.balance, 0);
  const totalCOGS = cogs.reduce((s, b) => s + b.balance, 0);
  const grossProfit = totalRevenue - totalCOGS;
  const totalExpenses = expenses.reduce((s, b) => s + b.balance, 0);
  const netIncome = grossProfit - totalExpenses;

  res.json({ period: { from, to }, revenue, totalRevenue, cogs, totalCOGS, grossProfit, expenses, totalExpenses, netIncome });
});

// Trial Balance
router.get('/trial-balance', (req, res) => {
  const db = getDB();
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const balances = getBalances(db, date);
  const withBalances = balances.filter(b => b.total_debits > 0 || b.total_credits > 0);

  const totalDebit = withBalances
    .filter(b => b.normal_balance === 'Debit' && b.balance > 0)
    .reduce((s, b) => s + b.balance, 0);
  const totalCredit = withBalances
    .filter(b => b.normal_balance === 'Credit' && b.balance > 0)
    .reduce((s, b) => s + b.balance, 0);

  // Also need contra-accounts on the opposite side
  const trialRows = withBalances.map(b => ({
    ...b,
    debit_balance: b.normal_balance === 'Debit' && b.balance > 0 ? b.balance : 0,
    credit_balance: b.normal_balance === 'Credit' && b.balance > 0 ? b.balance : 0,
  }));

  const sumDebit = trialRows.reduce((s, r) => s + r.debit_balance, 0);
  const sumCredit = trialRows.reduce((s, r) => s + r.credit_balance, 0);

  res.json({ date, rows: trialRows, totalDebit: sumDebit, totalCredit: sumCredit, balanced: Math.abs(sumDebit - sumCredit) < 0.01 });
});

// General Ledger for a specific account
router.get('/ledger', (req, res) => {
  const db = getDB();
  const { accountId, from, to } = req.query;
  if (!accountId) return res.status(400).json({ error: 'accountId is required' });

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  let sql = `
    SELECT jl.*, je.date, je.reference, je.description as entry_description
    FROM journal_lines jl
    JOIN journal_entries je ON jl.entry_id = je.id
    WHERE jl.account_id = ? AND je.status = 'posted'
  `;
  const params = [accountId];
  if (from) { sql += ' AND je.date >= ?'; params.push(from); }
  if (to)   { sql += ' AND je.date <= ?'; params.push(to); }
  sql += ' ORDER BY je.date ASC, je.id ASC';

  const lines = db.prepare(sql).all(...params);
  let runningBalance = 0;
  const rows = lines.map(line => {
    const net = line.debit - line.credit;
    runningBalance += account.normal_balance === 'Debit' ? net : -net;
    return { ...line, running_balance: runningBalance };
  });

  res.json({ account, rows });
});

// Next available reference
router.get('/next-reference', (req, res) => {
  const db = getDB();
  const last = db.prepare(
    "SELECT reference FROM journal_entries WHERE reference LIKE 'JE-%' ORDER BY id DESC LIMIT 1"
  ).get();
  if (!last) return res.json({ reference: 'JE-0001' });
  const num = parseInt(last.reference.replace('JE-', ''), 10) + 1;
  res.json({ reference: `JE-${String(num).padStart(4, '0')}` });
});

module.exports = router;
