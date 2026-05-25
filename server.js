const express = require('express');
const cors    = require('cors');
const path    = require('path');
const session = require('express-session');
const { initDB, query, pool } = require('./db/database');

const app  = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3001'], credentials: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

// ── Role levels ───────────────────────────────────────────────────────────────
const ROLE_LEVELS = { staff: 1, manager: 2, finance: 3, admin: 2, super_admin: 5 };

function userRole(req)  { return req.session.user?.role  || 'staff'; }
function userLevel(req) { return ROLE_LEVELS[userRole(req)] || 0; }

// ── UAM validation helper ─────────────────────────────────────────────────────
async function validateViaUAM(email, password, clientSlug) {
  const uamBase = process.env.UAM_URL.replace(/\/$/, '');
  const res = await fetch(`${uamBase}/api/validate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.UAM_API_SECRET || '' },
    body:    JSON.stringify({ email, password, client_slug: clientSlug }),
    signal:  AbortSignal.timeout(15000),
  });
  return res.json();
}

// ── Password strength validation ──────────────────────────────────────────────
function validatePasswordStrength(password) {
  if (!password)            return 'Password is required';
  if (password.length < 8)  return 'Password must be at least 8 characters';
  if (password.length > 20) return 'Password must not exceed 20 characters';
  if (/\s/.test(password))  return 'Password must not contain spaces';
  if (!/[0-9]/.test(password))
    return 'Password must contain at least one number';
  if (!/[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(password))
    return 'Password must contain at least one special character (e.g. !@#$%)';
  return null;
}

// ── Auth routes (public) ──────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (process.env.UAM_URL && process.env.UAM_API_SECRET && process.env.CLIENT_SLUG) {
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });
    try {
      const result = await validateViaUAM(email, password, process.env.CLIENT_SLUG);
      if (!result.valid) return res.status(401).json({ error: result.error || 'Invalid credentials' });
      req.session.authenticated = true;
      req.session.user = {
        id:    result.user.id,
        email: result.user.email,
        name:  result.user.full_name || result.user.email,
        role:  result.user.role,
      };
      req.session.tax_system    = result.client?.tax_system    || null;
      req.session.business_type = result.client?.business_type || null;
      const { logAction } = require('./utils/auditLog');
      logAction(req.session.user, 'LOGIN', 'auth', null, null, { mode: 'uam' });
      return res.json({ success: true, user: req.session.user });
    } catch (err) {
      console.error('UAM validation error:', err.message);
      return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
    }
  }

  // Fallback: single APP_PASSWORD
  const APP_PASSWORD = process.env.APP_PASSWORD;
  if (!APP_PASSWORD)
    return res.status(500).json({ error: 'APP_PASSWORD environment variable is not set on the server.' });
  if (password === APP_PASSWORD) {
    req.session.authenticated = true;
    req.session.user = { email: email || 'admin', name: 'Admin', role: 'admin' };
    return res.json({ success: true, user: req.session.user });
  }
  return res.status(401).json({ error: 'Incorrect password. Please try again.' });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session.authenticated) res.json({ authenticated: true, user: req.session.user || null });
  else res.status(401).json({ authenticated: false });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ── Auth guard ────────────────────────────────────────────────────────────────
app.use('/api', (req, res, next) => {
  if (!req.session.authenticated) return res.status(401).json({ error: 'Not authenticated' });
  next();
});

// ── Role-based route guards ───────────────────────────────────────────────────
app.use('/api', (req, res, next) => {
  const role   = userRole(req);
  const p      = req.path;
  const method = req.method;
  const WRITE  = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (role === 'admin' && WRITE.includes(method)) {
    const restricted = ['/entries', '/payments', '/inventory'];
    if (restricted.some(r => p.startsWith(r)))
      return res.status(403).json({ error: 'Admin role is view-only — changes require Staff, Manager, or Finance access' });
  }

  if (method === 'PUT' && p === '/settings') {
    if (!['finance', 'admin', 'super_admin'].includes(role))
      return res.status(403).json({ error: 'Finance role or above required to change settings' });
  }

  if (method === 'POST' && p === '/entries/import/csv') {
    if (!['finance', 'super_admin'].includes(role))
      return res.status(403).json({ error: 'Finance role required to import journal entries' });
  }

  next();
});

// ── Change password ───────────────────────────────────────────────────────────
app.post('/api/auth/change-password', async (req, res) => {
  const user = req.session.user;
  const { current_password, new_password, confirm_password } = req.body;

  if (!current_password || !new_password || !confirm_password)
    return res.status(400).json({ error: 'All three fields are required' });
  if (new_password !== confirm_password)
    return res.status(400).json({ error: 'New password and confirmation do not match' });
  if (new_password === current_password)
    return res.status(400).json({ error: 'New password must be different from your current password' });

  const strengthErr = validatePasswordStrength(new_password);
  if (strengthErr) return res.status(400).json({ error: strengthErr });

  if (!(process.env.UAM_URL && process.env.UAM_API_SECRET))
    return res.status(400).json({ error: 'Password change is not available in single-password mode. Update the APP_PASSWORD environment variable instead.' });

  try {
    const uamBase = process.env.UAM_URL.replace(/\/$/, '');
    const r = await fetch(`${uamBase}/api/validate/change-password`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.UAM_API_SECRET },
      body:    JSON.stringify({ email: user.email, current_password, new_password }),
      signal:  AbortSignal.timeout(15000),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error });
    const { logAction } = require('./utils/auditLog');
    logAction(user, 'CHANGE_PASSWORD', 'auth', null, null);
    res.json({ ok: true });
  } catch (err) {
    console.error('UAM change-password error:', err.message);
    res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
  }
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/accounts',      require('./routes/accounts'));
app.use('/api/entries',       require('./routes/entries'));
app.use('/api/inventory',     require('./routes/inventory'));
app.use('/api/payments',      require('./routes/payments'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/settings',      require('./routes/settings'));
app.use('/api/fiscal',        require('./routes/fiscal'));
app.use('/api/exchange-rate', require('./routes/exchangeRate'));
app.use('/api/approvals',     require('./routes/approvals'));
app.use('/api/logs',          require('./routes/logs'));
app.use('/api/invoices',      require('./routes/invoices'));
app.use('/api/sandbox',       require('./routes/sandbox'));
app.use('/api/tax',           require('./routes/tax'));

// ── Serve built React app in production ──────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'client/dist/index.html')));
}

// ── Start server ──────────────────────────────────────────────────────────────
(async () => {
  try {
    await initDB();
    console.log('✅ PostgreSQL database initialised');

    // Sandbox: seed demo data on first boot
    if (process.env.SANDBOX_MODE) {
      const { rows: [biz] } = await query('SELECT business_name FROM business_settings WHERE id = 1');
      if (!biz || biz.business_name === 'My Business') {
        const { seedSandboxData } = require('./db/sandboxSeed');
        await seedSandboxData(pool);
        console.log('🧪 Sandbox: demo data seeded for XYZ Trading Co.');
      } else {
        console.log('🧪 Sandbox mode active — existing data preserved');
      }
    }

    app.listen(PORT, () => {
      console.log('\n====================================');
      console.log('  Small Business Accounting App');
      console.log('====================================');
      console.log(`\n  API Server: http://localhost:${PORT}/api`);
      const mode = process.env.UAM_URL ? `UAM (${process.env.UAM_URL})` : 'Single password (APP_PASSWORD)';
      console.log(`  Auth mode : ${mode}`);
      if (process.env.NODE_ENV !== 'production') console.log(`  Open App  : http://localhost:5173`);
      console.log('\n');
    });
  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    process.exit(1);
  }
})();
