const express = require('express');
const router  = express.Router();
const { query, withTransaction } = require('../db/database');
const { logAction } = require('../utils/auditLog');

// ── Tiered tax calculation ────────────────────────────────────────────────────
function calcTiered(amount, tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) return 0;
  let tax = 0;
  const sorted = [...tiers].sort((a, b) => (parseFloat(a.min) || 0) - (parseFloat(b.min) || 0));
  for (const tier of sorted) {
    const min = parseFloat(tier.min) || 0;
    const max = tier.max != null && tier.max !== '' ? parseFloat(tier.max) : Infinity;
    const rate = parseFloat(tier.rate) || 0;
    if (amount <= min) break;
    const taxable = Math.min(amount, max) - min;
    tax += taxable * rate / 100;
  }
  return tax;
}

// ── Apply tax rate to a base amount ──────────────────────────────────────────
function computeTax(taxRate, baseAmount) {
  const base    = parseFloat(baseAmount) || 0;
  const exempt  = parseFloat(taxRate.exempt_threshold) || 0;
  const taxable = Math.max(0, base - exempt);
  let   tax     = 0;

  if (taxRate.type === 'percentage') {
    const rate = parseFloat(taxRate.rate) || 0;
    tax = taxRate.is_inclusive
      ? taxable * rate / (100 + rate)
      : taxable * rate / 100;
  } else if (taxRate.type === 'fixed_amount') {
    tax = taxable > 0 ? (parseFloat(taxRate.amount) || 0) : 0;
  } else if (taxRate.type === 'tiered') {
    const tiers = typeof taxRate.tiers === 'string' ? JSON.parse(taxRate.tiers) : (taxRate.tiers || []);
    tax = calcTiered(taxable, tiers);
  }
  return Math.round(tax * 100) / 100;
}

// ── GET /api/tax/rates ────────────────────────────────────────────────────────
router.get('/rates', async (req, res) => {
  // Filter by tax system so Philippines rates never appear for Generic clients and vice versa.
  // In standalone mode (no UAM session), show all rates.
  const taxSystem = req.session?.tax_system || null;
  const systemClause = taxSystem
    ? `WHERE (tr.tax_system_filter = 'all' OR tr.tax_system_filter = '${taxSystem}')`
    : '';
  try {
    const { rows } = await query(`
      SELECT tr.*, a.name AS tax_account_name, a.code AS tax_account_code
      FROM tax_rates tr
      LEFT JOIN accounts a ON a.id = tr.tax_account_id
      ${systemClause}
      ORDER BY tr.is_active DESC, tr.name
    `);
    res.json(rows.map(r => ({
      ...r,
      rate:             parseFloat(r.rate)             || 0,
      amount:           parseFloat(r.amount)           || 0,
      exempt_threshold: parseFloat(r.exempt_threshold) || 0,
      tiers: r.tiers
        ? (typeof r.tiers === 'string' ? JSON.parse(r.tiers) : r.tiers)
        : [],
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/tax/rates ───────────────────────────────────────────────────────
router.post('/rates', async (req, res) => {
  const user = req.session.user;
  const {
    name, code, type, rate, amount, tiers,
    applies_to, is_inclusive, exempt_threshold,
    tax_account_id, effective_from, effective_to,
    filing_frequency, description, business_type_filter, tax_system_filter,
  } = req.body;

  if (!name || !code || !type)
    return res.status(400).json({ error: 'Name, code, and type are required' });
  if (!['percentage', 'fixed_amount', 'tiered'].includes(type))
    return res.status(400).json({ error: 'Invalid type' });
  if (type === 'tiered' && (!Array.isArray(tiers) || tiers.length === 0))
    return res.status(400).json({ error: 'At least one tier is required for tiered type' });

  // Default new rates to the current client's tax system so they stay scoped correctly
  const sessionTaxSystem = req.session?.tax_system || 'all';

  try {
    const { rows: [tax] } = await query(
      `INSERT INTO tax_rates
         (name, code, type, rate, amount, tiers, applies_to, is_inclusive, exempt_threshold,
          tax_account_id, effective_from, effective_to, filing_frequency, description,
          business_type_filter, tax_system_filter)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        name.trim(), code.trim().toUpperCase(), type,
        parseFloat(rate) || 0, parseFloat(amount) || 0,
        tiers ? JSON.stringify(tiers) : null,
        applies_to || 'both',
        is_inclusive ? 1 : 0,
        parseFloat(exempt_threshold) || 0,
        tax_account_id || null,
        effective_from || null, effective_to || null,
        filing_frequency || 'monthly',
        description || null,
        business_type_filter || 'all',
        tax_system_filter || sessionTaxSystem,
      ]
    );
    logAction(user, 'CREATE_TAX_RATE', 'tax_rate', tax.id, tax.code);
    res.json({ ...tax, tiers: tax.tiers ? (typeof tax.tiers === 'string' ? JSON.parse(tax.tiers) : tax.tiers) : [] });
  } catch (e) {
    res.status(e.code === '23505' ? 400 : 500).json({
      error: e.code === '23505' ? `Tax code "${code.toUpperCase()}" already exists` : e.message,
    });
  }
});

// ── PUT /api/tax/rates/:id ────────────────────────────────────────────────────
router.put('/rates/:id', async (req, res) => {
  const user = req.session.user;
  const {
    name, type, rate, amount, tiers, applies_to, is_inclusive,
    exempt_threshold, tax_account_id, effective_from, effective_to,
    filing_frequency, description, is_active, business_type_filter, tax_system_filter,
  } = req.body;

  try {
    const { rows: [tax] } = await query(
      `UPDATE tax_rates SET
         name=$1, type=$2, rate=$3, amount=$4, tiers=$5, applies_to=$6,
         is_inclusive=$7, exempt_threshold=$8, tax_account_id=$9,
         effective_from=$10, effective_to=$11, filing_frequency=$12,
         description=$13, is_active=$14, business_type_filter=$15,
         tax_system_filter=$16
       WHERE id=$17 RETURNING *`,
      [
        name, type, parseFloat(rate) || 0, parseFloat(amount) || 0,
        tiers ? JSON.stringify(tiers) : null,
        applies_to || 'both', is_inclusive ? 1 : 0,
        parseFloat(exempt_threshold) || 0, tax_account_id || null,
        effective_from || null, effective_to || null,
        filing_frequency || 'monthly', description || null,
        is_active === false || is_active === 0 ? 0 : 1,
        business_type_filter || 'all',
        tax_system_filter || req.session?.tax_system || 'all',
        req.params.id,
      ]
    );
    if (!tax) return res.status(404).json({ error: 'Tax rate not found' });
    logAction(user, 'UPDATE_TAX_RATE', 'tax_rate', tax.id, tax.code);
    res.json({ ...tax, tiers: tax.tiers ? (typeof tax.tiers === 'string' ? JSON.parse(tax.tiers) : tax.tiers) : [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/tax/rates/:id ─────────────────────────────────────────────────
router.delete('/rates/:id', async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [tax] } = await query('SELECT * FROM tax_rates WHERE id = $1', [req.params.id]);
    if (!tax) return res.status(404).json({ error: 'Tax rate not found' });
    const { rowCount } = await query('SELECT 1 FROM tax_applications WHERE tax_rate_id = $1 LIMIT 1', [req.params.id]);
    if (rowCount > 0)
      return res.status(400).json({ error: 'Cannot delete — this tax rate has existing applications. Deactivate it instead.' });
    await query('DELETE FROM tax_rates WHERE id = $1', [req.params.id]);
    logAction(user, 'DELETE_TAX_RATE', 'tax_rate', tax.id, tax.code);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/tax/rates/seed-philippines ─────────────────────────────────────
// Accepts { business_type: 'corporate' | 'sole_proprietorship' | 'mixed_income' }
router.post('/rates/seed-philippines', async (req, res) => {
  const user          = req.session.user;
  const business_type = req.body.business_type || 'corporate';

  // ── Rates common to all business types ────────────────────────────────────
  const common = [
    {
      name: 'Output VAT (Sales)',   code: 'VAT-OUT', type: 'percentage', rate: 12,
      applies_to: 'sales',     filing_frequency: 'monthly',  business_type_filter: 'all',
      description: 'Value Added Tax on sales/revenue — BIR Form 2550M / 2550Q',
    },
    {
      name: 'Input VAT (Purchases)', code: 'VAT-IN', type: 'percentage', rate: 12,
      applies_to: 'purchases', filing_frequency: 'monthly',  business_type_filter: 'all',
      description: 'VAT on purchases — creditable against Output VAT',
    },
    {
      name: 'Expanded Withholding Tax (10%)', code: 'EWT-10', type: 'percentage', rate: 10,
      applies_to: 'purchases', filing_frequency: 'monthly',  business_type_filter: 'all',
      description: 'BIR EWT on professional/service fees paid to suppliers — BIR Form 0619-E / 1601-EQ',
    },
    {
      name: 'Percentage Tax (Non-VAT)', code: 'PT-3', type: 'percentage', rate: 3,
      applies_to: 'sales',     filing_frequency: 'quarterly', business_type_filter: 'all',
      description: '3% Percentage Tax for non-VAT registered businesses — BIR Form 2551Q',
    },
  ];

  // ── Corporate-only: Corporate Income Tax ───────────────────────────────────
  const corporateOnly = [
    {
      name: 'Corporate Income Tax (25%)', code: 'CIT-25', type: 'percentage', rate: 25,
      applies_to: 'both', filing_frequency: 'quarterly', business_type_filter: 'corporate',
      description: '25% Corporate Income Tax for domestic corporations — BIR Form 1702Q',
    },
  ];

  // ── Sole Prop / Mixed Income: Graduated Personal Income Tax ───────────────
  // BIR graduated rates (TRAIN Law, effective 2023+)
  // Tier: { min, max (null = no cap), rate% }
  const pitTiers = [
    { min: 0,        max: 250000,   rate: 0  },  // tax-exempt
    { min: 250000,   max: 400000,   rate: 15 },  // + 15% of excess over 250k
    { min: 400000,   max: 800000,   rate: 20 },  // + 20% of excess over 400k
    { min: 800000,   max: 2000000,  rate: 25 },  // + 25% of excess over 800k
    { min: 2000000,  max: 8000000,  rate: 30 },  // + 30% of excess over 2M
    { min: 8000000,  max: null,     rate: 35 },  // + 35% of excess over 8M
  ];
  const mixedDesc = business_type === 'mixed_income'
    ? 'Graduated PIT on business/professional income for mixed-income earners — compensation income is withheld separately by employer — BIR Form 1701Q'
    : 'Graduated Personal Income Tax on net business income (TRAIN Law, 2023+) — BIR Form 1701Q';

  const individualOnly = [
    {
      name: 'Personal Income Tax (Graduated)', code: 'PIT-GRAD', type: 'tiered',
      applies_to: 'both', filing_frequency: 'annual', business_type_filter: 'individual',
      tiers: pitTiers,
      description: mixedDesc,
    },
  ];

  const presets = business_type === 'corporate'
    ? [...common, ...corporateOnly]
    : [...common, ...individualOnly];

  try {
    const inserted = [], updated = [], skipped = [];
    for (const p of presets) {
      try {
        // Try insert first; if code exists, update only the business_type_filter
        const result = await query(
          `INSERT INTO tax_rates (name, code, type, rate, amount, tiers, applies_to, filing_frequency, description, business_type_filter, tax_system_filter)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (code) DO UPDATE SET
             business_type_filter = EXCLUDED.business_type_filter,
             tax_system_filter    = EXCLUDED.tax_system_filter
           RETURNING (xmax = 0) AS is_insert`,
          [
            p.name, p.code, p.type,
            p.rate   || 0,
            p.amount || 0,
            p.tiers ? JSON.stringify(p.tiers) : null,
            p.applies_to, p.filing_frequency, p.description,
            p.business_type_filter || 'all',
            'philippines',
          ]
        );
        if (result.rows[0]?.is_insert) inserted.push(p.code);
        else updated.push(p.code);
      } catch (e) {
        skipped.push(p.code);
        if (e.code !== '23505') throw e;
      }
    }
    logAction(user, 'SEED_PH_TAX_RATES', 'tax_rate', null, null, { inserted, updated, business_type });
    res.json({ ok: true, inserted: inserted.length, updated: updated.length, skipped: skipped.length, codes: inserted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/tax/applications ─────────────────────────────────────────────────
router.get('/applications', async (req, res) => {
  const { entity_type, entity_id } = req.query;
  try {
    const conditions = [];
    const params     = [];
    let   idx        = 1;
    if (entity_type) { conditions.push(`ta.entity_type = $${idx++}`); params.push(entity_type); }
    if (entity_id)   { conditions.push(`ta.entity_id   = $${idx++}`); params.push(parseInt(entity_id)); }

    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await query(`
      SELECT ta.*, tr.name AS tax_name, tr.code AS tax_code, tr.type AS tax_type,
             tr.rate AS tax_rate, tr.applies_to, tr.filing_frequency
      FROM tax_applications ta
      JOIN tax_rates tr ON tr.id = ta.tax_rate_id
      ${where}
      ORDER BY ta.created_at DESC
    `, params);
    res.json(rows.map(r => ({
      ...r,
      base_amount: parseFloat(r.base_amount) || 0,
      tax_amount:  parseFloat(r.tax_amount)  || 0,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/tax/applications ────────────────────────────────────────────────
router.post('/applications', async (req, res) => {
  const user = req.session.user;
  const { tax_rate_id, entity_type, entity_id, base_amount, notes } = req.body;

  if (!tax_rate_id || !entity_type || !entity_id || base_amount === undefined)
    return res.status(400).json({ error: 'tax_rate_id, entity_type, entity_id, and base_amount are required' });
  if (!['receivable', 'payable'].includes(entity_type))
    return res.status(400).json({ error: 'entity_type must be "receivable" or "payable"' });

  try {
    const { rows: [taxRate] } = await query(
      'SELECT * FROM tax_rates WHERE id = $1 AND is_active = 1', [tax_rate_id]
    );
    if (!taxRate) return res.status(404).json({ error: 'Tax rate not found or inactive' });

    const taxAmount = computeTax(taxRate, base_amount);
    const base      = parseFloat(base_amount) || 0;

    const { rows: [app] } = await query(
      `INSERT INTO tax_applications (tax_rate_id, entity_type, entity_id, base_amount, tax_amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tax_rate_id, entity_type, parseInt(entity_id), base, taxAmount, notes || null]
    );
    logAction(user, 'APPLY_TAX', 'tax_application', app.id, taxRate.code, {
      entity_type, entity_id, base_amount: base, tax_amount: taxAmount,
    });
    res.json({
      ...app,
      base_amount: parseFloat(app.base_amount) || 0,
      tax_amount:  parseFloat(app.tax_amount)  || 0,
      tax_name:    taxRate.name,
      tax_code:    taxRate.code,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/tax/applications/:id/journal-entry ──────────────────────────────
router.post('/applications/:id/journal-entry', async (req, res) => {
  const user = req.session.user;
  const { date, reference, debit_account_id, credit_account_id } = req.body;

  if (!debit_account_id || !credit_account_id)
    return res.status(400).json({ error: 'debit_account_id and credit_account_id are required' });

  try {
    const { rows: [app] } = await query(`
      SELECT ta.*, tr.name AS tax_name, tr.code AS tax_code, tr.applies_to
      FROM tax_applications ta
      JOIN tax_rates tr ON tr.id = ta.tax_rate_id
      WHERE ta.id = $1
    `, [req.params.id]);
    if (!app) return res.status(404).json({ error: 'Tax application not found' });
    if (app.journal_entry_id)
      return res.status(400).json({ error: 'A journal entry has already been recorded for this tax application' });

    // Build description from entity
    let entityDesc = `${app.entity_type} #${app.entity_id}`;
    if (app.entity_type === 'receivable') {
      const { rows: [rec] } = await query('SELECT customer_name, invoice_number FROM receivables WHERE id = $1', [app.entity_id]);
      if (rec) entityDesc = `${rec.customer_name} — ${rec.invoice_number}`;
    } else {
      const { rows: [pay] } = await query('SELECT supplier_name, reference_number FROM payables WHERE id = $1', [app.entity_id]);
      if (pay) entityDesc = `${pay.supplier_name}${pay.reference_number ? ' — ' + pay.reference_number : ''}`;
    }

    const taxAmount  = parseFloat(app.tax_amount);
    const entryDate  = date || new Date().toISOString().split('T')[0];
    const entryRef   = reference || `TAX-${app.tax_code}-${Date.now()}`;
    const entryDesc  = `${app.tax_name} — ${entityDesc}`;

    await withTransaction(async (client) => {
      const { rows: [entry] } = await client.query(
        `INSERT INTO journal_entries
           (date, reference, description, status, currency, exchange_rate, entry_type,
            created_by_email, created_by_name, created_by_role)
         VALUES ($1,$2,$3,'posted','USD',1.0,'tax',$4,$5,$6) RETURNING id`,
        [entryDate, entryRef, entryDesc, user.email, user.name || user.email, user.role]
      );
      await client.query(
        'INSERT INTO journal_lines (entry_id, account_id, debit, credit, base_debit, base_credit) VALUES ($1,$2,$3,0,$3,0)',
        [entry.id, parseInt(debit_account_id), taxAmount]
      );
      await client.query(
        'INSERT INTO journal_lines (entry_id, account_id, debit, credit, base_debit, base_credit) VALUES ($1,$2,0,$3,0,$3)',
        [entry.id, parseInt(credit_account_id), taxAmount]
      );
      await client.query(
        'UPDATE tax_applications SET journal_entry_id = $1 WHERE id = $2',
        [entry.id, app.id]
      );
    });

    logAction(user, 'RECORD_TAX_JOURNAL_ENTRY', 'tax_application', app.id, app.tax_code);
    res.json({ ok: true });
  } catch (e) {
    res.status(e.code === '23505' ? 400 : 500).json({
      error: e.code === '23505' ? `Reference "${reference}" already exists in journal entries` : e.message,
    });
  }
});

// ── DELETE /api/tax/applications/:id ─────────────────────────────────────────
router.delete('/applications/:id', async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [app] } = await query('SELECT * FROM tax_applications WHERE id = $1', [req.params.id]);
    if (!app) return res.status(404).json({ error: 'Tax application not found' });
    if (app.journal_entry_id)
      return res.status(400).json({ error: 'Cannot remove — a journal entry has been recorded for this tax. Void the journal entry first.' });
    await query('DELETE FROM tax_applications WHERE id = $1', [req.params.id]);
    logAction(user, 'REMOVE_TAX_APPLICATION', 'tax_application', app.id, null);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/tax/projections ──────────────────────────────────────────────────
router.get('/projections', async (req, res) => {
  const { year, period_type = 'monthly' } = req.query;
  const targetYear = parseInt(year) || new Date().getFullYear();

  try {
    const taxSystem = req.session?.tax_system || null;
    const projSystemClause = taxSystem
      ? `AND (tax_system_filter = 'all' OR tax_system_filter = '${taxSystem}')`
      : '';
    const { rows: taxRates } = await query(
      `SELECT * FROM tax_rates WHERE is_active = 1 ${projSystemClause} ORDER BY name`
    );

    const { rows: receivables } = await query(
      `SELECT amount, exchange_rate, created_at
       FROM receivables
       WHERE EXTRACT(YEAR FROM created_at) = $1 AND pending_approval = 0`,
      [targetYear]
    );

    const { rows: payables } = await query(
      `SELECT amount, exchange_rate, created_at
       FROM payables
       WHERE EXTRACT(YEAR FROM created_at) = $1 AND pending_approval = 0`,
      [targetYear]
    );

    // Build period keys
    const periodKeys = [];
    if (period_type === 'monthly') {
      for (let m = 1; m <= 12; m++)
        periodKeys.push(`${targetYear}-${String(m).padStart(2, '0')}`);
    } else if (period_type === 'quarterly') {
      ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => periodKeys.push(`${targetYear}-${q}`));
    } else {
      periodKeys.push(`${targetYear}`);
    }

    const getPeriodKey = (dateVal) => {
      const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
      const m = d.getMonth() + 1;
      if (period_type === 'monthly')   return `${targetYear}-${String(m).padStart(2, '0')}`;
      if (period_type === 'quarterly') return `${targetYear}-Q${Math.ceil(m / 3)}`;
      return `${targetYear}`;
    };

    const getPeriodLabel = (key) => {
      if (period_type === 'monthly') {
        const [y, m] = key.split('-');
        return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      if (period_type === 'quarterly') return key.replace('-', ' ');
      return key;
    };

    // Aggregate by period
    const salesByPeriod     = Object.fromEntries(periodKeys.map(k => [k, 0]));
    const purchasesByPeriod = Object.fromEntries(periodKeys.map(k => [k, 0]));

    for (const r of receivables) {
      const key = getPeriodKey(r.created_at);
      if (salesByPeriod[key] !== undefined)
        salesByPeriod[key] += (parseFloat(r.amount) || 0) / (parseFloat(r.exchange_rate) || 1);
    }
    for (const p of payables) {
      const key = getPeriodKey(p.created_at);
      if (purchasesByPeriod[key] !== undefined)
        purchasesByPeriod[key] += (parseFloat(p.amount) || 0) / (parseFloat(p.exchange_rate) || 1);
    }

    // Calculate per period
    const periods = periodKeys.map(key => {
      const salesBase     = Math.round(salesByPeriod[key] * 100) / 100;
      const purchasesBase = Math.round(purchasesByPeriod[key] * 100) / 100;

      const tax_breakdown = taxRates.map(tr => {
        const base = tr.applies_to === 'sales'
          ? salesBase
          : tr.applies_to === 'purchases'
          ? purchasesBase
          : salesBase + purchasesBase;
        const tax_amount = computeTax(tr, base);
        return {
          tax_rate_id: tr.id,
          tax_name:    tr.name,
          tax_code:    tr.code,
          tax_type:    tr.type,
          rate:        parseFloat(tr.rate) || 0,
          applies_to:  tr.applies_to,
          base_amount: Math.round(base * 100) / 100,
          tax_amount,
        };
      });

      const total_tax = Math.round(tax_breakdown.reduce((s, t) => s + t.tax_amount, 0) * 100) / 100;
      return { period_key: key, period_label: getPeriodLabel(key), sales_base: salesBase, purchases_base: purchasesBase, tax_breakdown, total_tax };
    });

    const grand_total = Math.round(periods.reduce((s, p) => s + p.total_tax, 0) * 100) / 100;
    res.json({ year: targetYear, period_type, periods, grand_total, tax_rates: taxRates.map(t => ({ id: t.id, name: t.name, code: t.code })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/tax/filings ──────────────────────────────────────────────────────
router.get('/filings', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT tf.*, tr.name AS tax_name, tr.code AS tax_code
      FROM tax_filings tf
      LEFT JOIN tax_rates tr ON tr.id = tf.tax_rate_id
      ORDER BY tf.period_start DESC, tf.created_at DESC
    `);
    res.json(rows.map(r => ({ ...r, total_tax_amount: parseFloat(r.total_tax_amount) || 0 })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/tax/filings ─────────────────────────────────────────────────────
router.post('/filings', async (req, res) => {
  const user = req.session.user;
  const { tax_rate_id, period_type, period_start, period_end, total_tax_amount, reference, notes } = req.body;
  if (!period_type || !period_start || !period_end)
    return res.status(400).json({ error: 'period_type, period_start, and period_end are required' });
  try {
    const { rows: [filing] } = await query(
      `INSERT INTO tax_filings
         (tax_rate_id, period_type, period_start, period_end, total_tax_amount, reference, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tax_rate_id || null, period_type, period_start, period_end,
       parseFloat(total_tax_amount) || 0, reference || null, notes || null]
    );
    logAction(user, 'CREATE_TAX_FILING', 'tax_filing', filing.id, null);
    res.json({ ...filing, total_tax_amount: parseFloat(filing.total_tax_amount) || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/tax/filings/:id ──────────────────────────────────────────────────
router.put('/filings/:id', async (req, res) => {
  const user = req.session.user;
  const { status, notes, reference, total_tax_amount } = req.body;
  try {
    const { rows: [cur] } = await query('SELECT * FROM tax_filings WHERE id = $1', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Filing not found' });

    const newStatus = status || cur.status;
    const filedAt   = newStatus === 'filed' && !cur.filed_at ? new Date().toISOString() : cur.filed_at;
    const paidAt    = newStatus === 'paid'  && !cur.paid_at  ? new Date().toISOString() : cur.paid_at;

    const { rows: [filing] } = await query(
      `UPDATE tax_filings
         SET status=$1, filed_at=$2, paid_at=$3, notes=$4, reference=$5, total_tax_amount=$6
       WHERE id=$7 RETURNING *`,
      [newStatus, filedAt, paidAt,
       notes !== undefined ? notes : cur.notes,
       reference !== undefined ? reference : cur.reference,
       total_tax_amount !== undefined ? parseFloat(total_tax_amount) : cur.total_tax_amount,
       req.params.id]
    );
    logAction(user, 'UPDATE_TAX_FILING', 'tax_filing', filing.id, null, { status: newStatus });
    res.json({ ...filing, total_tax_amount: parseFloat(filing.total_tax_amount) || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/tax/filings/:id ───────────────────────────────────────────────
router.delete('/filings/:id', async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [filing] } = await query('SELECT * FROM tax_filings WHERE id = $1', [req.params.id]);
    if (!filing) return res.status(404).json({ error: 'Filing not found' });
    await query('DELETE FROM tax_filings WHERE id = $1', [req.params.id]);
    logAction(user, 'DELETE_TAX_FILING', 'tax_filing', filing.id, null);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
