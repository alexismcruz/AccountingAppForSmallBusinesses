const express = require('express');
const router = express.Router();
const { query } = require('../db/database');

// Symbol lookup — used when UAM overrides the currency so the frontend gets the right symbol
const CURRENCY_SYMBOLS = {
  PHP:'₱', USD:'$',  EUR:'€',  GBP:'£',  JPY:'¥',  AUD:'A$', CAD:'C$', CHF:'Fr',
  CNY:'¥', HKD:'HK$',SGD:'S$', NZD:'NZ$',SEK:'kr', NOK:'kr', DKK:'kr', KRW:'₩',
  INR:'₹', MYR:'RM', IDR:'Rp', THB:'฿',  VND:'₫',  TWD:'NT$',AED:'د.إ',SAR:'﷼',
  QAR:'﷼', KWD:'KD', BHD:'BD', OMR:'﷼',  JOD:'JD', ILS:'₪',  TRY:'₺',  RUB:'₽',
  UAH:'₴', PLN:'zł', CZK:'Kč', HUF:'Ft', RON:'lei',BGN:'лв', ZAR:'R',  NGN:'₦',
  KES:'KSh',GHS:'GH₵',EGP:'E£',MAD:'MAD',BRL:'R$', MXN:'MX$',COP:'$',  CLP:'$',
  ARS:'$',  PEN:'S/', PKR:'₨',  BDT:'৳',  LKR:'₨',  KZT:'₸',  GEL:'₾',  MOP:'P',
};

router.get('/', async (req, res) => {
  try {
    const { rows: [settings] } = await query('SELECT * FROM business_settings WHERE id = 1');
    // UAM values always take precedence over local settings
    const tax_system    = req.session?.tax_system    || settings?.tax_system    || 'generic';
    const business_type = req.session?.business_type || settings?.business_type || 'corporate';
    const currency      = req.session?.base_currency || settings?.currency      || 'PHP';
    const currency_symbol = CURRENCY_SYMBOLS[currency] || settings?.currency_symbol || '₱';
    res.json({ ...settings, tax_system, business_type, currency, currency_symbol, sandboxMode: !!process.env.SANDBOX_MODE });
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
