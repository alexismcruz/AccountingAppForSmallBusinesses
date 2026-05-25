const express = require('express');
const router = express.Router();
const { query } = require('../db/database');

router.get('/', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM accounts WHERE is_active = 1 ORDER BY code');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM accounts WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Account not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { code, name, type, normal_balance, description } = req.body;
  if (!code || !name || !type || !normal_balance) {
    return res.status(400).json({ error: 'code, name, type, and normal_balance are required' });
  }
  try {
    const { rows: [inserted] } = await query(
      'INSERT INTO accounts (code, name, type, normal_balance, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [code, name, type, normal_balance, description || '']
    );
    res.json(inserted);
  } catch (e) {
    res.status(400).json({ error: e.code === '23505' ? 'Account code already exists' : e.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, description } = req.body;
  try {
    const { rows: [updated] } = await query(
      'UPDATE accounts SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, req.params.id]
    );
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await query('UPDATE accounts SET is_active = 0 WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
