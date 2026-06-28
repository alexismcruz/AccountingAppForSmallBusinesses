const router = require('express').Router();
const crypto = require('crypto');
const cron   = require('node-cron');
const { query } = require('../db/database');

// ── Helpers ───────────────────────────────────────────────────────────────────

const RETRY_DELAYS = [30000, 90000]; // backoff between cron push retries (ms)
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getInstanceRole() {
  const { rows } = await query(`
    SELECT multi_branch_role, multi_branch_sync_time,
           multi_branch_last_push_at, multi_branch_last_push_status, multi_branch_last_push_error
    FROM business_settings WHERE id = 1
  `);
  return rows[0] || { multi_branch_role: 'standalone', multi_branch_sync_time: '18:00' };
}

// Persist the outcome of the most recent branch->HQ push so the UI can show health
async function recordPushHealth(status, error) {
  try {
    await query(`
      UPDATE business_settings
         SET multi_branch_last_push_at     = NOW(),
             multi_branch_last_push_status = $1,
             multi_branch_last_push_error  = $2
       WHERE id = 1
    `, [status, error ? String(error).slice(0, 500) : null]);
  } catch (e) {
    console.error('[BranchSync] Failed to record push health:', e.message);
  }
}

function requireAdmin(req, res, next) {
  const role = req.session?.user?.role;
  if (!['admin', 'super_admin'].includes(role))
    return res.status(403).json({ error: 'Admin access required' });
  next();
}

// ── GET /api/branch-sync/status ───────────────────────────────────────────────
// Role, branch list with latest snapshot, used by Settings page

router.get('/status', requireAdmin, async (req, res) => {
  try {
    const settings = await getInstanceRole();
    const role     = settings.multi_branch_role;

    if (role === 'hq') {
      const { rows: branches } = await query(`
        SELECT
          br.id, br.name, br.subdomain, br.plan, br.status, br.created_at,
          bs.period, bs.revenue, bs.expenses, bs.net_income,
          bs.ar_balance, bs.ap_balance, bs.payroll_total, bs.synced_at,
          CASE
            WHEN bs.synced_at IS NULL             THEN 'never'
            WHEN bs.synced_at > NOW() - INTERVAL '25 hours' THEN 'synced'
            WHEN bs.synced_at > NOW() - INTERVAL '49 hours' THEN 'pending'
            ELSE 'stale'
          END AS sync_status
        FROM branch_registry br
        LEFT JOIN branch_snapshots bs
          ON br.id = bs.branch_id AND bs.period = TO_CHAR(NOW(), 'YYYY-MM')
        WHERE br.status = 'active'
        ORDER BY br.name
      `);
      return res.json({
        role,
        sync_time:       settings.multi_branch_sync_time,
        alert_email:     process.env.HQ_ALERT_EMAIL || null,
        alert_enabled:   !!process.env.HQ_ALERT_EMAIL,
        branches,
      });
    }

    if (role === 'branch') {
      return res.json({
        role,
        hq_url:           process.env.HQ_SYNC_URL    || null,
        hq_enabled:       process.env.HQ_SYNC_ENABLED === 'true',
        sync_time:        settings.multi_branch_sync_time,
        last_push_at:     settings.multi_branch_last_push_at,
        last_push_status: settings.multi_branch_last_push_status,
        last_push_error:  settings.multi_branch_last_push_error,
        branches:         [],
      });
    }

    res.json({ role: 'standalone', branches: [] });
  } catch (err) {
    console.error('[BranchSync] status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/branch-sync/summary ──────────────────────────────────────────────
// Consolidated totals for HQ dashboard — supports ?period=YYYY-MM

router.get('/summary', requireAdmin, async (req, res) => {
  const period = req.query.period || new Date().toISOString().slice(0, 7);
  try {
    const { multi_branch_role: role } = await getInstanceRole();
    if (role !== 'hq')
      return res.status(403).json({ error: 'This instance is not configured as HQ' });

    const { rows: branches } = await query(`
      SELECT
        br.id, br.name, br.subdomain, br.plan, br.status,
        COALESCE(bs.revenue,       0) AS revenue,
        COALESCE(bs.expenses,      0) AS expenses,
        COALESCE(bs.net_income,    0) AS net_income,
        COALESCE(bs.ar_balance,    0) AS ar_balance,
        COALESCE(bs.ap_balance,    0) AS ap_balance,
        COALESCE(bs.payroll_total, 0) AS payroll_total,
        bs.synced_at,
        CASE
          WHEN bs.synced_at IS NULL                        THEN 'never'
          WHEN bs.synced_at > NOW() - INTERVAL '25 hours' THEN 'synced'
          WHEN bs.synced_at > NOW() - INTERVAL '49 hours' THEN 'pending'
          ELSE 'stale'
        END AS sync_status
      FROM branch_registry br
      LEFT JOIN branch_snapshots bs ON br.id = bs.branch_id AND bs.period = $1
      WHERE br.status = 'active'
      ORDER BY br.name
    `, [period]);

    const totals = branches.reduce((acc, b) => ({
      revenue:       acc.revenue       + Number(b.revenue),
      expenses:      acc.expenses      + Number(b.expenses),
      net_income:    acc.net_income    + Number(b.net_income),
      ar_balance:    acc.ar_balance    + Number(b.ar_balance),
      ap_balance:    acc.ap_balance    + Number(b.ap_balance),
      payroll_total: acc.payroll_total + Number(b.payroll_total),
    }), { revenue: 0, expenses: 0, net_income: 0, ar_balance: 0, ap_balance: 0, payroll_total: 0 });

    res.json({ period, totals, branches });
  } catch (err) {
    console.error('[BranchSync] summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/branch-sync/role ─────────────────────────────────────────────────

router.put('/role', requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!['standalone', 'hq', 'branch'].includes(role))
    return res.status(400).json({ error: 'role must be standalone, hq, or branch' });
  try {
    await query('UPDATE business_settings SET multi_branch_role = $1 WHERE id = 1', [role]);
    res.json({ ok: true, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/branch-sync/schedule ────────────────────────────────────────────

router.put('/schedule', requireAdmin, async (req, res) => {
  const { sync_time } = req.body;
  if (!sync_time) return res.status(400).json({ error: 'sync_time required (HH:MM)' });
  try {
    await query('UPDATE business_settings SET multi_branch_sync_time = $1 WHERE id = 1', [sync_time]);
    res.json({ ok: true, sync_time });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/branch-sync/branches ───────────────────────────────────────────
// Add branch to HQ registry — returns the raw API key once (set on branch as env var)

router.post('/branches', requireAdmin, async (req, res) => {
  const { name, subdomain, plan } = req.body;
  if (!name || !subdomain)
    return res.status(400).json({ error: 'name and subdomain are required' });
  try {
    const api_key = crypto.randomBytes(32).toString('hex');
    const { rows: [branch] } = await query(
      `INSERT INTO branch_registry (name, subdomain, api_key, plan)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, subdomain, plan, status, created_at`,
      [name, subdomain.toLowerCase().trim(), api_key, plan || 'starter']
    );
    res.json({ ...branch, api_key }); // api_key shown once — store as HQ_SYNC_API_KEY on the branch
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'A branch with this subdomain already exists' });
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/branch-sync/branches/:id ─────────────────────────────────────

router.delete('/branches/:id', requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await query('DELETE FROM branch_registry WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Branch not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/branch-sync/receive ─────────────────────────────────────────────
// Called by branch cron/manual push — auth via X-Branch-Key header (no session)

router.post('/receive', async (req, res) => {
  const apiKey = req.headers['x-branch-key'];
  if (!apiKey) return res.status(401).json({ error: 'Missing X-Branch-Key header' });

  try {
    const { rows: [branch] } = await query(
      `SELECT id, name FROM branch_registry WHERE api_key = $1 AND status = 'active'`,
      [apiKey]
    );
    if (!branch) return res.status(401).json({ error: 'Invalid or inactive branch key' });

    const { period, revenue, expenses, net_income, ar_balance, ap_balance, payroll_total } = req.body;
    if (!period) return res.status(400).json({ error: 'period required (YYYY-MM)' });

    await query(`
      INSERT INTO branch_snapshots
        (branch_id, period, revenue, expenses, net_income, ar_balance, ap_balance, payroll_total, synced_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      ON CONFLICT (branch_id, period) DO UPDATE SET
        revenue       = EXCLUDED.revenue,
        expenses      = EXCLUDED.expenses,
        net_income    = EXCLUDED.net_income,
        ar_balance    = EXCLUDED.ar_balance,
        ap_balance    = EXCLUDED.ap_balance,
        payroll_total = EXCLUDED.payroll_total,
        synced_at     = NOW()
    `, [branch.id, period,
        revenue || 0, expenses || 0, net_income || 0,
        ar_balance || 0, ap_balance || 0, payroll_total || 0]);

    console.log(`[BranchSync] Received snapshot from "${branch.name}" for ${period}`);
    res.json({ ok: true, branch: branch.name, period });
  } catch (err) {
    console.error('[BranchSync] receive error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/branch-sync/push-now ───────────────────────────────────────────
// Manual trigger on branch instances

router.post('/push-now', requireAdmin, async (req, res) => {
  try {
    const result = await pushToHQ();
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[BranchSync] push-now error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Branch push logic (shared by cron + push-now) ────────────────────────────

// Aggregate this instance's current-period financial summary from the live DB
async function buildSnapshot() {
  const period = new Date().toISOString().slice(0, 7);

  // Revenue and expenses from posted journal entries this period
  const { rows: [fin] } = await query(`
    SELECT
      COALESCE(SUM(CASE WHEN a.type = 'Revenue'               THEN jl.credit - jl.debit ELSE 0 END), 0) AS revenue,
      COALESCE(SUM(CASE WHEN a.type IN ('Expense','Cost of Goods Sold') THEN jl.debit - jl.credit ELSE 0 END), 0) AS expenses
    FROM journal_lines jl
    JOIN accounts       a  ON a.id  = jl.account_id
    JOIN journal_entries je ON je.id = jl.entry_id
    WHERE je.status = 'posted'
      AND TO_CHAR(je.date::date, 'YYYY-MM') = $1
  `, [period]);

  const revenue  = Number(fin?.revenue  || 0);
  const expenses = Number(fin?.expenses || 0);

  // Outstanding AR
  const { rows: [arRow] } = await query(
    `SELECT COALESCE(SUM(amount - paid_amount), 0) AS ar_balance FROM receivables WHERE status != 'paid'`
  );

  // Outstanding AP
  const { rows: [apRow] } = await query(
    `SELECT COALESCE(SUM(amount - paid_amount), 0) AS ap_balance FROM payables WHERE status != 'paid'`
  );

  // Payroll for this period (Starter instances won't have this table — safe fallback)
  let payroll_total = 0;
  try {
    const { rows: [prRow] } = await query(`
      SELECT COALESCE(SUM(pe.net_pay), 0) AS payroll_total
      FROM payroll_entries pe
      JOIN payroll_periods pp ON pp.id = pe.payroll_period_id
      WHERE TO_CHAR(pp.period_start::date, 'YYYY-MM') = $1
        AND pp.status = 'posted'
    `, [period]);
    payroll_total = Number(prRow?.payroll_total || 0);
  } catch (_) { /* payroll table absent on this instance — skip */ }

  return {
    period,
    revenue,
    expenses,
    net_income:    revenue - expenses,
    ar_balance:    Number(arRow?.ar_balance || 0),
    ap_balance:    Number(apRow?.ap_balance || 0),
    payroll_total,
  };
}

// Push current snapshot to HQ. `retries` adds backoff re-attempts (used by cron).
// Outcome is persisted to business_settings so the branch UI can show sync health.
async function pushToHQ({ retries = 0 } = {}) {
  const hqUrl   = process.env.HQ_SYNC_URL;
  const apiKey  = process.env.HQ_SYNC_API_KEY;
  const enabled = process.env.HQ_SYNC_ENABLED === 'true';

  if (!enabled || !hqUrl || !apiKey)
    return { ok: false, reason: 'HQ sync not configured (HQ_SYNC_ENABLED / HQ_SYNC_URL / HQ_SYNC_API_KEY)' };

  const payload = await buildSnapshot();
  const { period } = payload;

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      console.log(`[BranchSync] Retry ${attempt}/${retries} in ${delay / 1000}s…`);
      await sleep(delay);
    }
    try {
      const response = await fetch(`${hqUrl.replace(/\/$/, '')}/api/branch-sync/receive`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Branch-Key': apiKey },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HQ responded ${response.status}: ${text}`);
      }
      await recordPushHealth('success', null);
      console.log(`[BranchSync] Pushed snapshot to HQ for ${period}`);
      return { ok: true, period, payload };
    } catch (err) {
      lastErr = err;
      console.warn(`[BranchSync] Push attempt ${attempt + 1} failed: ${err.message}`);
    }
  }

  await recordPushHealth('error', lastErr?.message || 'Push failed');
  return { ok: false, error: lastErr?.message || 'Push failed', period };
}

// ── Cron scheduler — starts on module load if this is a branch instance ───────

function startBranchCron() {
  if (process.env.HQ_SYNC_ENABLED !== 'true') return;

  const syncTime = process.env.HQ_SYNC_TIME || '18:00';
  const [hour, minute] = syncTime.split(':').map(Number);

  if (isNaN(hour) || isNaN(minute)) {
    console.warn(`[BranchSync] Invalid HQ_SYNC_TIME "${syncTime}" — defaulting to 18:00`);
  }

  const h = isNaN(hour)   ? 18 : hour;
  const m = isNaN(minute) ? 0  : minute;

  cron.schedule(`${m} ${h} * * *`, async () => {
    console.log(`[BranchSync] Cron triggered — pushing snapshot to HQ`);
    try {
      const result = await pushToHQ({ retries: RETRY_DELAYS.length });
      if (!result.ok) console.warn('[BranchSync] Push failed after retries:', result.reason || result.error);
    } catch (err) {
      console.error('[BranchSync] Cron push failed:', err.message);
    }
  });

  console.log(`[BranchSync] Branch cron scheduled — daily push at ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
}

// ── HQ stale-branch monitoring ───────────────────────────────────────────────

// Branches with no snapshot in over 49h (or never) are considered stale
async function findStaleBranches() {
  const { rows } = await query(`
    SELECT br.id, br.name, br.subdomain, MAX(bs.synced_at) AS last_synced
    FROM branch_registry br
    LEFT JOIN branch_snapshots bs ON br.id = bs.branch_id
    WHERE br.status = 'active'
    GROUP BY br.id, br.name, br.subdomain
    HAVING MAX(bs.synced_at) IS NULL OR MAX(bs.synced_at) < NOW() - INTERVAL '49 hours'
    ORDER BY br.name
  `);
  return rows;
}

function staleAlertHtml(stale) {
  const rows = stale.map(b => `
    <tr>
      <td style="padding:7px 0;font-weight:600">${b.name}</td>
      <td style="padding:7px 0;color:#4A5E52">${b.subdomain}</td>
      <td style="padding:7px 0;color:${b.last_synced ? '#92400e' : '#991b1b'}">
        ${b.last_synced ? new Date(b.last_synced).toLocaleString('en-US') : 'Never synced'}
      </td>
    </tr>`).join('');
  return `
  <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;color:#1B2E24">
    <div style="background:#92400e;padding:24px 32px;border-radius:12px 12px 0 0">
      <h2 style="color:white;margin:0;font-size:20px;font-weight:600">⚠ Branch Sync Alert</h2>
    </div>
    <div style="background:#F8F5EF;padding:24px 32px">
      <p style="font-size:14px;line-height:1.7;margin:0 0 16px">
        ${stale.length} branch${stale.length > 1 ? 'es have' : ' has'} not sent a financial summary to HQ in over 48 hours.
        Check that ${stale.length > 1 ? 'these branches are' : 'this branch is'} online and that their sync settings are correct.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="text-align:left;border-bottom:2px solid #E2DDD4">
          <th style="padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#8A9E92">Branch</th>
          <th style="padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#8A9E92">Subdomain</th>
          <th style="padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#8A9E92">Last Sync</th>
        </tr>
        ${rows}
      </table>
    </div>
    <div style="background:#1B2E24;padding:14px 32px;border-radius:0 0 12px 12px;font-size:12px;color:rgba(255,255,255,0.4)">
      CuentaIQ HQ · Automated multi-branch monitoring
    </div>
  </div>`;
}

// Email the configured HQ_ALERT_EMAIL. `force` sends even when nothing is stale (test pings).
async function sendStaleAlert(stale, { force = false } = {}) {
  const to = process.env.HQ_ALERT_EMAIL;
  if (!to) return { ok: false, reason: 'HQ_ALERT_EMAIL not set' };
  if (!force && stale.length === 0) return { ok: true, sent: false, reason: 'No stale branches' };

  if (!process.env.RESEND_API_KEY) {
    console.log('[BranchSync] RESEND_API_KEY not set — would alert', to, 'for', stale.map(b => b.name));
    return { ok: false, reason: 'RESEND_API_KEY not set' };
  }

  const subject = stale.length === 0
    ? 'CuentaIQ HQ — branch sync test (all branches healthy)'
    : `⚠ CuentaIQ HQ — ${stale.length} branch${stale.length > 1 ? 'es' : ''} overdue for sync`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'CuentaIQ HQ <hello@cuentaiq.com>',
        to:      [to],
        subject,
        html:    staleAlertHtml(stale),
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error('[BranchSync] Stale alert email failed:', err);
      return { ok: false, reason: 'Email send failed' };
    }
    console.log(`[BranchSync] Stale alert emailed to ${to} (${stale.length} branch(es))`);
    return { ok: true, sent: true, count: stale.length };
  } catch (err) {
    console.error('[BranchSync] Stale alert email error:', err.message);
    return { ok: false, reason: err.message };
  }
}

// Run the stale check (HQ instances only) and email if anything is overdue
async function checkStaleBranches() {
  const { multi_branch_role: role } = await getInstanceRole();
  if (role !== 'hq') return;

  const stale = await findStaleBranches();
  if (stale.length === 0) {
    console.log('[BranchSync] Stale check: all branches healthy');
    return;
  }
  console.warn(`[BranchSync] Stale check: ${stale.length} branch(es) overdue`);
  await sendStaleAlert(stale);
}

function startHQAlertCron() {
  if (!process.env.HQ_ALERT_EMAIL) return;

  const alertTime = process.env.HQ_ALERT_TIME || '07:00';
  const [hh, mm] = alertTime.split(':').map(Number);
  const h = isNaN(hh) ? 7 : hh;
  const m = isNaN(mm) ? 0 : mm;

  cron.schedule(`${m} ${h} * * *`, async () => {
    try { await checkStaleBranches(); }
    catch (err) { console.error('[BranchSync] Stale check failed:', err.message); }
  });

  console.log(`[BranchSync] HQ stale-branch alert scheduled — daily at ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
}

// ── POST /api/branch-sync/test-alert ─────────────────────────────────────────
// HQ admin: send a test alert email to verify the alert pipeline is configured

router.post('/test-alert', requireAdmin, async (req, res) => {
  try {
    const { multi_branch_role: role } = await getInstanceRole();
    if (role !== 'hq') return res.status(403).json({ error: 'This instance is not configured as HQ' });
    if (!process.env.HQ_ALERT_EMAIL)
      return res.status(400).json({ error: 'Set HQ_ALERT_EMAIL in Railway Variables to enable alerts.' });

    const stale  = await findStaleBranches();
    const result = await sendStaleAlert(stale, { force: true });
    if (!result.ok) return res.status(400).json(result);
    res.json({ ...result, stale_count: stale.length, alert_email: process.env.HQ_ALERT_EMAIL });
  } catch (err) {
    console.error('[BranchSync] test-alert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.startBranchCron  = startBranchCron;
module.exports.startHQAlertCron = startHQAlertCron;
module.exports.pushToHQ         = pushToHQ;
module.exports.checkStaleBranches = checkStaleBranches;
