const express = require('express');
const router = express.Router();
const { query } = require('../db/database');

async function getBalances(toDate = null, fromDate = null, excludeClosing = false) {
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
  let idx = 1;
  if (fromDate)       { conditions.push(`je.date >= $${idx++}`);              params.push(fromDate); }
  if (toDate)         { conditions.push(`je.date <= $${idx++}`);              params.push(toDate); }
  if (excludeClosing) { conditions.push("je.entry_type != 'closing'"); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' GROUP BY a.id, a.code, a.name, a.type, a.normal_balance, a.description ORDER BY a.code';

  const { rows } = await query(sql, params);
  return rows.map(row => ({
    ...row,
    total_debits:  parseFloat(row.total_debits)  || 0,
    total_credits: parseFloat(row.total_credits) || 0,
    balance: row.normal_balance === 'Debit'
      ? (parseFloat(row.total_debits) || 0) - (parseFloat(row.total_credits) || 0)
      : (parseFloat(row.total_credits) || 0) - (parseFloat(row.total_debits) || 0),
  }));
}

// Dashboard summary
router.get('/dashboard', async (req, res) => {
  try {
    const today    = new Date().toISOString().split('T')[0];
    const balances = await getBalances(today);
    const byCode   = {};
    for (const b of balances) byCode[b.code] = b.balance;

    const totalAssets = balances
      .filter(b => b.type === 'Asset' && b.normal_balance === 'Debit')
      .reduce((s, b) => s + Math.max(0, b.balance), 0);

    const { rows: [arRow] }  = await query("SELECT COALESCE(SUM(amount - paid_amount), 0) as v FROM receivables WHERE status != 'paid'");
    const { rows: [apRow] }  = await query("SELECT COALESCE(SUM(amount - paid_amount), 0) as v FROM payables WHERE status != 'paid'");
    const { rows: [arOver] } = await query("SELECT COUNT(*) as c FROM receivables WHERE status != 'paid' AND due_date < $1", [today]);
    const { rows: [apOver] } = await query("SELECT COUNT(*) as c FROM payables WHERE status != 'paid' AND due_date < $1", [today]);
    const { rows: [lowSt] }  = await query('SELECT COUNT(*) as c FROM inventory_items WHERE is_active = 1 AND quantity <= reorder_point');

    const { rows: recentEntries } = await query(`
      SELECT je.*, COALESCE(SUM(jl.debit), 0) as total_amount
      FROM journal_entries je
      LEFT JOIN journal_lines jl ON je.id = jl.entry_id
      GROUP BY je.id ORDER BY je.date DESC, je.id DESC LIMIT 5
    `);

    res.json({
      totalAssets,
      cashBalance: (byCode['1000'] || 0) + (byCode['1010'] || 0) + (byCode['1020'] || 0),
      arBalance:   parseFloat(arRow.v) || 0,
      apBalance:   parseFloat(apRow.v) || 0,
      overdueAR:   parseInt(arOver.c) || 0,
      overdueAP:   parseInt(apOver.c) || 0,
      lowStock:    parseInt(lowSt.c)  || 0,
      recentEntries,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Balance Sheet
router.get('/balance-sheet', async (req, res) => {
  try {
    const date     = req.query.date || new Date().toISOString().split('T')[0];
    const balances = await getBalances(date);

    const assets         = balances.filter(b => b.type === 'Asset');
    const liabilities    = balances.filter(b => b.type === 'Liability');
    const equityAccounts = balances.filter(b => b.type === 'Equity');
    const revenue        = balances.filter(b => b.type === 'Revenue');
    const cogs           = balances.filter(b => b.type === 'COGS');
    const expenses       = balances.filter(b => b.type === 'Expense');

    const totalRevenue  = revenue.reduce((s, b) => s + b.balance, 0);
    const totalCOGS     = cogs.reduce((s, b) => s + b.balance, 0);
    const totalExpenses = expenses.reduce((s, b) => s + b.balance, 0);
    const netIncome     = totalRevenue - totalCOGS - totalExpenses;

    const currentAssets  = assets.filter(b => ['1000','1010','1020','1100','1200','1300','1400'].includes(b.code));
    const fixedAssets    = assets.filter(b => !['1000','1010','1020','1100','1200','1300','1400'].includes(b.code));
    const totalCurrentAssets = currentAssets.reduce((s, b) => s + b.balance, 0);
    const totalFixedAssets   = fixedAssets.reduce((s, b) => s + b.balance, 0);
    const totalAssets        = totalCurrentAssets + totalFixedAssets;

    const currentLiabilities  = liabilities.filter(b => ['2000','2100','2200','2300','2400'].includes(b.code));
    const longTermLiabilities = liabilities.filter(b => !['2000','2100','2200','2300','2400'].includes(b.code));
    const totalCurrentLiabilities  = currentLiabilities.reduce((s, b) => s + b.balance, 0);
    const totalLongTermLiabilities = longTermLiabilities.reduce((s, b) => s + b.balance, 0);
    const totalLiabilities         = totalCurrentLiabilities + totalLongTermLiabilities;

    const equityItems  = equityAccounts.map(b => ({ ...b, displayBalance: b.code === '3100' ? -b.balance : b.balance }));
    const totalEquity  = equityItems.reduce((s, b) => s + b.displayBalance, 0) + netIncome;

    res.json({
      date,
      assets:      { currentAssets, fixedAssets, totalCurrentAssets, totalFixedAssets, totalAssets },
      liabilities: { currentLiabilities, longTermLiabilities, totalCurrentLiabilities, totalLongTermLiabilities, totalLiabilities },
      equity:      { items: equityItems, netIncome, totalEquity },
      balanced:    Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Income Statement
router.get('/income-statement', async (req, res) => {
  try {
    const to   = req.query.to   || new Date().toISOString().split('T')[0];
    const from = req.query.from || (to.substring(0, 4) + '-01-01');
    const balances = await getBalances(to, from, true);

    const revenue  = balances.filter(b => b.type === 'Revenue');
    const cogs     = balances.filter(b => b.type === 'COGS');
    const expenses = balances.filter(b => b.type === 'Expense');

    const totalRevenue  = revenue.reduce((s, b) => s + b.balance, 0);
    const totalCOGS     = cogs.reduce((s, b) => s + b.balance, 0);
    const grossProfit   = totalRevenue - totalCOGS;
    const totalExpenses = expenses.reduce((s, b) => s + b.balance, 0);
    const netIncome     = grossProfit - totalExpenses;

    res.json({ period: { from, to }, revenue, totalRevenue, cogs, totalCOGS, grossProfit, expenses, totalExpenses, netIncome });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Trial Balance
router.get('/trial-balance', async (req, res) => {
  try {
    const date     = req.query.date || new Date().toISOString().split('T')[0];
    const balances = await getBalances(date);
    const withBal  = balances.filter(b => b.total_debits > 0 || b.total_credits > 0);

    const trialRows = withBal.map(b => ({
      ...b,
      debit_balance:  b.normal_balance === 'Debit'   && b.balance > 0 ? b.balance : 0,
      credit_balance: b.normal_balance === 'Credit'  && b.balance > 0 ? b.balance : 0,
    }));

    const sumDebit  = trialRows.reduce((s, r) => s + r.debit_balance, 0);
    const sumCredit = trialRows.reduce((s, r) => s + r.credit_balance, 0);

    res.json({ date, rows: trialRows, totalDebit: sumDebit, totalCredit: sumCredit, balanced: Math.abs(sumDebit - sumCredit) < 0.01 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// General Ledger
router.get('/ledger', async (req, res) => {
  try {
    const { accountId, from, to } = req.query;
    if (!accountId) return res.status(400).json({ error: 'accountId is required' });

    const { rows: [account] } = await query('SELECT * FROM accounts WHERE id = $1', [accountId]);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const params = [accountId];
    let idx = 2;
    let sql = `
      SELECT jl.*, je.date, je.reference, je.description as entry_description
      FROM journal_lines jl
      JOIN journal_entries je ON jl.entry_id = je.id
      WHERE jl.account_id = $1 AND je.status = 'posted'
    `;
    if (from) { sql += ` AND je.date >= $${idx++}`; params.push(from); }
    if (to)   { sql += ` AND je.date <= $${idx++}`; params.push(to); }
    sql += ' ORDER BY je.date ASC, je.id ASC';

    const { rows: lines } = await query(sql, params);
    let runningBalance = 0;
    const rows = lines.map(line => {
      const net = (parseFloat(line.debit) || 0) - (parseFloat(line.credit) || 0);
      runningBalance += account.normal_balance === 'Debit' ? net : -net;
      return { ...line, running_balance: runningBalance };
    });

    res.json({ account, rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Next available reference
router.get('/next-reference', async (req, res) => {
  try {
    const { rows: [last] } = await query(
      "SELECT reference FROM journal_entries WHERE reference LIKE 'JE-%' ORDER BY id DESC LIMIT 1"
    );
    if (!last) return res.json({ reference: 'JE-0001' });
    const num = parseInt(last.reference.replace('JE-', ''), 10) + 1;
    res.json({ reference: `JE-${String(num).padStart(4, '0')}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
