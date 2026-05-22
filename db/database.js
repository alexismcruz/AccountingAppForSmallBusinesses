const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'accounting.db');

// Ensure the directory exists (important when Railway Volume is mounted at /data)
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let db;

function getDB() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

// Run a function inside a BEGIN/COMMIT transaction
function runTransaction(fn) {
  const db = getDB();
  db.exec('BEGIN');
  try {
    const result = fn(db);
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function initDB() {
  const db = getDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      normal_balance TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      reference TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'posted',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS journal_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT DEFAULT 'pcs',
      quantity REAL DEFAULT 0,
      unit_cost REAL DEFAULT 0,
      reorder_point REAL DEFAULT 10,
      is_active INTEGER DEFAULT 1,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS receivables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      invoice_number TEXT UNIQUE NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      due_date TEXT,
      status TEXT DEFAULT 'pending',
      paid_amount REAL DEFAULT 0,
      entry_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES journal_entries(id)
    );

    CREATE TABLE IF NOT EXISTS payables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      reference_number TEXT,
      description TEXT,
      amount REAL NOT NULL,
      due_date TEXT,
      status TEXT DEFAULT 'pending',
      paid_amount REAL DEFAULT 0,
      entry_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES journal_entries(id)
    );

    CREATE TABLE IF NOT EXISTS business_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      business_name TEXT DEFAULT 'My Business',
      registration_number TEXT DEFAULT '',
      address TEXT DEFAULT '',
      tax_id TEXT DEFAULT '',
      currency TEXT DEFAULT 'USD',
      currency_symbol TEXT DEFAULT '$',
      fiscal_year_start TEXT DEFAULT '01-01',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations — safe to run on existing databases (errors from "already exists" are swallowed)
  const migrations = [
    "ALTER TABLE journal_entries ADD COLUMN currency TEXT DEFAULT 'USD'",
    "ALTER TABLE journal_entries ADD COLUMN exchange_rate REAL DEFAULT 1.0",
    "ALTER TABLE journal_entries ADD COLUMN entry_type TEXT DEFAULT 'regular'",
    "ALTER TABLE journal_lines ADD COLUMN base_debit REAL",
    "ALTER TABLE journal_lines ADD COLUMN base_credit REAL",
    "ALTER TABLE receivables ADD COLUMN currency TEXT DEFAULT 'USD'",
    "ALTER TABLE receivables ADD COLUMN exchange_rate REAL DEFAULT 1.0",
    "ALTER TABLE receivables ADD COLUMN scheduled_date TEXT",
    "ALTER TABLE payables ADD COLUMN currency TEXT DEFAULT 'USD'",
    "ALTER TABLE payables ADD COLUMN exchange_rate REAL DEFAULT 1.0",
    "ALTER TABLE payables ADD COLUMN scheduled_date TEXT",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (_) { /* column already exists */ }
  }
  // Back-fill base amounts for existing rows that pre-date multi-currency support
  db.exec("UPDATE journal_lines SET base_debit = debit, base_credit = credit WHERE base_debit IS NULL");

  const accountCount = db.prepare('SELECT COUNT(*) as c FROM accounts').get();
  if (accountCount.c === 0) seedAccounts(db);

  const settingsCount = db.prepare('SELECT COUNT(*) as c FROM business_settings').get();
  if (settingsCount.c === 0) {
    db.prepare('INSERT INTO business_settings (id) VALUES (1)').run();
  }

  // Seed initial cash balance of SGD 2,000 (Owner's investment) if no entries exist yet
  const entryCount = db.prepare('SELECT COUNT(*) as c FROM journal_entries').get();
  if (entryCount.c === 0) {
    const today = new Date().toISOString().split('T')[0];
    const entry = db.prepare(
      `INSERT INTO journal_entries (date, reference, description, currency, exchange_rate, entry_type)
       VALUES (?, 'INIT-001', 'Initial cash balance - Owner investment', 'SGD', 1.0, 'regular')`
    ).run(today);
    const entryId = entry.lastInsertRowid;
    const cash    = db.prepare("SELECT id FROM accounts WHERE code = '1000'").get();
    const capital = db.prepare("SELECT id FROM accounts WHERE code = '3000'").get();
    const line    = db.prepare(
      `INSERT INTO journal_lines (entry_id, account_id, debit, credit, base_debit, base_credit)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    line.run(entryId, cash.id,    2000, 0,    2000, 0);
    line.run(entryId, capital.id, 0,    2000, 0,    2000);
  }
}

function seedAccounts(db) {
  const accounts = [
    // ── ASSETS ──────────────────────────────────────────────────────────────
    { code: '1000', name: 'Cash', type: 'Asset', normal_balance: 'Debit',
      description: 'Money physically on hand in your business — bills and coins in your register, safe, or petty cash box.' },
    { code: '1010', name: 'Bank Account - Checking', type: 'Asset', normal_balance: 'Debit',
      description: 'Money in your business checking account used for day-to-day payments and collections.' },
    { code: '1020', name: 'Bank Account - Savings', type: 'Asset', normal_balance: 'Debit',
      description: 'Money in your business savings account, typically kept as a reserve or emergency fund.' },
    { code: '1100', name: 'Accounts Receivable', type: 'Asset', normal_balance: 'Debit',
      description: 'Money that customers owe you for goods or services already delivered but not yet paid. This is money coming IN to you.' },
    { code: '1200', name: 'Merchandise Inventory', type: 'Asset', normal_balance: 'Debit',
      description: 'The total value of products and goods you currently have in stock that are ready to be sold.' },
    { code: '1300', name: 'Supplies', type: 'Asset', normal_balance: 'Debit',
      description: 'Office and operational supplies (paper, pens, packaging materials) that you have bought but not yet used.' },
    { code: '1400', name: 'Prepaid Expenses', type: 'Asset', normal_balance: 'Debit',
      description: 'Expenses paid in advance that cover future periods — for example, paying a full year of insurance upfront.' },
    { code: '1500', name: 'Equipment', type: 'Asset', normal_balance: 'Debit',
      description: 'Physical tools, machines, computers, or devices that your business owns and uses to operate.' },
    { code: '1510', name: 'Accumulated Depreciation - Equipment', type: 'Asset', normal_balance: 'Credit',
      description: 'The total reduction in your equipment\'s value over time due to wear and use. This is subtracted from Equipment on the Balance Sheet.' },
    { code: '1600', name: 'Furniture & Fixtures', type: 'Asset', normal_balance: 'Debit',
      description: 'Desks, chairs, shelving, display cases, counters, and other permanent furnishings used in your business.' },
    { code: '1700', name: 'Vehicles', type: 'Asset', normal_balance: 'Debit',
      description: 'Cars, trucks, vans, or motorcycles owned by the business and used for deliveries or operations.' },
    // ── LIABILITIES ─────────────────────────────────────────────────────────
    { code: '2000', name: 'Accounts Payable', type: 'Liability', normal_balance: 'Credit',
      description: 'Money you owe to suppliers for goods or services you have received but have not yet paid for.' },
    { code: '2100', name: 'Accrued Expenses Payable', type: 'Liability', normal_balance: 'Credit',
      description: 'Expenses you have already incurred but not yet paid — for example, utilities you used but whose bill hasn\'t arrived yet.' },
    { code: '2200', name: 'Income Tax Payable', type: 'Liability', normal_balance: 'Credit',
      description: 'Income taxes owed to the government based on your business profits that have not yet been paid.' },
    { code: '2300', name: 'Sales Tax Payable', type: 'Liability', normal_balance: 'Credit',
      description: 'Sales tax collected from your customers that you are temporarily holding until you remit it to the government.' },
    { code: '2400', name: 'Loans Payable - Short Term', type: 'Liability', normal_balance: 'Credit',
      description: 'Business loans that must be fully repaid within the next 12 months.' },
    { code: '2500', name: 'Loans Payable - Long Term', type: 'Liability', normal_balance: 'Credit',
      description: 'Business loans with repayment terms longer than one year, such as a business mortgage or equipment financing.' },
    // ── EQUITY ──────────────────────────────────────────────────────────────
    { code: '3000', name: "Owner's Capital", type: 'Equity', normal_balance: 'Credit',
      description: 'The total amount the owner has personally invested into the business. It grows when you add money and shrinks when you take money out.' },
    { code: '3100', name: "Owner's Drawings", type: 'Equity', normal_balance: 'Debit',
      description: 'Money or assets the owner takes out of the business for personal use. This reduces the owner\'s stake in the business.' },
    { code: '3200', name: 'Retained Earnings', type: 'Equity', normal_balance: 'Credit',
      description: 'Accumulated profits from past periods that were kept in the business rather than paid out to the owner.' },
    // ── REVENUE ─────────────────────────────────────────────────────────────
    { code: '4000', name: 'Sales Revenue', type: 'Revenue', normal_balance: 'Credit',
      description: 'Income earned from selling products or merchandise to customers. This is your main business income.' },
    { code: '4100', name: 'Service Revenue', type: 'Revenue', normal_balance: 'Credit',
      description: 'Income earned from providing services to customers (repair, consulting, delivery, installation, etc.).' },
    { code: '4200', name: 'Other Income', type: 'Revenue', normal_balance: 'Credit',
      description: 'Income from sources other than your main business activity — for example, rent received, interest earned, or selling old equipment.' },
    // ── COST OF GOODS SOLD ──────────────────────────────────────────────────
    { code: '5000', name: 'Cost of Goods Sold', type: 'COGS', normal_balance: 'Debit',
      description: 'The direct cost to purchase or produce the products you sell. Subtracting this from Sales Revenue gives you your Gross Profit.' },
    // ── EXPENSES ────────────────────────────────────────────────────────────
    { code: '6000', name: 'Salaries & Wages Expense', type: 'Expense', normal_balance: 'Debit',
      description: 'Money paid to employees for their work, including regular pay, bonuses, and overtime.' },
    { code: '6100', name: 'Rent Expense', type: 'Expense', normal_balance: 'Debit',
      description: 'The monthly or periodic cost to rent your business location, office space, or warehouse.' },
    { code: '6200', name: 'Utilities Expense', type: 'Expense', normal_balance: 'Debit',
      description: 'Costs for electricity, water, gas, internet, and telephone services used in running your business.' },
    { code: '6300', name: 'Office Supplies Expense', type: 'Expense', normal_balance: 'Debit',
      description: 'The cost of consumable office items (paper, printer ink, pens, folders) that have been used up during the period.' },
    { code: '6400', name: 'Marketing & Advertising Expense', type: 'Expense', normal_balance: 'Debit',
      description: 'Costs to promote your business — online ads, flyers, social media boosts, signage, and promotional materials.' },
    { code: '6500', name: 'Business Registration & Licenses', type: 'Expense', normal_balance: 'Debit',
      description: 'Government fees and permits required to legally register and operate your business (DTI, SEC, BIR, Mayor\'s Permit, etc.).' },
    { code: '6600', name: 'Insurance Expense', type: 'Expense', normal_balance: 'Debit',
      description: 'The portion of insurance premiums covering the current period — fire, theft, liability, or health insurance for the business.' },
    { code: '6700', name: 'Depreciation Expense', type: 'Expense', normal_balance: 'Debit',
      description: 'The gradual "using up" of equipment value, recorded as an expense each period to spread the cost over the equipment\'s useful life.' },
    { code: '6800', name: 'Bank Charges & Fees', type: 'Expense', normal_balance: 'Debit',
      description: 'Fees charged by your bank for account maintenance, wire transfers, ATM withdrawals, and other banking services.' },
    { code: '6900', name: 'Transportation & Delivery Expense', type: 'Expense', normal_balance: 'Debit',
      description: 'Costs to deliver products to customers, ship goods, or transport materials for your business.' },
    { code: '7000', name: 'Repairs & Maintenance Expense', type: 'Expense', normal_balance: 'Debit',
      description: 'Costs to repair or maintain your equipment, furniture, or business premises to keep them in working condition.' },
    { code: '7100', name: 'Professional Fees', type: 'Expense', normal_balance: 'Debit',
      description: 'Fees paid to accountants, lawyers, consultants, or other professionals for services rendered to your business.' },
    { code: '7200', name: 'Miscellaneous Expense', type: 'Expense', normal_balance: 'Debit',
      description: 'Small, infrequent expenses that do not fit neatly into any other specific category.' },
  ];

  const stmt = db.prepare(
    'INSERT INTO accounts (code, name, type, normal_balance, description) VALUES (?, ?, ?, ?, ?)'
  );
  for (const a of accounts) {
    stmt.run(a.code, a.name, a.type, a.normal_balance, a.description);
  }
}

module.exports = { getDB, initDB, runTransaction };
