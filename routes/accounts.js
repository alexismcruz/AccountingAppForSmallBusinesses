const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

router.get('/', (req, res) => {
  const db = getDB();
  const accounts = db.prepare(
    'SELECT * FROM accounts WHERE is_active = 1 ORDER BY code'
  ).all();
  res.json(accounts);
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json(account);
});

router.post('/', (req, res) => {
  const db = getDB();
  const { code, name, type, normal_balance, description } = req.body;
  if (!code || !name || !type || !normal_balance) {
    return res.status(400).json({ error: 'code, name, type, and normal_balance are required' });
  }
  try {
    const result = db.prepare(
      'INSERT INTO accounts (code, name, type, normal_balance, description) VALUES (?, ?, ?, ?, ?)'
    ).run(code, name, type, normal_balance, description || '');
    res.json(db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: 'Account code already exists' });
  }
});

router.put('/:id', (req, res) => {
  const db = getDB();
  const { name, description } = req.body;
  db.prepare(
    'UPDATE accounts SET name = ?, description = ? WHERE id = ?'
  ).run(name, description, req.params.id);
  res.json(db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('UPDATE accounts SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
