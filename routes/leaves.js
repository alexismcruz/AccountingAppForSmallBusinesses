const express = require('express');
const router  = express.Router();
const { query, withTransaction } = require('../db/database');
const { logAction } = require('../utils/auditLog');

// ── GET /api/leaves/types ─────────────────────────────────────────────────────
router.get('/types', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM leave_types ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/leaves/types ────────────────────────────────────────────────────
router.post('/types', async (req, res) => {
  const user = req.session.user;
  if (!['finance','super_admin'].includes(user?.role))
    return res.status(403).json({ error: 'Finance role or above required' });
  const { name, code, days_per_year, carry_over_days, is_monetizable, description } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Name and code are required' });
  try {
    const { rows: [lt] } = await query(
      `INSERT INTO leave_types (name, code, days_per_year, carry_over_days, is_monetizable, description)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name.trim(), code.trim().toUpperCase(),
       parseFloat(days_per_year) || 5, parseInt(carry_over_days) || 0,
       is_monetizable ? 1 : 0, description || null]
    );
    logAction(user, 'CREATE_LEAVE_TYPE', 'leave_type', lt.id, lt.code);
    res.json(lt);
  } catch (e) {
    res.status(e.code === '23505' ? 400 : 500).json({
      error: e.code === '23505' ? `Leave type code "${code.toUpperCase()}" already exists` : e.message,
    });
  }
});

// ── PUT /api/leaves/types/:id ─────────────────────────────────────────────────
router.put('/types/:id', async (req, res) => {
  const user = req.session.user;
  if (!['finance','super_admin'].includes(user?.role))
    return res.status(403).json({ error: 'Finance role or above required' });
  const { name, days_per_year, carry_over_days, is_monetizable, description, is_active } = req.body;
  try {
    const { rows: [lt] } = await query(
      `UPDATE leave_types SET name=$1, days_per_year=$2, carry_over_days=$3,
         is_monetizable=$4, description=$5, is_active=$6
       WHERE id=$7 RETURNING *`,
      [name, parseFloat(days_per_year)||5, parseInt(carry_over_days)||0,
       is_monetizable?1:0, description||null,
       is_active===false||is_active===0?0:1, req.params.id]
    );
    if (!lt) return res.status(404).json({ error: 'Leave type not found' });
    logAction(user, 'UPDATE_LEAVE_TYPE', 'leave_type', lt.id, lt.code);
    res.json(lt);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/leaves/balances — for management view ────────────────────────────
router.get('/balances', async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  try {
    const { rows } = await query(`
      SELECT lb.*, lt.name AS leave_type_name, lt.code AS leave_type_code,
             lt.is_monetizable, lt.carry_over_days AS max_carry_over,
             e.employee_number, e.first_name, e.last_name, e.department, e.position,
             (lb.entitled_days + lb.carry_over - lb.used_days) AS remaining_days
      FROM leave_balances lb
      JOIN leave_types lt ON lt.id = lb.leave_type_id
      JOIN employees   e  ON e.id  = lb.employee_id
      WHERE lb.year = $1
      ORDER BY e.last_name, e.first_name, lt.name
    `, [year]);
    res.json(rows.map(r => ({
      ...r,
      entitled_days:  parseFloat(r.entitled_days)  || 0,
      used_days:      parseFloat(r.used_days)       || 0,
      carry_over:     parseFloat(r.carry_over)      || 0,
      remaining_days: parseFloat(r.remaining_days)  || 0,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/leaves/balances/allocate — allocate for a year ─────────────────
// Creates/resets leave_balance rows for all active employees and all active leave types
router.post('/balances/allocate', async (req, res) => {
  const user = req.session.user;
  if (!['finance','super_admin'].includes(user?.role))
    return res.status(403).json({ error: 'Finance role or above required' });
  const year = parseInt(req.body.year) || new Date().getFullYear();
  try {
    const { rows: employees  } = await query('SELECT id FROM employees WHERE is_active = 1');
    const { rows: leaveTypes } = await query('SELECT * FROM leave_types WHERE is_active = 1');
    let inserted = 0, skipped = 0;
    for (const emp of employees) {
      for (const lt of leaveTypes) {
        // Carry-over from previous year if applicable
        let carryOver = 0;
        if (lt.carry_over_days > 0) {
          const { rows: [prev] } = await query(
            `SELECT entitled_days, used_days, carry_over
             FROM leave_balances WHERE employee_id=$1 AND leave_type_id=$2 AND year=$3`,
            [emp.id, lt.id, year - 1]
          );
          if (prev) {
            const prevRemaining = parseFloat(prev.entitled_days) + parseFloat(prev.carry_over) - parseFloat(prev.used_days);
            carryOver = Math.min(Math.max(0, prevRemaining), lt.carry_over_days);
          }
        }
        try {
          await query(
            `INSERT INTO leave_balances (employee_id, leave_type_id, year, entitled_days, carry_over)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING`,
            [emp.id, lt.id, year, lt.days_per_year, carryOver]
          );
          inserted++;
        } catch { skipped++; }
      }
    }
    logAction(user, 'ALLOCATE_LEAVE_BALANCES', 'leave_balance', null, null, { year, inserted, skipped });
    res.json({ ok: true, year, inserted, skipped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/leaves/requests ──────────────────────────────────────────────────
router.get('/requests', async (req, res) => {
  const user   = req.session.user;
  const { status, employee_id, year } = req.query;
  try {
    const conditions = [];
    const params     = [];
    let   idx        = 1;
    if (status)      { conditions.push(`lr.status = $${idx++}`);                  params.push(status); }
    if (employee_id) { conditions.push(`lr.employee_id = $${idx++}`);             params.push(parseInt(employee_id)); }
    if (year)        { conditions.push(`EXTRACT(YEAR FROM lr.start_date::date) = $${idx++}`); params.push(parseInt(year)); }

    // Staff can only see their own requests; find their employee record
    if (user?.role === 'staff') {
      const { rows: [emp] } = await query('SELECT id FROM employees WHERE email = $1 LIMIT 1', [user.email]);
      if (emp) { conditions.push(`lr.employee_id = $${idx++}`); params.push(emp.id); }
      else return res.json([]); // no matching employee
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await query(`
      SELECT lr.*, lt.name AS leave_type_name, lt.code AS leave_type_code,
             e.employee_number, e.first_name, e.last_name, e.department, e.position
      FROM leave_requests lr
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      JOIN employees   e  ON e.id  = lr.employee_id
      ${where}
      ORDER BY lr.created_at DESC
    `, params);
    res.json(rows.map(r => ({ ...r, days: parseFloat(r.days) || 0 })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/leaves/requests/:id ─────────────────────────────────────────────
router.get('/requests/:id', async (req, res) => {
  try {
    const { rows: [r] } = await query(`
      SELECT lr.*, lt.name AS leave_type_name, lt.code AS leave_type_code,
             e.employee_number, e.first_name, e.last_name
      FROM leave_requests lr
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      JOIN employees   e  ON e.id  = lr.employee_id
      WHERE lr.id = $1
    `, [req.params.id]);
    if (!r) return res.status(404).json({ error: 'Request not found' });
    res.json({ ...r, days: parseFloat(r.days) || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/leaves/requests — file a leave request ─────────────────────────
router.post('/requests', async (req, res) => {
  const user = req.session.user;
  const { employee_id, leave_type_id, start_date, end_date, days, reason } = req.body;
  if (!employee_id || !leave_type_id || !start_date || !end_date || !days)
    return res.status(400).json({ error: 'employee_id, leave_type_id, start_date, end_date, and days are required' });
  const numDays = parseFloat(days);
  if (numDays <= 0) return res.status(400).json({ error: 'Days must be greater than 0' });

  try {
    // Verify balance exists and is sufficient
    const year = parseInt(start_date.split('-')[0]);
    const { rows: [balance] } = await query(
      `SELECT *, (entitled_days + carry_over - used_days) AS remaining
       FROM leave_balances WHERE employee_id=$1 AND leave_type_id=$2 AND year=$3`,
      [parseInt(employee_id), parseInt(leave_type_id), year]
    );
    if (!balance) return res.status(400).json({ error: `No leave balance allocated for this year. Ask Finance to allocate leave for ${year} first.` });
    if (parseFloat(balance.remaining) < numDays)
      return res.status(400).json({ error: `Insufficient balance. Available: ${parseFloat(balance.remaining).toFixed(1)} day(s)` });

    const { rows: [req2] } = await query(
      `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days, reason)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [parseInt(employee_id), parseInt(leave_type_id), start_date, end_date, numDays, reason || null]
    );
    logAction(user, 'FILE_LEAVE_REQUEST', 'leave_request', req2.id, `${start_date}→${end_date}`);
    res.json({ ...req2, days: parseFloat(req2.days) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/leaves/requests/:id/approve ─────────────────────────────────────
router.put('/requests/:id/approve', async (req, res) => {
  const user = req.session.user;
  if (!['manager','finance','super_admin'].includes(user?.role))
    return res.status(403).json({ error: 'Manager role or above required to approve leave' });
  const { note } = req.body;
  try {
    const { rows: [lr] } = await query('SELECT * FROM leave_requests WHERE id = $1', [req.params.id]);
    if (!lr)                    return res.status(404).json({ error: 'Request not found' });
    if (lr.status !== 'pending') return res.status(400).json({ error: 'This request has already been reviewed' });

    const year = parseInt(lr.start_date.split('-')[0]);
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE leave_requests SET status='approved', reviewed_by_email=$1, reviewed_by_name=$2,
           reviewer_note=$3, reviewed_at=NOW() WHERE id=$4`,
        [user.email, user.name || user.email, note || '', lr.id]
      );
      // Deduct from balance
      await client.query(
        `UPDATE leave_balances SET used_days = used_days + $1
         WHERE employee_id=$2 AND leave_type_id=$3 AND year=$4`,
        [parseFloat(lr.days), lr.employee_id, lr.leave_type_id, year]
      );
    });
    logAction(user, 'APPROVE_LEAVE', 'leave_request', lr.id, `${lr.start_date}→${lr.end_date}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/leaves/requests/:id/reject ──────────────────────────────────────
router.put('/requests/:id/reject', async (req, res) => {
  const user = req.session.user;
  if (!['manager','finance','super_admin'].includes(user?.role))
    return res.status(403).json({ error: 'Manager role or above required' });
  const { note } = req.body;
  if (!note || !note.trim()) return res.status(400).json({ error: 'A rejection reason is required' });
  try {
    const { rows: [lr] } = await query('SELECT * FROM leave_requests WHERE id = $1', [req.params.id]);
    if (!lr)                    return res.status(404).json({ error: 'Request not found' });
    if (lr.status !== 'pending') return res.status(400).json({ error: 'This request has already been reviewed' });
    await query(
      `UPDATE leave_requests SET status='rejected', reviewed_by_email=$1, reviewed_by_name=$2,
         reviewer_note=$3, reviewed_at=NOW() WHERE id=$4`,
      [user.email, user.name || user.email, note.trim(), lr.id]
    );
    logAction(user, 'REJECT_LEAVE', 'leave_request', lr.id, `${lr.start_date}→${lr.end_date}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/leaves/requests/:id/cancel — employee cancels own request ────────
router.put('/requests/:id/cancel', async (req, res) => {
  const user = req.session.user;
  try {
    const { rows: [lr] } = await query(`
      SELECT lr.*, e.email AS emp_email
      FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id
      WHERE lr.id = $1
    `, [req.params.id]);
    if (!lr) return res.status(404).json({ error: 'Request not found' });
    if (lr.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    // Only the employee or manager+ can cancel
    if (lr.emp_email !== user.email && !['manager','finance','super_admin'].includes(user?.role))
      return res.status(403).json({ error: 'You can only cancel your own leave requests' });

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE leave_requests SET status='cancelled', reviewed_by_email=$1, reviewed_by_name=$2, reviewed_at=NOW() WHERE id=$3`,
        [user.email, user.name || user.email, lr.id]
      );
      // If was approved, restore balance
      if (lr.status === 'approved') {
        const year = parseInt(lr.start_date.split('-')[0]);
        await client.query(
          `UPDATE leave_balances SET used_days = GREATEST(0, used_days - $1)
           WHERE employee_id=$2 AND leave_type_id=$3 AND year=$4`,
          [parseFloat(lr.days), lr.employee_id, lr.leave_type_id, year]
        );
      }
    });
    logAction(user, 'CANCEL_LEAVE', 'leave_request', lr.id, `${lr.start_date}→${lr.end_date}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
