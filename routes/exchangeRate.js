const express = require('express');
const router = express.Router();

// Proxy to frankfurter.app (ECB data) — free, no API key required
// Uses Node 22 built-in fetch to handle gzip/encoding automatically
router.get('/', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
  if (from === to) return res.json({ rate: 1, from, to, date: new Date().toISOString().split('T')[0], source: 'local' });

  const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'CuentaIQ/1.0' },
    });
    const json = await response.json();

    if (json.rates && json.rates[to] !== undefined) {
      res.json({ rate: json.rates[to], from, to, date: json.date, source: 'ECB via frankfurter.app' });
    } else if (json.message) {
      res.status(422).json({ error: `${json.message} — please enter rate manually.` });
    } else {
      res.status(404).json({ error: `No rate found for ${from}→${to}. Please enter manually.` });
    }
  } catch (e) {
    res.status(503).json({ error: 'Could not reach exchange rate service. Please enter the rate manually.' });
  }
});

module.exports = router;
