const express = require('express');
const router  = express.Router();
const { query, withTransaction } = require('../db/database');
const { logAction } = require('../utils/auditLog');

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Return today's date as YYYY-MM-DD (server local time) */
function today() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Advance a YYYY-MM-DD string by one period.
 * For monthly/quarterly/annually, preserves the day-of-month clamped to the
 * last valid day of the target month.
 */
function advanceDate(dateStr, frequency) {
  const d = new Date(dateStr + 'T00:00:00');
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'annually':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().split('T')[0];
}

/** Add `days` to a YYYY-MM-DD string */
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Finance-level guard ───────────────────────────────────────────────────────
function requireFinance(req, res, next) {
  const LEVEL = { staff: 1, manager: 2, finance: 3, admin: 4, super_admin: 5 };
  const role  = req.session.user?.role || 'staff';
  if ((LEVEL[role] || 0) < 3)
    return res.status(403).json({ error: 'Finance role or above required' });
  next();
}

// ── GET /api/recurring-invoices ───────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM recurring_invoices ORDER BY is_active DESC, next_run_date ASC, id DESC'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/recurring-invoices ──────────────────────────────────────────────
router.post('/', requireFinance, async (req, res) => {
  const user = req.session.user;
  const {
    customer_name, description, amount, currency, exchange_rate,
    frequency, due_days, invoice_prefix,
    start_date, end_date, day_of_month, notes,
  } = req.body;

  if (!customer_name) return res.status(400).json({ error: 'customer_name is required' });
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
    return res.status(400).json({ error: 'amount must be a positive number' });
  if (!frequency || !['weekly','monthly','quarterly','annually'].includes(frequency))
    return res.status(400).json({ error: 'frequency must be weekly, monthly, quarterly, or annually' });
  if (!start_date) return res.status(400).json({ error: 'start_date is required' });

  try {
    const { rows: [rec] } = await query(
      `INSERT INTO recurring_invoices
         (customer_name, description, amount, currency, exchange_rate,
          frequency, due_days, invoice_prefix,
          start_date, end_date, next_run_date, day_of_month, notes,
          created_by_email, created_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        customer_name, description || '', parseFloat(amount),
        currency || 'PHP', parseFloat(exchange_rate) || 1.0,
        frequency, parseInt(due_days) || 30, invoice_prefix || 'REC',
        start_date, end_date || null, start_date,
        day_of_month ? parseInt(day_of_month) : null,
        notes || null, user?.email, user?.name,
      ]
    );
    logAction(user, 'CREATE_RECURRING_INVOICE', 'recurring_invoice', rec.id, customer_name);
    res.json(rec);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/recurring-invoices/:id ──────────────────────────────────────────
router.put('/:id', requireFinance, async (req, res) => {
  const user = req.session.user;
  const {
    customer_name, description, amount, currency, exchange_rate,
    frequency, due_days, invoice_prefix,
    start_date, end_date, day_of_month, notes, is_active,
  } = req.body;

  if (!customer_name) return res.status(400).json({ error: 'customer_name is required' });
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
    return res.status(400).json({ error: 'amount must be a positive number' });

  try {
    const { rows: [rec] } = await query(
      `UPDATE recurring_invoices SET
         customer_name  = $1, description    = $2, amount         = $3,
         currency       = $4, exchange_rate  = $5, frequency      = $6,
         due_days       = $7, invoice_prefix = $8, start_date     = $9,
         end_date       = $10, day_of_month  = $11, notes         = $12,
         is_active      = $13, updated_at    = NOW()
       WHERE id = $14 RETURNING *`,
      [
        customer_name, description || '', parseFloat(amount),
        currency || 'PHP', parseFloat(exchange_rate) || 1.0,
        frequency, parseInt(due_days) || 30, invoice_prefix || 'REC',
        start_date, end_date || null,
        day_of_month ? parseInt(day_of_month) : null,
        notes || null, is_active !== undefined ? is_active : true,
        req.params.id,
      ]
    );
    if (!rec) return res.status(404).json({ error: 'Not found' });
    logAction(user, 'UPDATE_RECURRING_INVOICE', 'recurring_invoice', rec.id, rec.customer_name);
    res.json(rec);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/recurring-invoices/:id/toggle ───────────────────────────────────
router.post('/:id/toggle', requireFinance, async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [rec] } = await query(
      'UPDATE recurring_invoices SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!rec) return res.status(404).json({ error: 'Not found' });
    logAction(user, rec.is_active ? 'ACTIVATE_RECURRING_INVOICE' : 'PAUSE_RECURRING_INVOICE',
      'recurring_invoice', rec.id, rec.customer_name);
    res.json(rec);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/recurring-invoices/:id ───────────────────────────────────────
router.delete('/:id', requireFinance, async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [rec] } = await query(
      'DELETE FROM recurring_invoices WHERE id = $1 RETURNING *', [req.params.id]
    );
    if (!rec) return res.status(404).json({ error: 'Not found' });
    logAction(user, 'DELETE_RECURRING_INVOICE', 'recurring_invoice', rec.id, rec.customer_name);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/recurring-invoices/run ─────────────────────────────────────────
// Finds all active templates whose next_run_date <= today and generates invoices.
// Safe to call multiple times (idempotent for a given day).
router.post('/run', requireFinance, async (req, res) => {
  const user = req.session.user;
  const t = today();
  const generated = [], errors = [];

  try {
    const { rows: due } = await query(
      `SELECT * FROM recurring_invoices
       WHERE is_active = true AND next_run_date <= $1
       ORDER BY next_run_date ASC`,
      [t]
    );

    for (const tmpl of due) {
      // Loop in case multiple periods are overdue (e.g., was paused for 2 months)
      let runDate = tmpl.next_run_date;

      while (runDate <= t) {
        const dueDate    = addDays(runDate, tmpl.due_days || 30);
        const invoiceNum = `${tmpl.invoice_prefix || 'REC'}-${tmpl.id}-${runDate.replace(/-/g, '')}`;
        const nextDate   = advanceDate(runDate, tmpl.frequency);
        const isLast     = tmpl.end_date && nextDate > tmpl.end_date;

        try {
          await withTransaction(async (client) => {
            // Create receivable
            await client.query(
              `INSERT INTO receivables
                 (customer_name, invoice_number, description, amount, currency, exchange_rate,
                  due_date, status, pending_approval, created_by_email, created_by_name, created_by_role)
               VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',0,$8,$9,$10)
               ON CONFLICT (invoice_number) DO NOTHING`,
              [
                tmpl.customer_name,
                invoiceNum,
                tmpl.description || `Recurring invoice — ${tmpl.frequency}`,
                tmpl.amount, tmpl.currency, tmpl.exchange_rate,
                dueDate,
                'system', 'Recurring Invoice', 'system',
              ]
            );

            // Advance schedule
            await client.query(
              `UPDATE recurring_invoices
               SET last_run_date = $1, next_run_date = $2,
                   run_count = run_count + 1,
                   is_active = $3, updated_at = NOW()
               WHERE id = $4`,
              [runDate, nextDate, !isLast, tmpl.id]
            );
          });

          generated.push({ template_id: tmpl.id, customer: tmpl.customer_name, invoice: invoiceNum, run_date: runDate });
          logAction(user || { email: 'system', name: 'System', role: 'system' },
            'GENERATE_RECURRING_INVOICE', 'receivable', null, invoiceNum);
        } catch (err) {
          errors.push({ template_id: tmpl.id, run_date: runDate, error: err.message });
        }

        // Check if we've now exhausted the schedule
        if (isLast) break;
        runDate = nextDate;
      }
    }

    res.json({ ok: true, generated: generated.length, errors: errors.length, details: generated, errorDetails: errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
