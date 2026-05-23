const express = require('express');
const cors    = require('cors');
const path    = require('path');
const session = require('express-session');
const https   = require('https');
const http    = require('http');
const { initDB } = require('./db/database');

const app  = express();
const PORT = process.env.PORT || 3001;

try {
  initDB();
  console.log('✅ Database initialised at', process.env.DB_PATH || 'accounting.db (local)');
} catch (err) {
  console.error('❌ Database init failed:', err.message);
  process.exit(1);
}

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
const ROLE_LEVELS = { staff: 1, manager: 2, finance: 3, admin: 4, super_admin: 5 };

function userLevel(req) {
  const role = req.session.user?.role || 'admin';
  return ROLE_LEVELS[role] || 0;
}

// ── UAM validation helper ─────────────────────────────────────────────────────
function validateViaUAM(email, password, clientSlug) {
  return new Promise((resolve, reject) => {
    const uamUrl = new URL(`${process.env.UAM_URL}/api/validate`);
    const body   = JSON.stringify({ email, password, client_slug: clientSlug });
    const lib    = uamUrl.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: uamUrl.hostname,
      port:     uamUrl.port || (uamUrl.protocol === 'https:' ? 443 : 80),
      path:     uamUrl.pathname,
      method:   'POST',
      headers: {
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-API-Key':     process.env.UAM_API_SECRET || '',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid UAM response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Auth routes (public) ──────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (process.env.UAM_URL && process.env.UAM_API_SECRET && process.env.CLIENT_SLUG) {
    // ── UAM mode: validate against the central UAM service ────────────────
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    try {
      const result = await validateViaUAM(email, password, process.env.CLIENT_SLUG);
      if (!result.valid) {
        return res.status(401).json({ error: result.error || 'Invalid credentials' });
      }
      req.session.authenticated = true;
      req.session.user = {
        email:    result.user.email,
        name:     result.user.full_name || result.user.email,
        role:     result.user.role,
      };
      return res.json({ success: true, user: req.session.user });
    } catch (err) {
      console.error('UAM validation error:', err.message);
      return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
    }
  }

  // ── Fallback mode: single APP_PASSWORD ────────────────────────────────────
  const APP_PASSWORD = process.env.APP_PASSWORD;
  if (!APP_PASSWORD) {
    return res.status(500).json({ error: 'APP_PASSWORD environment variable is not set on the server.' });
  }
  if (password === APP_PASSWORD) {
    req.session.authenticated = true;
    req.session.user = { email: email || 'admin', name: 'Admin', role: 'admin' };
    return res.json({ success: true, user: req.session.user });
  }
  return res.status(401).json({ error: 'Incorrect password. Please try again.' });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session.authenticated) {
    res.json({ authenticated: true, user: req.session.user || null });
  } else {
    res.status(401).json({ authenticated: false });
  }
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
  const level  = userLevel(req);
  const p      = req.path;   // relative to /api
  const method = req.method;

  // Admin+: delete journal entries, delete payments, delete inventory, change settings
  if (method === 'DELETE' && p.startsWith('/entries/')) {
    if (level < ROLE_LEVELS.admin) return res.status(403).json({ error: 'Admin access required to delete journal entries' });
  }
  if (method === 'DELETE' && (p.startsWith('/payments/receivables/') || p.startsWith('/payments/payables/'))) {
    if (level < ROLE_LEVELS.admin) return res.status(403).json({ error: 'Admin access required to delete payments' });
  }
  if (method === 'DELETE' && p.startsWith('/inventory/')) {
    if (level < ROLE_LEVELS.admin) return res.status(403).json({ error: 'Admin access required to delete inventory items' });
  }
  if (method === 'PUT' && p === '/settings') {
    if (level < ROLE_LEVELS.admin) return res.status(403).json({ error: 'Admin access required to change settings' });
  }

  // Finance+: post journal entries, import CSV
  if (method === 'POST' && p === '/entries') {
    if (level < ROLE_LEVELS.finance) return res.status(403).json({ error: 'Finance role required to post journal entries' });
  }
  if (method === 'POST' && p === '/entries/import/csv') {
    if (level < ROLE_LEVELS.finance) return res.status(403).json({ error: 'Finance role required to import journal entries' });
  }

  // Manager+: create/edit payments and inventory
  if ((method === 'POST' || method === 'PUT') && p.startsWith('/payments/')) {
    if (level < ROLE_LEVELS.manager) return res.status(403).json({ error: 'Manager role required to manage payments' });
  }
  if ((method === 'POST' || method === 'PUT') && p.startsWith('/inventory')) {
    if (level < ROLE_LEVELS.manager) return res.status(403).json({ error: 'Manager role required to manage inventory' });
  }

  next();
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

// ── Serve built React app in production ──────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
  });
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
