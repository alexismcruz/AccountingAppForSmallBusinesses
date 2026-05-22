const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const { initDB } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3001;

initDB();

// Trust Railway's reverse proxy so secure cookies work over HTTPS
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
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// ── Auth routes (public — no login required) ────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  const APP_PASSWORD = process.env.APP_PASSWORD;
  if (!APP_PASSWORD) {
    return res.status(500).json({ error: 'APP_PASSWORD environment variable is not set on the server.' });
  }
  if (password === APP_PASSWORD) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Incorrect password. Please try again.' });
  }
});

app.get('/api/auth/me', (req, res) => {
  if (req.session.authenticated) {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ── Auth guard — all /api routes below this line require login ───────────
app.use('/api', (req, res, next) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
});

app.use('/api/accounts',      require('./routes/accounts'));
app.use('/api/entries',       require('./routes/entries'));
app.use('/api/inventory',     require('./routes/inventory'));
app.use('/api/payments',      require('./routes/payments'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/settings',      require('./routes/settings'));
app.use('/api/fiscal',        require('./routes/fiscal'));
app.use('/api/exchange-rate', require('./routes/exchangeRate'));

// ── Serve built React app in production ─────────────────────────────────
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
  console.log(`\n  API Server : http://localhost:${PORT}/api`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`  Open App   : http://localhost:5173`);
    if (!process.env.APP_PASSWORD) {
      console.log('\n  ⚠  APP_PASSWORD not set — login is disabled in dev mode');
      console.log('  Set APP_PASSWORD=yourpassword to enable auth locally\n');
    }
  }
  console.log('\n');
});
