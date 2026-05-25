const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Simple query helper — returns pg result { rows, rowCount } ─────────────────
function query(text, params) {
  return pool.query(text, params);
}

// ── Transaction helper ────────────────────────────────────────────────────────
// fn receives a pg client; use client.query() inside to stay in the transaction
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ── Schema initialisation ─────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id             SERIAL PRIMARY KEY,
      code           TEXT UNIQUE NOT NULL,
      name           TEXT NOT NULL,
      type           TEXT NOT NULL,
      normal_balance TEXT NOT NULL,
      description    TEXT,
      is_active      INTEGER DEFAULT 1,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id               SERIAL PRIMARY KEY,
      date             TEXT NOT NULL,
      reference        TEXT UNIQUE NOT NULL,
      description      TEXT NOT NULL,
      status           TEXT DEFAULT 'posted',
      currency         TEXT DEFAULT 'USD',
      exchange_rate    DOUBLE PRECISION DEFAULT 1.0,
      entry_type       TEXT DEFAULT 'regular',
      created_by_email TEXT DEFAULT 'system',
      created_by_name  TEXT DEFAULT 'System',
      created_by_role  TEXT DEFAULT 'admin',
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS journal_lines (
      id          SERIAL PRIMARY KEY,
      entry_id    INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
      account_id  INTEGER NOT NULL REFERENCES accounts(id),
      debit       DOUBLE PRECISION DEFAULT 0,
      credit      DOUBLE PRECISION DEFAULT 0,
      base_debit  DOUBLE PRECISION,
      base_credit DOUBLE PRECISION,
      notes       TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id               SERIAL PRIMARY KEY,
      sku              TEXT UNIQUE NOT NULL,
      name             TEXT NOT NULL,
      category         TEXT,
      unit             TEXT DEFAULT 'pcs',
      quantity         DOUBLE PRECISION DEFAULT 0,
      unit_cost        DOUBLE PRECISION DEFAULT 0,
      reorder_point    DOUBLE PRECISION DEFAULT 10,
      is_active        INTEGER DEFAULT 1,
      pending_approval INTEGER DEFAULT 0,
      pending_deletion INTEGER DEFAULT 0,
      created_by_email TEXT DEFAULT 'system',
      created_by_name  TEXT DEFAULT 'System',
      created_by_role  TEXT DEFAULT 'admin',
      notes            TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS receivables (
      id               SERIAL PRIMARY KEY,
      customer_name    TEXT NOT NULL,
      invoice_number   TEXT UNIQUE NOT NULL,
      description      TEXT,
      amount           DOUBLE PRECISION NOT NULL,
      due_date         TEXT,
      scheduled_date   TEXT,
      status           TEXT DEFAULT 'pending',
      paid_amount      DOUBLE PRECISION DEFAULT 0,
      currency         TEXT DEFAULT 'USD',
      exchange_rate    DOUBLE PRECISION DEFAULT 1.0,
      entry_id         INTEGER REFERENCES journal_entries(id),
      pending_approval INTEGER DEFAULT 0,
      pending_deletion INTEGER DEFAULT 0,
      created_by_email TEXT DEFAULT 'system',
      created_by_name  TEXT DEFAULT 'System',
      created_by_role  TEXT DEFAULT 'admin',
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payables (
      id               SERIAL PRIMARY KEY,
      supplier_name    TEXT NOT NULL,
      reference_number TEXT,
      description      TEXT,
      amount           DOUBLE PRECISION NOT NULL,
      due_date         TEXT,
      scheduled_date   TEXT,
      status           TEXT DEFAULT 'pending',
      paid_amount      DOUBLE PRECISION DEFAULT 0,
      currency         TEXT DEFAULT 'USD',
      exchange_rate    DOUBLE PRECISION DEFAULT 1.0,
      entry_id         INTEGER REFERENCES journal_entries(id),
      pending_approval INTEGER DEFAULT 0,
      pending_deletion INTEGER DEFAULT 0,
      created_by_email TEXT DEFAULT 'system',
      created_by_name  TEXT DEFAULT 'System',
      created_by_role  TEXT DEFAULT 'admin',
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS business_settings (
      id                  INTEGER PRIMARY KEY DEFAULT 1,
      business_name       TEXT DEFAULT 'My Business',
      registration_number TEXT DEFAULT '',
      address             TEXT DEFAULT '',
      tax_id              TEXT DEFAULT '',
      currency            TEXT DEFAULT 'PHP',
      currency_symbol     TEXT DEFAULT '₱',
      fiscal_year_start   TEXT DEFAULT '01-01',
      tax_system          TEXT DEFAULT 'generic',
      business_type       TEXT DEFAULT 'corporate',
      updated_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Tax tables ──────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tax_rates (
      id                   SERIAL PRIMARY KEY,
      name                 TEXT NOT NULL,
      code                 TEXT UNIQUE NOT NULL,
      type                 TEXT NOT NULL CHECK(type IN ('percentage','fixed_amount','tiered')),
      rate                 DOUBLE PRECISION DEFAULT 0,
      amount               DOUBLE PRECISION DEFAULT 0,
      tiers                JSONB,
      applies_to           TEXT NOT NULL DEFAULT 'both' CHECK(applies_to IN ('sales','purchases','both')),
      is_inclusive         INTEGER DEFAULT 0,
      exempt_threshold     DOUBLE PRECISION DEFAULT 0,
      tax_account_id       INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      is_active            INTEGER DEFAULT 1,
      effective_from       TEXT,
      effective_to         TEXT,
      filing_frequency     TEXT DEFAULT 'monthly' CHECK(filing_frequency IN ('monthly','quarterly','annual')),
      description          TEXT,
      business_type_filter TEXT DEFAULT 'all',
      created_at           TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tax_applications (
      id               SERIAL PRIMARY KEY,
      tax_rate_id      INTEGER NOT NULL REFERENCES tax_rates(id) ON DELETE CASCADE,
      entity_type      TEXT NOT NULL CHECK(entity_type IN ('receivable','payable')),
      entity_id        INTEGER NOT NULL,
      base_amount      DOUBLE PRECISION NOT NULL,
      tax_amount       DOUBLE PRECISION NOT NULL,
      journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL,
      notes            TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tax_filings (
      id               SERIAL PRIMARY KEY,
      tax_rate_id      INTEGER REFERENCES tax_rates(id) ON DELETE SET NULL,
      period_type      TEXT NOT NULL CHECK(period_type IN ('monthly','quarterly','annual')),
      period_start     TEXT NOT NULL,
      period_end       TEXT NOT NULL,
      total_tax_amount DOUBLE PRECISION DEFAULT 0,
      status           TEXT DEFAULT 'pending' CHECK(status IN ('pending','filed','paid')),
      filed_at         TIMESTAMPTZ,
      paid_at          TIMESTAMPTZ,
      reference        TEXT,
      notes            TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Migrate business_settings ──────────────────────────────────────────────
  await pool.query(`ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS tax_system     TEXT DEFAULT 'generic'`);
  await pool.query(`ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS business_type  TEXT DEFAULT 'corporate'`);
  // Update default currency from USD to PHP for any row that still has the old default
  await pool.query(`UPDATE business_settings SET currency = 'PHP', currency_symbol = '₱' WHERE id = 1 AND currency = 'USD' AND currency_symbol = '$'`);

  // ── Migrate tax_rates: add business_type_filter + fix known BIR codes ──────
  await pool.query(`ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS business_type_filter TEXT DEFAULT 'all'`);
  // Corporate-only: CIT applies only to registered corporations
  await pool.query(`UPDATE tax_rates SET business_type_filter = 'corporate'  WHERE code = 'CIT-25'   AND business_type_filter = 'all'`);
  // Individual-only: PIT graduated rates for sole prop and mixed income earners
  await pool.query(`UPDATE tax_rates SET business_type_filter = 'individual' WHERE code = 'PIT-GRAD' AND business_type_filter = 'all'`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS approval_requests (
      id                 SERIAL PRIMARY KEY,
      type               TEXT NOT NULL,
      entity_id          INTEGER NOT NULL,
      entity_ref         TEXT,
      entity_snapshot    TEXT,
      submitted_by_email TEXT NOT NULL,
      submitted_by_name  TEXT,
      submitted_by_role  TEXT NOT NULL,
      submitter_note     TEXT,
      status             TEXT NOT NULL DEFAULT 'pending',
      reviewed_by_email  TEXT,
      reviewed_by_name   TEXT,
      reviewer_note      TEXT DEFAULT '',
      reviewed_at        TIMESTAMPTZ,
      created_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          SERIAL PRIMARY KEY,
      user_email  TEXT NOT NULL,
      user_name   TEXT,
      user_role   TEXT,
      action      TEXT NOT NULL,
      entity_type TEXT,
      entity_id   INTEGER,
      entity_ref  TEXT,
      details     TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Seed accounts if table is empty ────────────────────────────────────────
  const { rowCount: accountCount } = await pool.query('SELECT 1 FROM accounts LIMIT 1');
  if (accountCount === 0) await seedAccounts();

  // ── Ensure business_settings row exists ────────────────────────────────────
  await pool.query('INSERT INTO business_settings (id) VALUES (1) ON CONFLICT DO NOTHING');

  // ── Seed initial owner-investment entry if no entries exist ────────────────
  const { rowCount: entryCount } = await pool.query('SELECT 1 FROM journal_entries LIMIT 1');
  if (entryCount === 0) {
    const today = new Date().toISOString().split('T')[0];
    const { rows: [entry] } = await pool.query(`
      INSERT INTO journal_entries (date, reference, description, currency, exchange_rate, entry_type)
      VALUES ($1, 'INIT-001', 'Initial cash balance - Owner investment', 'SGD', 1.0, 'regular')
      RETURNING id
    `, [today]);

    const { rows: [cash] }    = await pool.query("SELECT id FROM accounts WHERE code = '1000'");
    const { rows: [capital] } = await pool.query("SELECT id FROM accounts WHERE code = '3000'");

    await pool.query(`
      INSERT INTO journal_lines (entry_id, account_id, debit, credit, base_debit, base_credit)
      VALUES ($1, $2, 2000, 0, 2000, 0),
             ($1, $3, 0, 2000, 0, 2000)
    `, [entry.id, cash.id, capital.id]);
  }
}

// ── Chart of accounts seed ───────────────────────────────────────────────────
async function seedAccounts() {
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

  for (const a of accounts) {
    await pool.query(
      `INSERT INTO accounts (code, name, type, normal_balance, description)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (code) DO NOTHING`,
      [a.code, a.name, a.type, a.normal_balance, a.description]
    );
  }
}

module.exports = { query, withTransaction, initDB, pool };
