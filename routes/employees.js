const express = require('express');
const router  = express.Router();
const { query } = require('../db/database');
const { logAction } = require('../utils/auditLog');

// ── GET /api/employees ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM employees ORDER BY last_name, first_name`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/employees/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows: [emp] } = await query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json(emp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/employees ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const user = req.session.user;
  const {
    employee_number, first_name, last_name, email, phone,
    position, department, employment_type, pay_frequency,
    basic_salary, sss_number, philhealth_number, pagibig_number,
    tin, bank_name, bank_account, hire_date, notes,
  } = req.body;

  if (!employee_number || !first_name || !last_name)
    return res.status(400).json({ error: 'Employee number, first name, and last name are required' });

  try {
    const { rows: [emp] } = await query(
      `INSERT INTO employees
         (employee_number, first_name, last_name, email, phone, position, department,
          employment_type, pay_frequency, basic_salary, sss_number, philhealth_number,
          pagibig_number, tin, bank_name, bank_account, hire_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        employee_number.trim(), first_name.trim(), last_name.trim(),
        email || null, phone || null, position || null, department || null,
        employment_type || 'regular', pay_frequency || 'semi_monthly',
        parseFloat(basic_salary) || 0,
        sss_number || null, philhealth_number || null, pagibig_number || null,
        tin || null, bank_name || null, bank_account || null,
        hire_date || null, notes || null,
      ]
    );
    logAction(user, 'CREATE_EMPLOYEE', 'employee', emp.id, emp.employee_number);
    res.json(emp);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: `Employee number "${employee_number}" already exists` });
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/employees/:id ────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const user = req.session.user;
  const {
    first_name, last_name, email, phone, position, department,
    employment_type, pay_frequency, basic_salary, sss_number,
    philhealth_number, pagibig_number, tin, bank_name, bank_account,
    hire_date, notes, is_active,
  } = req.body;

  try {
    const { rows: [emp] } = await query(
      `UPDATE employees SET
         first_name=$1, last_name=$2, email=$3, phone=$4, position=$5,
         department=$6, employment_type=$7, pay_frequency=$8, basic_salary=$9,
         sss_number=$10, philhealth_number=$11, pagibig_number=$12, tin=$13,
         bank_name=$14, bank_account=$15, hire_date=$16, notes=$17, is_active=$18
       WHERE id=$19 RETURNING *`,
      [
        first_name, last_name, email || null, phone || null, position || null,
        department || null, employment_type || 'regular', pay_frequency || 'semi_monthly',
        parseFloat(basic_salary) || 0,
        sss_number || null, philhealth_number || null, pagibig_number || null,
        tin || null, bank_name || null, bank_account || null,
        hire_date || null, notes || null,
        is_active === false || is_active === 0 ? 0 : 1,
        req.params.id,
      ]
    );
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    logAction(user, 'UPDATE_EMPLOYEE', 'employee', emp.id, emp.employee_number);
    res.json(emp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
