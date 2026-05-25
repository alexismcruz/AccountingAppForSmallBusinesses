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

// ── PUT /api/payroll/periods/:id/post ─────────────────────────────────────────
router.put('/periods/:id/post', async (req, res) => {
  const user = req.session.user;
  if (!['finance', 'super_admin'].includes(user?.role))
    return res.status(403).json({ error: 'Finance role or above required' });
  try {
    const { rows: [p] } = await query(
      `UPDATE payroll_periods SET status = 'posted' WHERE id = $1 AND status = 'draft' RETURNING *`,
      [req.params.id]
    );
    if (!p) return res.status(400).json({ error: 'Period not found or already posted' });
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
