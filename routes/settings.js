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
    const vat_exempt               = req.session?.vat_exempt               ?? false;
    const has_state_tax            = req.session?.has_state_tax            ?? false;
    const state_tax_rate           = parseFloat(req.session?.state_tax_rate) || 0;
    const has_city_tax             = req.session?.has_city_tax             ?? false;
    const city_tax_rate            = parseFloat(req.session?.city_tax_rate) || 0;
    const default_filing_frequency = req.session?.default_filing_frequency  || 'monthly';

    // Parse enabled_modules — default to all on if column missing or null
    const ALL_MODULES = ['hr', 'inventory', 'payments', 'tax'];
    let enabled_modules = ALL_MODULES;
    try {
      if (settings?.enabled_modules) enabled_modules = JSON.parse(settings.enabled_modules);
    } catch (_) {}

    res.json({
      ...settings, tax_system, business_type, currency, currency_symbol,
      vat_exempt, has_state_tax, state_tax_rate, has_city_tax, city_tax_rate, default_filing_frequency,
      sandboxMode: !!process.env.SANDBOX_MODE,
      enabled_modules,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/settings/modules — super_admin only ──────────────────────────────
router.put('/modules', async (req, res) => {
  if (req.session?.user?.role !== 'super_admin')
    return res.status(403).json({ error: 'Forbidden — super_admin only' });
  const { enabled_modules } = req.body;
  if (!Array.isArray(enabled_modules))
    return res.status(400).json({ error: 'enabled_modules must be an array' });
  try {
    await query(
      `UPDATE business_settings SET enabled_modules=$1, updated_at=NOW() WHERE id=1`,
      [JSON.stringify(enabled_modules)]
    );
    res.json({ success: true, enabled_modules });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', async (req, res) => {
  const { business_name, registration_number, address, tax_id, business_email, currency, currency_symbol, fiscal_year_start } = req.body;
  try {
    await query(`
      UPDATE business_settings
      SET business_name=$1, registration_number=$2, address=$3, tax_id=$4,
          business_email=$5, currency=$6, currency_symbol=$7, fiscal_year_start=$8, updated_at=NOW()
      WHERE id=1
    `, [business_name, registration_number, address, tax_id, business_email || '', currency, currency_symbol, fiscal_year_start]);
    const { rows: [settings] } = await query('SELECT * FROM business_settings WHERE id = 1');
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
