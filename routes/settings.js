const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

router.get('/', (req, res) => {
  const db = getDB();
  res.json(db.prepare('SELECT * FROM business_settings WHERE id = 1').get());
});

router.put('/', (req, res) => {
  const db = getDB();
  const { business_name, registration_number, address, tax_id, currency, currency_symbol, fiscal_year_start } = req.body;
  db.prepare(`
    UPDATE business_settings
    SET business_name=?, registration_number=?, address=?, tax_id=?,
        currency=?, currency_symbol=?, fiscal_year_start=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=1
  `).run(business_name, registration_number, address, tax_id, currency, currency_symbol, fiscal_year_start);
  res.json(db.prepare('SELECT * FROM business_settings WHERE id = 1').get());
});

module.exports = router;
