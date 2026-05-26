const express     = require('express');
const router      = express.Router();
const PDFDocument = require('pdfkit');
const { query, withTransaction } = require('../db/database');
const { logAction }  = require('../utils/auditLog');
const { computeEntry } = require('../utils/payrollCompute');

const MAR   = 50;
const PW    = 612;
const RIGHT = PW - MAR;
const C = {
  blue: '#2563eb', dark: '#1e293b', gray: '#64748b',
  light: '#f1f5f9', border: '#e2e8f0', success: '#15803d',
};

const fmtDate = (d) => {
  if (!d) return '—';
  const s = d.includes('T') ? d.split('T')[0] : d;
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ── GET /api/payroll/periods ──────────────────────────────────────────────────
router.get('/periods', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT pp.*,
             COUNT(pe.id)::int   AS employee_count,
             SUM(pe.net_pay)     AS total_net_pay,
             SUM(pe.gross_pay)   AS total_gross_pay
      FROM payroll_periods pp
      LEFT JOIN payroll_entries pe ON pe.payroll_period_id = pp.id
      GROUP BY pp.id
      ORDER BY pp.period_start DESC
    `);
    res.json(rows.map(r => ({
      ...r,
      total_net_pay:   parseFloat(r.total_net_pay)   || 0,
      total_gross_pay: parseFloat(r.total_gross_pay) || 0,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/payroll/periods/:id ──────────────────────────────────────────────
router.get('/periods/:id', async (req, res) => {
  try {
    const { rows: [period] } = await query('SELECT * FROM payroll_periods WHERE id = $1', [req.params.id]);
    if (!period) return res.status(404).json({ error: 'Payroll period not found' });

    const { rows: entries } = await query(`
      SELECT pe.*, e.employee_number, e.first_name, e.last_name,
             e.position, e.department, e.pay_frequency, e.basic_salary
      FROM payroll_entries pe
      JOIN employees e ON e.id = pe.employee_id
      WHERE pe.payroll_period_id = $1
      ORDER BY e.last_name, e.first_name
    `, [req.params.id]);

    res.json({ ...period, entries: entries.map(numericEntry) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/payroll/periods — create & auto-compute ────────────────────────
router.post('/periods', async (req, res) => {
  const user = req.session.user;
  if (!['finance', 'super_admin'].includes(user?.role))
    return res.status(403).json({ error: 'Finance role or above required' });

  const { period_start, period_end, pay_date, pay_frequency, notes } = req.body;
  if (!period_start || !period_end || !pay_date)
    return res.status(400).json({ error: 'period_start, period_end, and pay_date are required' });

  try {
    const { rows: employees } = await query(
      `SELECT * FROM employees WHERE is_active = 1 ORDER BY last_name, first_name`
    );
    if (employees.length === 0)
      return res.status(400).json({ error: 'No active employees found. Add employees first.' });

    const freq = pay_frequency || 'semi_monthly';

    const period = await withTransaction(async (client) => {
      const { rows: [p] } = await client.query(
        `INSERT INTO payroll_periods (period_start, period_end, pay_date, pay_frequency, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [period_start, period_end, pay_date, freq, notes || null, user.email]
      );
      for (const emp of employees) {
        const c = computeEntry(emp, {}, freq);
        await client.query(
          `INSERT INTO payroll_entries
             (payroll_period_id, employee_id, basic_pay, overtime_pay, holiday_pay, allowances,
              gross_pay, sss_employee, sss_employer, sss_msc, philhealth_employee, philhealth_employer,
              pagibig_employee, pagibig_employer, wtax, other_deductions, total_deductions,
              net_pay, taxable_compensation)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
          [
            p.id, emp.id, c.basic_pay, 0, 0, 0,
            c.gross_pay, c.sss_employee, c.sss_employer, c.sss_msc,
            c.philhealth_employee, c.philhealth_employer,
            c.pagibig_employee, c.pagibig_employer,
            c.wtax, 0, c.total_deductions, c.net_pay, c.taxable_compensation,
          ]
        );
      }
      return p;
    });

    logAction(user, 'CREATE_PAYROLL_PERIOD', 'payroll_period', period.id, `${period_start}→${period_end}`);
    res.json(period);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/payroll/periods/:id/post — post + auto GL journal entry ──────────
router.put('/periods/:id/post', async (req, res) => {
  const user = req.session.user;
  if (!['finance', 'super_admin'].includes(user?.role))
    return res.status(403).json({ error: 'Finance role or above required' });

  try {
    const { rows: [period] } = await query('SELECT * FROM payroll_periods WHERE id = $1', [req.params.id]);
    if (!period)               return res.status(404).json({ error: 'Period not found' });
    if (period.status === 'posted') return res.status(400).json({ error: 'Period already posted' });

    const { rows: entries } = await query(
      'SELECT * FROM payroll_entries WHERE payroll_period_id = $1', [req.params.id]
    );

    // ── Aggregate totals across all entries ──────────────────────────────────
    const tot = entries.reduce((a, e) => {
      a.gross        += parseFloat(e.gross_pay)           || 0;
      a.sssEe        += parseFloat(e.sss_employee)        || 0;
      a.sssEr        += parseFloat(e.sss_employer)        || 0;
      a.phEe         += parseFloat(e.philhealth_employee) || 0;
      a.phEr         += parseFloat(e.philhealth_employer) || 0;
      a.piEe         += parseFloat(e.pagibig_employee)    || 0;
      a.piEr         += parseFloat(e.pagibig_employer)    || 0;
      a.wtax         += parseFloat(e.wtax)                || 0;
      a.otherDed     += parseFloat(e.other_deductions)    || 0;
      a.net          += parseFloat(e.net_pay)             || 0;
      return a;
    }, { gross:0, sssEe:0, sssEr:0, phEe:0, phEr:0, piEe:0, piEr:0, wtax:0, otherDed:0, net:0 });

    const round = (v) => Math.round(v * 100) / 100;

    // ── Resolve / auto-create payroll GL accounts ────────────────────────────
    const getOrCreate = async (client, code, name, type, nb, desc) => {
      const { rows } = await client.query('SELECT id FROM accounts WHERE code = $1', [code]);
      if (rows[0]) return rows[0].id;
      const { rows: [a] } = await client.query(
        `INSERT INTO accounts (code, name, type, normal_balance, description, created_by_email, created_by_name, created_by_role)
         VALUES ($1,$2,$3,$4,$5,'system','System','system') RETURNING id`,
        [code, name, type, nb, desc]
      );
      return a.id;
    };

    const p = await withTransaction(async (client) => {
      // Mark period posted
      const { rows: [posted] } = await client.query(
        `UPDATE payroll_periods SET status = 'posted' WHERE id = $1 RETURNING *`, [req.params.id]
      );

      const [salId, sssExpId, phExpId, piExpId, sssPayId, phPayId, piPayId, wtaxPayId, otherPayId, netPayId] =
        await Promise.all([
          getOrCreate(client, '6000', 'Salaries & Wages Expense',              'Expense',   'Debit',  'Regular salaries and wages paid to employees.'),
          getOrCreate(client, '6010', 'SSS - Employer Contribution',           'Expense',   'Debit',  'Employer share of SSS contributions.'),
          getOrCreate(client, '6020', 'PhilHealth - Employer Contribution',    'Expense',   'Debit',  'Employer share of PhilHealth premiums.'),
          getOrCreate(client, '6030', 'Pag-IBIG / HDMF - Employer Contribution','Expense',  'Debit',  'Employer share of Pag-IBIG contributions.'),
          getOrCreate(client, '2110', 'SSS Contributions Payable',             'Liability', 'Credit', 'SSS contributions due to SSS.'),
          getOrCreate(client, '2120', 'PhilHealth Contributions Payable',      'Liability', 'Credit', 'PhilHealth premiums due to PhilHealth.'),
          getOrCreate(client, '2130', 'Pag-IBIG / HDMF Contributions Payable','Liability', 'Credit', 'Pag-IBIG contributions due to HDMF.'),
          getOrCreate(client, '2140', 'Withholding Tax Payable - Compensation','Liability', 'Credit', 'BIR withholding tax on compensation.'),
          getOrCreate(client, '2150', 'Other Payroll Deductions Payable',      'Liability', 'Credit', 'Other deductions withheld from employees.'),
          getOrCreate(client, '2160', 'Net Wages Payable',                     'Liability', 'Credit', 'Net salaries accrued but not yet disbursed.'),
        ]);

      const ref = `PAY-${period.period_start}-${period.period_end}`.replace(/\s/g,'-');
      const { rows: [entry] } = await client.query(
        `INSERT INTO journal_entries
           (date, reference, description, status, currency, exchange_rate, entry_type,
            created_by_email, created_by_name, created_by_role)
         VALUES ($1,$2,$3,'posted','PHP',1,'payroll',$4,$5,$6) RETURNING id`,
        [period.pay_date || period.period_end, ref,
         `Payroll: ${fmtDate(period.period_start)} – ${fmtDate(period.period_end)} (${entries.length} employees)`,
         user.email, user.name || user.email, user.role]
      );
      const eid = entry.id;

      // ── Debit lines ───────────────────────────────────────────────────────
      const insertLine = (acId, dr, cr) => client.query(
        `INSERT INTO journal_lines (entry_id, account_id, debit, credit, base_debit, base_credit) VALUES ($1,$2,$3,$4,$3,$4)`,
        [eid, acId, round(dr), round(cr)]
      );

      await insertLine(salId,   tot.gross,  0);
      await insertLine(sssExpId, tot.sssEr, 0);
      await insertLine(phExpId,  tot.phEr,  0);
      await insertLine(piExpId,  tot.piEr,  0);

      // ── Credit lines ──────────────────────────────────────────────────────
      await insertLine(sssPayId,  0, round(tot.sssEe + tot.sssEr));
      await insertLine(phPayId,   0, round(tot.phEe  + tot.phEr));
      await insertLine(piPayId,   0, round(tot.piEe  + tot.piEr));
      await insertLine(wtaxPayId, 0, tot.wtax);
      if (round(tot.otherDed) > 0) await insertLine(otherPayId, 0, tot.otherDed);
      await insertLine(netPayId,  0, tot.net);

      // Store journal_entry_id on the period for reference
      await client.query(
        `ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS journal_entry_id INTEGER`
      );
      await client.query(
        `UPDATE payroll_periods SET journal_entry_id = $1 WHERE id = $2`,
        [eid, req.params.id]
      );

      return posted;
    });

    logAction(user, 'POST_PAYROLL_PERIOD', 'payroll_period', p.id, `${p.period_start}→${p.period_end}`);
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/payroll/periods/:id ──────────────────────────────────────────
router.delete('/periods/:id', async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [p] } = await query('SELECT * FROM payroll_periods WHERE id = $1', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Period not found' });
    if (p.status === 'posted') return res.status(400).json({ error: 'Cannot delete a posted payroll period' });
    await query('DELETE FROM payroll_periods WHERE id = $1', [req.params.id]);
    logAction(user, 'DELETE_PAYROLL_PERIOD', 'payroll_period', p.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/payroll/entries/:id — adjust OT, holiday, allowances ─────────────
router.put('/entries/:id', async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [entry] } = await query(`
      SELECT pe.*, e.basic_salary, e.pay_frequency,
             pp.pay_frequency AS period_frequency, pp.status
      FROM payroll_entries pe
      JOIN employees      e  ON e.id  = pe.employee_id
      JOIN payroll_periods pp ON pp.id = pe.payroll_period_id
      WHERE pe.id = $1
    `, [req.params.id]);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    if (entry.status === 'posted') return res.status(400).json({ error: 'Cannot edit a posted payroll entry' });

    const freq = entry.period_frequency || entry.pay_frequency || 'semi_monthly';
    const adj  = {
      overtime_pay:     req.body.overtime_pay,
      holiday_pay:      req.body.holiday_pay,
      allowances:       req.body.allowances,
      other_deductions: req.body.other_deductions,
    };
    const c = computeEntry(entry, adj, freq);

    const { rows: [updated] } = await query(
      `UPDATE payroll_entries SET
         overtime_pay=$1, holiday_pay=$2, allowances=$3, gross_pay=$4,
         sss_employee=$5, sss_employer=$6, sss_msc=$7,
         philhealth_employee=$8, philhealth_employer=$9,
         pagibig_employee=$10, pagibig_employer=$11,
         wtax=$12, other_deductions=$13, total_deductions=$14,
         net_pay=$15, taxable_compensation=$16, notes=$17
       WHERE id=$18 RETURNING *`,
      [
        c.overtime_pay, c.holiday_pay, c.allowances, c.gross_pay,
        c.sss_employee, c.sss_employer, c.sss_msc,
        c.philhealth_employee, c.philhealth_employer,
        c.pagibig_employee, c.pagibig_employer,
        c.wtax, c.other_deductions, c.total_deductions,
        c.net_pay, c.taxable_compensation,
        req.body.notes || entry.notes || null,
        req.params.id,
      ]
    );
    logAction(user, 'UPDATE_PAYROLL_ENTRY', 'payroll_entry', updated.id);
    res.json(numericEntry(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/payroll/entries/:id/payslip — PDF ────────────────────────────────
router.get('/entries/:id/payslip', async (req, res) => {
  try {
    const { rows: [entry] } = await query(`
      SELECT pe.*,
             e.employee_number, e.first_name, e.last_name, e.position,
             e.department, e.tin, e.sss_number, e.philhealth_number, e.pagibig_number,
             e.bank_name, e.bank_account,
             pp.period_start, pp.period_end, pp.pay_date, pp.pay_frequency AS period_frequency
      FROM payroll_entries pe
      JOIN employees       e  ON e.id  = pe.employee_id
      JOIN payroll_periods pp ON pp.id = pe.payroll_period_id
      WHERE pe.id = $1
    `, [req.params.id]);
    if (!entry) return res.status(404).json({ error: 'Payroll entry not found' });

    const { rows: [biz] } = await query('SELECT * FROM business_settings LIMIT 1');
    const bizData = biz || {};
    const sym  = bizData.currency_symbol || '₱';
    const fmt  = (v) => `${sym}${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const name = `${entry.first_name} ${entry.last_name}`;
    const filename = `Payslip-${entry.employee_number}-${entry.period_start}.pdf`.replace(/[^a-zA-Z0-9.\-_]/g, '-');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'LETTER', margin: MAR });
    doc.pipe(res);

    // ── Header ────────────────────────────────────────────────────────────────
    doc.fontSize(18).font('Helvetica-Bold').fillColor(C.dark)
       .text(bizData.business_name || 'My Business', MAR, 50);
    let by = 74;
    doc.fontSize(8.5).font('Helvetica').fillColor(C.gray);
    if (bizData.address) {
      bizData.address.split('\n').slice(0, 3).forEach(l => {
        if (l.trim()) { doc.text(l.trim(), MAR, by); by += 12; }
      });
    }
    if (bizData.tax_id) { doc.text(`TIN: ${bizData.tax_id}`, MAR, by); }

    doc.fontSize(22).font('Helvetica-Bold').fillColor(C.blue)
       .text('PAYSLIP', 340, 50, { width: RIGHT - 340, align: 'right' });
    const periodLabel = `${fmtDate(entry.period_start)} – ${fmtDate(entry.period_end)}`;
    doc.fontSize(9).font('Helvetica').fillColor(C.gray)
       .text(`Pay Period: ${periodLabel}`, 340, 78, { width: RIGHT - 340, align: 'right' });
    doc.text(`Pay Date: ${fmtDate(entry.pay_date)}`, 340, 91, { width: RIGHT - 340, align: 'right' });

    const divY = 120;
    doc.moveTo(MAR, divY).lineTo(RIGHT, divY).strokeColor(C.border).lineWidth(0.5).stroke();

    // ── Employee info ─────────────────────────────────────────────────────────
    let ey = divY + 12;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(C.gray).text('EMPLOYEE', MAR, ey, { characterSpacing: 1 });
    ey += 13;
    doc.fontSize(14).font('Helvetica-Bold').fillColor(C.dark).text(name, MAR, ey);
    ey += 18;
    doc.fontSize(8.5).font('Helvetica').fillColor(C.gray);
    const empDetails = [
      `${entry.position || 'N/A'}${entry.department ? '  ·  ' + entry.department : ''}`,
      `Employee No: ${entry.employee_number}`,
      ...(entry.tin ? [`TIN: ${entry.tin}`] : []),
    ];
    empDetails.forEach(d => { doc.text(d, MAR, ey); ey += 12; });

    // Right side: SSS/PhilHealth/Pag-IBIG numbers
    let ry = divY + 25;
    [[`SSS No.`, entry.sss_number], [`PhilHealth No.`, entry.philhealth_number], [`Pag-IBIG No.`, entry.pagibig_number]]
      .filter(([, v]) => v)
      .forEach(([l, v]) => {
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.gray).text(l, 380, ry, { width: 100 });
        doc.font('Helvetica').fillColor(C.dark).text(v, 480, ry, { width: RIGHT - 480 });
        ry += 13;
      });

    const tableY = Math.max(ey, ry) + 14;

    // ── Helper: draw a 2-column section table ─────────────────────────────────
    const drawSection = (title, rows, startY, headerColor) => {
      const colL = (RIGHT - MAR) * 0.62;
      doc.rect(MAR, startY, RIGHT - MAR, 20).fill(headerColor || C.blue);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff')
         .text(title, MAR + 8, startY + 6);
      let y = startY + 20;
      rows.forEach(([label, value], i) => {
        doc.rect(MAR, y, RIGHT - MAR, 18).fill(i % 2 === 0 ? C.light : '#fff');
        doc.fontSize(9).font('Helvetica').fillColor(C.dark)
           .text(label, MAR + 8, y + 5, { width: colL - 8 });
        doc.font('Helvetica-Bold').fillColor(C.dark)
           .text(value, MAR + 8, y + 5, { width: RIGHT - MAR - 16, align: 'right' });
        y += 18;
      });
      doc.rect(MAR, startY, RIGHT - MAR, y - startY).strokeColor(C.border).lineWidth(0.5).stroke();
      return y + 10;
    };

    // ── Earnings ──────────────────────────────────────────────────────────────
    const earningsRows = [
      ['Basic Pay', fmt(entry.basic_pay)],
      ...(parseFloat(entry.overtime_pay) > 0 ? [['Overtime Pay', fmt(entry.overtime_pay)]] : []),
      ...(parseFloat(entry.holiday_pay)  > 0 ? [['Holiday Pay',  fmt(entry.holiday_pay)]]  : []),
      ...(parseFloat(entry.allowances)   > 0 ? [['Allowances',   fmt(entry.allowances)]]   : []),
    ];
    let y = drawSection('EARNINGS', earningsRows, tableY, '#1d4ed8');

    // Gross pay highlight
    doc.rect(MAR, y - 4, RIGHT - MAR, 22).fill('#dbeafe');
    doc.fontSize(10).font('Helvetica-Bold').fillColor(C.dark).text('Gross Pay', MAR + 8, y + 2);
    doc.text(fmt(entry.gross_pay), MAR + 8, y + 2, { width: RIGHT - MAR - 16, align: 'right' });
    y += 28;

    // ── Deductions ────────────────────────────────────────────────────────────
    const msc = parseFloat(entry.sss_msc) || 0;
    const deductionRows = [
      [`SSS (MSC ${sym}${msc.toLocaleString()})`,    fmt(entry.sss_employee)],
      [`PhilHealth (2.5%)`,                           fmt(entry.philhealth_employee)],
      [`Pag-IBIG`,                                    fmt(entry.pagibig_employee)],
      [`Withholding Tax`,                             fmt(entry.wtax)],
      ...(parseFloat(entry.other_deductions) > 0 ? [['Other Deductions', fmt(entry.other_deductions)]] : []),
    ];
    y = drawSection('DEDUCTIONS', deductionRows, y, '#dc2626');

    // Total deductions
    doc.rect(MAR, y - 4, RIGHT - MAR, 22).fill('#fee2e2');
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#dc2626').text('Total Deductions', MAR + 8, y + 2);
    doc.text(fmt(entry.total_deductions), MAR + 8, y + 2, { width: RIGHT - MAR - 16, align: 'right' });
    y += 30;

    // ── Net Pay ───────────────────────────────────────────────────────────────
    doc.rect(MAR, y, RIGHT - MAR, 34).fill(C.blue);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#fff').text('NET PAY', MAR + 12, y + 10);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#fff')
       .text(fmt(entry.net_pay), MAR + 12, y + 8, { width: RIGHT - MAR - 24, align: 'right' });
    y += 46;

    // ── Employer contributions (informational) ────────────────────────────────
    y = drawSection("EMPLOYER'S CONTRIBUTIONS (for reference)", [
      [`SSS (Employer)`,        fmt(entry.sss_employer)],
      [`PhilHealth (Employer)`, fmt(entry.philhealth_employer)],
      [`Pag-IBIG (Employer)`,   fmt(entry.pagibig_employer)],
    ], y, C.gray);

    // ── Footer ────────────────────────────────────────────────────────────────
    if (entry.bank_name || entry.bank_account) {
      doc.fontSize(8).font('Helvetica').fillColor(C.gray)
         .text(`Bank: ${entry.bank_name || ''} – Acct: ${entry.bank_account || ''}`, MAR, y, { width: RIGHT - MAR, align: 'center' });
      y += 14;
    }
    doc.moveTo(MAR, y).lineTo(RIGHT, y).strokeColor(C.border).lineWidth(0.5).stroke();
    doc.fontSize(7.5).font('Helvetica').fillColor(C.gray)
       .text('This payslip is system-generated. Contributions based on 2024 SSS, PhilHealth, Pag-IBIG, and TRAIN Law rates.',
             MAR, y + 8, { width: RIGHT - MAR, align: 'center' });

    doc.end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/payroll/thirteenth-month/:year — preview ─────────────────────────
router.get('/thirteenth-month/:year', async (req, res) => {
  const year = parseInt(req.params.year);
  if (!year) return res.status(400).json({ error: 'Valid year required' });
  try {
    const { rows } = await query(`
      SELECT e.id AS employee_id, e.employee_number, e.first_name, e.last_name,
             e.position, e.department, e.basic_salary,
             COALESCE(SUM(pe.basic_pay), 0) AS total_basic_earned,
             COUNT(pe.id)::int               AS payroll_count
      FROM employees e
      LEFT JOIN payroll_entries pe ON pe.employee_id = e.id
        AND pe.period_type = 'regular'
      LEFT JOIN payroll_periods pp ON pp.id = pe.payroll_period_id
        AND pp.status = 'posted'
        AND EXTRACT(YEAR FROM pp.period_start::date) = $1
      WHERE e.is_active = 1
      GROUP BY e.id, e.employee_number, e.first_name, e.last_name, e.position, e.department, e.basic_salary
      ORDER BY e.last_name, e.first_name
    `, [year]);

    const EXEMPT = 90000;
    const data = rows.map(r => {
      const totalBasic = parseFloat(r.total_basic_earned) || 0;
      const amount     = Math.round(totalBasic / 12 * 100) / 100;
      const taxable    = Math.max(0, amount - EXEMPT);
      return { ...r, total_basic_earned: totalBasic, thirteenth_month: amount, taxable_amount: taxable, exempt_threshold: EXEMPT };
    });

    const grandTotal = Math.round(data.reduce((s, r) => s + r.thirteenth_month, 0) * 100) / 100;
    res.json({ year, employees: data, grand_total: grandTotal, exempt_threshold: EXEMPT });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/payroll/thirteenth-month/:year — create 13th month payroll ──────
router.post('/thirteenth-month/:year', async (req, res) => {
  const user = req.session.user;
  if (!['finance','super_admin'].includes(user?.role))
    return res.status(403).json({ error: 'Finance role or above required' });

  const year = parseInt(req.params.year);
  if (!year) return res.status(400).json({ error: 'Valid year required' });

  // Check if already created for this year
  const { rows: existing } = await query(
    `SELECT id FROM payroll_periods WHERE period_type = 'thirteenth_month' AND EXTRACT(YEAR FROM period_start::date) = $1`,
    [year]
  );
  if (existing.length > 0) return res.status(400).json({ error: `13th Month payroll for ${year} already exists` });

  try {
    const { rows: employees } = await query(`
      SELECT e.id, e.employee_number, e.first_name, e.last_name, e.basic_salary,
             COALESCE(SUM(pe.basic_pay), 0) AS total_basic_earned
      FROM employees e
      LEFT JOIN payroll_entries pe ON pe.employee_id = e.id AND pe.period_type = 'regular'
      LEFT JOIN payroll_periods pp ON pp.id = pe.payroll_period_id
        AND pp.status = 'posted'
        AND EXTRACT(YEAR FROM pp.period_start::date) = $1
      WHERE e.is_active = 1
      GROUP BY e.id
    `, [year]);

    if (employees.length === 0) return res.status(400).json({ error: 'No active employees found' });

    const { pay_date } = req.body;
    const periodStart  = `${year}-12-01`;
    const periodEnd    = `${year}-12-31`;
    const payDate      = pay_date || `${year}-12-15`;

    const period = await withTransaction(async (client) => {
      const { rows: [p] } = await client.query(
        `INSERT INTO payroll_periods
           (period_start, period_end, pay_date, pay_frequency, period_type, notes, created_by)
         VALUES ($1,$2,$3,'monthly','thirteenth_month',$4,$5) RETURNING *`,
        [periodStart, periodEnd, payDate, `${year} 13th Month Pay`, user.email]
      );

      for (const emp of employees) {
        const totalBasic = parseFloat(emp.total_basic_earned) || 0;
        const amount     = Math.round(totalBasic / 12 * 100) / 100;
        await client.query(
          `INSERT INTO payroll_entries
             (payroll_period_id, employee_id, basic_pay, gross_pay, net_pay, period_type,
              sss_employee, sss_employer, philhealth_employee, philhealth_employer,
              pagibig_employee, pagibig_employer, wtax, total_deductions, taxable_compensation)
           VALUES ($1,$2,$3,$3,$3,'thirteenth_month',0,0,0,0,0,0,0,0,0)`,
          [p.id, emp.id, amount]
        );
      }
      return p;
    });

    logAction(user, 'CREATE_13TH_MONTH_PERIOD', 'payroll_period', period.id, `${year}`);
    res.json(period);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/payroll/bir/1601c — monthly withholding tax remittance ───────────
router.get('/bir/1601c', async (req, res) => {
  const { year, month } = req.query;
  const y = parseInt(year)  || new Date().getFullYear();
  const m = parseInt(month) || new Date().getMonth() + 1;
  try {
    const { rows: [biz] } = await query('SELECT * FROM business_settings LIMIT 1');
    const bizData = biz || {};

    const { rows: entries } = await query(`
      SELECT pe.*, e.employee_number, e.first_name, e.last_name, e.tin,
             pp.period_start, pp.period_end, pp.pay_date
      FROM payroll_entries pe
      JOIN employees       e  ON e.id  = pe.employee_id
      JOIN payroll_periods pp ON pp.id = pe.payroll_period_id
      WHERE pp.status = 'posted'
        AND EXTRACT(YEAR  FROM pp.pay_date::date) = $1
        AND EXTRACT(MONTH FROM pp.pay_date::date) = $2
      ORDER BY e.last_name, e.first_name
    `, [y, m]);

    const totalComp = entries.reduce((s, e) => s + (parseFloat(e.gross_pay) || 0), 0);
    const totalWTax = entries.reduce((s, e) => s + (parseFloat(e.wtax)      || 0), 0);
    const months    = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="BIR-1601C-${y}-${String(m).padStart(2,'0')}.pdf"`);

    const doc = new PDFDocument({ size: 'LETTER', margin: MAR });
    doc.pipe(res);

    // Header
    doc.fontSize(14).font('Helvetica-Bold').fillColor(C.dark)
       .text('BIR Form 1601-C', MAR, 50)
       .fontSize(10).font('Helvetica').fillColor(C.gray)
       .text('Monthly Remittance Return of Income Taxes Withheld on Compensation', MAR, 70);
    doc.moveTo(MAR, 90).lineTo(RIGHT, 90).strokeColor(C.border).lineWidth(0.5).stroke();

    // Employer info
    let y2 = 100;
    const infoRow = (label, value) => {
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.gray).text(label, MAR, y2);
      doc.font('Helvetica').fillColor(C.dark).text(value, 200, y2);
      y2 += 14;
    };
    infoRow('Employer / Business Name:', bizData.business_name || 'N/A');
    infoRow('TIN:', bizData.tax_id || 'N/A');
    infoRow('Address:', bizData.address || 'N/A');
    infoRow('Return Period:', `${months[m]} ${y}`);
    y2 += 6;

    // Summary box
    doc.rect(MAR, y2, RIGHT - MAR, 22).fill('#2563eb');
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#fff').text('SUMMARY', MAR+8, y2+7);
    y2 += 22;
    const sumRow = (label, value, shade) => {
      doc.rect(MAR, y2, RIGHT-MAR, 18).fill(shade ? C.light : '#fff');
      doc.fontSize(9).font('Helvetica').fillColor(C.dark).text(label, MAR+8, y2+5);
      doc.font('Helvetica-Bold').text(value, MAR+8, y2+5, { width: RIGHT-MAR-16, align: 'right' });
      y2 += 18;
    };
    const sym = bizData.currency_symbol || '₱';
    const fmt = (v) => `${sym}${parseFloat(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    sumRow('No. of Employees with Withholding', entries.length, false);
    sumRow('Total Compensation (Gross)', fmt(totalComp), true);
    sumRow('Total Withholding Tax on Compensation', fmt(totalWTax), false);
    doc.rect(MAR, y2, RIGHT-MAR, 22).fill('#15803d');
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#fff').text('Total Tax Remittable', MAR+8, y2+6);
    doc.text(fmt(totalWTax), MAR+8, y2+6, { width: RIGHT-MAR-16, align: 'right' });
    y2 += 32;

    // Employee detail table
    if (entries.length > 0) {
      doc.rect(MAR, y2, RIGHT-MAR, 18).fill(C.dark);
      ['Employee', 'TIN', 'Gross Compensation', 'Withholding Tax'].forEach((h, i) => {
        const x = [MAR+6, 200, 330, 460][i];
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#fff').text(h, x, y2+5);
      });
      y2 += 18;
      entries.forEach((e, i) => {
        doc.rect(MAR, y2, RIGHT-MAR, 16).fill(i%2===0 ? C.light : '#fff');
        doc.fontSize(8).font('Helvetica').fillColor(C.dark);
        doc.text(`${e.first_name} ${e.last_name}`, MAR+6, y2+4, {width:160});
        doc.text(e.tin || 'N/A',                    200,    y2+4, {width:120});
        doc.text(fmt(e.gross_pay),                   330,    y2+4, {width:120, align:'right'});
        doc.text(fmt(e.wtax),                        450,    y2+4, {width:102, align:'right'});
        y2 += 16;
        if (y2 > 700) { doc.addPage(); y2 = 50; }
      });
    }

    // Footer note
    y2 += 10;
    doc.fontSize(7.5).font('Helvetica').fillColor(C.gray)
       .text('This is a system-generated summary for BIR Form 1601-C. File the official form via BIR eFPS or eBIRForms.',
             MAR, y2, { width: RIGHT-MAR, align: 'center' });
    doc.end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/payroll/bir/2316/:employeeId/:year — annual tax certificate ───────
router.get('/bir/2316/:employeeId/:year', async (req, res) => {
  const empId = parseInt(req.params.employeeId);
  const year  = parseInt(req.params.year);
  try {
    const { rows: [emp] } = await query('SELECT * FROM employees WHERE id = $1', [empId]);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const { rows: entries } = await query(`
      SELECT pe.*, pp.period_start, pp.period_end, pp.pay_date, pp.period_type AS pp_type
      FROM payroll_entries pe
      JOIN payroll_periods pp ON pp.id = pe.payroll_period_id
      WHERE pe.employee_id = $1 AND pp.status = 'posted'
        AND EXTRACT(YEAR FROM pp.period_start::date) = $2
      ORDER BY pp.period_start
    `, [empId, year]);

    const { rows: [biz] } = await query('SELECT * FROM business_settings LIMIT 1');
    const bizData = biz || {};

    const tot = entries.reduce((a, e) => {
      if (e.pp_type !== 'thirteenth_month') {
        a.gross  += parseFloat(e.gross_pay)           || 0;
        a.sssEe  += parseFloat(e.sss_employee)        || 0;
        a.phEe   += parseFloat(e.philhealth_employee) || 0;
        a.piEe   += parseFloat(e.pagibig_employee)    || 0;
        a.wtax   += parseFloat(e.wtax)                || 0;
        a.net    += parseFloat(e.net_pay)             || 0;
      } else {
        a.thirteenth += parseFloat(e.basic_pay)       || 0;
      }
      return a;
    }, { gross:0, sssEe:0, phEe:0, piEe:0, wtax:0, net:0, thirteenth:0 });

    const totalGovt = tot.sssEe + tot.phEe + tot.piEe;
    const sym = bizData.currency_symbol || '₱';
    const fmt = (v) => `${sym}${parseFloat(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    const name = `${emp.first_name} ${emp.last_name}`;
    const filename = `BIR-2316-${emp.employee_number}-${year}.pdf`.replace(/[^a-zA-Z0-9.\-_]/g,'-');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'LETTER', margin: MAR });
    doc.pipe(res);

    doc.fontSize(14).font('Helvetica-Bold').fillColor(C.dark).text('BIR Form 2316', MAR, 50);
    doc.fontSize(9).font('Helvetica').fillColor(C.gray)
       .text('Certificate of Compensation Payment / Tax Withheld', MAR, 70);
    doc.text(`For the Calendar Year ${year}`, MAR, 84);
    doc.moveTo(MAR, 100).lineTo(RIGHT, 100).strokeColor(C.border).lineWidth(0.5).stroke();

    let y2 = 112;
    const row = (label, value, shade) => {
      doc.rect(MAR, y2, RIGHT-MAR, 18).fill(shade ? C.light : '#fff');
      doc.fontSize(8.5).font('Helvetica').fillColor(C.gray).text(label, MAR+8, y2+5, {width:250});
      doc.font('Helvetica-Bold').fillColor(C.dark).text(value, MAR+8, y2+5, {width: RIGHT-MAR-16, align:'right'});
      y2 += 18;
    };

    doc.rect(MAR, y2, RIGHT-MAR, 20).fill(C.dark);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#fff').text('EMPLOYER', MAR+8, y2+6);
    y2 += 20;
    row('Business Name', bizData.business_name || 'N/A', false);
    row('TIN',           bizData.tax_id         || 'N/A', true);
    row('Address',       bizData.address         || 'N/A', false);
    y2 += 8;

    doc.rect(MAR, y2, RIGHT-MAR, 20).fill(C.dark);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#fff').text('EMPLOYEE', MAR+8, y2+6);
    y2 += 20;
    row('Name',               name,                     false);
    row('Employee Number',    emp.employee_number,       true);
    row('TIN',                emp.tin || 'N/A',          false);
    row('Position',           emp.position || 'N/A',     true);
    row('Employment Type',    emp.employment_type || 'N/A', false);
    y2 += 8;

    doc.rect(MAR, y2, RIGHT-MAR, 20).fill('#1d4ed8');
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#fff').text('COMPENSATION INCOME & TAX WITHHELD', MAR+8, y2+6);
    y2 += 20;
    row('Gross Compensation Income',           fmt(tot.gross),     false);
    row('SSS Employee Contributions',          fmt(tot.sssEe),     true);
    row('PhilHealth Employee Premiums',        fmt(tot.phEe),      false);
    row('Pag-IBIG Employee Contributions',     fmt(tot.piEe),      true);
    row('Total Government Contributions',      fmt(totalGovt),     false);
    row('Taxable Compensation Income',         fmt(Math.max(0, tot.gross - totalGovt)), true);
    row('Total Tax Withheld on Compensation',  fmt(tot.wtax),      false);
    if (tot.thirteenth > 0) {
      y2 += 4;
      doc.rect(MAR, y2, RIGHT-MAR, 20).fill('#64748b');
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#fff').text('OTHER BENEFITS', MAR+8, y2+6);
      y2 += 20;
      row('13th Month Pay (Total)', fmt(tot.thirteenth), false);
      row('13th Month Pay — Tax-Exempt Portion (max ₱90,000)', fmt(Math.min(tot.thirteenth, 90000)), true);
      const taxable13 = Math.max(0, tot.thirteenth - 90000);
      if (taxable13 > 0) row('13th Month Pay — Taxable Portion', fmt(taxable13), false);
    }
    y2 += 12;
    doc.rect(MAR, y2, RIGHT-MAR, 26).fill('#15803d');
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#fff').text('Net Compensation', MAR+8, y2+8);
    doc.text(fmt(tot.net), MAR+8, y2+8, {width: RIGHT-MAR-16, align:'right'});
    y2 += 34;

    doc.fontSize(7.5).font('Helvetica').fillColor(C.gray)
       .text('This is a system-generated BIR Form 2316. The employer certifies that the above information is correct and complete.',
             MAR, y2, {width: RIGHT-MAR, align:'center'});

    doc.end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Numeric coercion helper ───────────────────────────────────────────────────
function numericEntry(e) {
  const fields = ['basic_pay','overtime_pay','holiday_pay','allowances','gross_pay',
    'sss_employee','sss_employer','sss_msc','philhealth_employee','philhealth_employer',
    'pagibig_employee','pagibig_employer','wtax','other_deductions','total_deductions',
    'net_pay','taxable_compensation','basic_salary'];
  const out = { ...e };
  fields.forEach(f => { if (out[f] !== undefined) out[f] = parseFloat(out[f]) || 0; });
  return out;
}

module.exports = router;
