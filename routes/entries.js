const express = require('express');
const router = express.Router();
const { getDB, runTransaction } = require('../db/database');

// Get all entries with optional search/date filter
router.get('/', (req, res) => {
  const db = getDB();
  const { from, to, search } = req.query;
  let sql = `
    SELECT je.*, COALESCE(SUM(jl.debit), 0) as total_amount
    FROM journal_entries je
    LEFT JOIN journal_lines jl ON je.id = jl.entry_id
    WHERE 1=1
  `;
  const params = [];
  if (from) { sql += ' AND je.date >= ?'; params.push(from); }
  if (to) { sql += ' AND je.date <= ?'; params.push(to); }
  if (search) {
    sql += ' AND (je.description LIKE ? OR je.reference LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' GROUP BY je.id ORDER BY je.date DESC, je.id DESC';
  res.json(db.prepare(sql).all(...params));
});

// Get single entry with lines
router.get('/:id', (req, res) => {
  const db = getDB();
  const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  entry.lines = db.prepare(`
    SELECT jl.*, a.code, a.name as account_name, a.type as account_type,
           a.normal_balance, a.description as account_description
    FROM journal_lines jl
    JOIN accounts a ON jl.account_id = a.id
    WHERE jl.entry_id = ?
    ORDER BY jl.id
  `).all(req.params.id);
  res.json(entry);
});

// Create new journal entry
router.post('/', (req, res) => {
  const db = getDB();
  const { date, reference, description, lines, currency, exchange_rate, entry_type } = req.body;

  if (!date || !reference || !description) {
    return res.status(400).json({ error: 'date, reference, and description are required' });
  }
  if (!lines || lines.length < 2) {
    return res.status(400).json({ error: 'At least 2 line items are required' });
  }

  const rate = parseFloat(exchange_rate) || 1.0;
  const cur  = currency || 'USD';

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    return res.status(400).json({ error: `Entry is not balanced. Debits: ${totalDebit.toFixed(2)}, Credits: ${totalCredit.toFixed(2)}` });
  }

  try {
    const entryId = runTransaction((db) => {
      const result = db.prepare(
        'INSERT INTO journal_entries (date, reference, description, status, currency, exchange_rate, entry_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(date, reference, description, 'posted', cur, rate, entry_type || 'regular');
      const id = result.lastInsertRowid;
      const lineStmt = db.prepare(
        'INSERT INTO journal_lines (entry_id, account_id, debit, credit, notes, base_debit, base_credit) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      for (const line of lines) {
        const debit  = parseFloat(line.debit)  || 0;
        const credit = parseFloat(line.credit) || 0;
        lineStmt.run(id, line.account_id, debit, credit, line.notes || null, debit / rate, credit / rate);
      }
      return id;
    });
    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(entryId);
    entry.lines = db.prepare(`
      SELECT jl.*, a.code, a.name as account_name
      FROM journal_lines jl JOIN accounts a ON jl.account_id = a.id
      WHERE jl.entry_id = ? ORDER BY jl.id
    `).all(entryId);
    res.json(entry);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      res.status(400).json({ error: `Reference number "${reference}" already exists` });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

// Delete entry
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM journal_entries WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
