const express = require('express');
const router = express.Router();
const { query } = require('../db/database');

router.get('/', async (req, res) => {
  try {
    const { rows: [settings] } = await query('SELECT * FROM business_settings WHERE id = 1');
    res.json({ ...settings, sandboxMode: !!process.env.SANDBOX_MODE });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', async (req, res) => {
  const { business_name, registration_number, address, tax_id, currency, currency_symbol, fiscal_year_start } = req.body;
  try {
    await query(`
      UPDATE business_settings
      SET business_name=$1, registration_number=$2, address=$3, tax_id=$4,
          currency=$5, currency_symbol=$6, fiscal_year_start=$7, updated_at=NOW()
      WHERE id=1
    `, [business_name, registration_number, address, tax_id, currency, currency_symbol, fiscal_year_start]);
    const { rows: [settings] } = await query('SELECT * FROM business_settings WHERE id = 1');
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
