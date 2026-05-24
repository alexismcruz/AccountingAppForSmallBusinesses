/**
 * Sandbox seed data — XYZ Trading Co.
 * Called on first boot (SANDBOX_MODE=true, fresh DB) and on manual reset.
 * Safe to call repeatedly: clears all transactional data first.
 */

function dAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
function dFwd(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function seedSandboxData(db) {
  // ── 1. Wipe all transactional tables ────────────────────────────────────────
  db.exec('DELETE FROM approval_requests');
  db.exec('DELETE FROM audit_logs');
  db.exec('DELETE FROM journal_lines');
  db.exec('DELETE FROM journal_entries');
  db.exec('DELETE FROM receivables');
  db.exec('DELETE FROM payables');
  db.exec('DELETE FROM inventory_items');
  try {
    db.exec(`DELETE FROM sqlite_sequence WHERE name IN (
      'approval_requests','audit_logs','journal_entries','journal_lines',
      'receivables','payables','inventory_items'
    )`);
  } catch (_) { /* sqlite_sequence may not exist on a brand-new DB */ }

  // ── 2. Business settings ─────────────────────────────────────────────────────
  db.prepare(`
    UPDATE business_settings SET
      business_name       = 'XYZ Trading Co.',
      registration_number = 'CS-2023-08421',
      address             = '88 Commerce Avenue\nMakati City, Metro Manila 1226\nPhilippines',
      tax_id              = '204-581-930-000',
      currency            = 'USD',
      currency_symbol     = '$',
      fiscal_year_start   = '01-01',
      updated_at          = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run();

  // ── 3. Inventory items ───────────────────────────────────────────────────────
  const insItem = db.prepare(`
    INSERT INTO inventory_items
      (sku, name, category, unit, quantity, unit_cost, reorder_point, notes,
       pending_approval, created_by_email, created_by_name, created_by_role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'system@sandbox', 'System', 'super_admin')
  `);

  const items = [
    ['WIDG-001', 'Standard Widget A',      'Widgets',     'pcs', 150,  12.50, 20, 'Best seller'],
    ['WIDG-002', 'Premium Widget Pro',      'Widgets',     'pcs',  42,  28.00, 15, 'High-margin item'],
    ['GDGT-001', 'Basic Gadget',            'Gadgets',     'pcs',  68,  45.00, 10, null],
    ['GDGT-002', 'Pro Gadget Plus',         'Gadgets',     'pcs',   7,  89.99, 10, 'Low stock — reorder soon'],
    ['ACCY-001', 'Accessory Bundle Set',    'Accessories', 'set',  35,  22.50, 10, null],
    ['ACCY-002', 'Replacement Parts Kit',   'Accessories', 'kit',   5,  15.00,  8, 'Below reorder point'],
    ['PKG-SM',   'Small Packaging Box',     'Packaging',   'pcs', 480,   2.50, 50, null],
    ['PKG-LG',   'Large Packaging Box',     'Packaging',   'pcs', 220,   4.75, 30, null],
    ['TOOL-001', 'Maintenance Tool Set',    'Tools',       'set',  12,  38.00,  5, null],
    ['PRMO-001', 'Branded Merchandise',     'Promotional', 'pcs', 100,   5.00, 25, 'Trade shows and events'],
  ];
  for (const [sku, name, cat, unit, qty, cost, reorder, notes] of items) {
    insItem.run(sku, name, cat, unit, qty, cost, reorder, notes);
  }

  // ── 4. Journal entries ───────────────────────────────────────────────────────
  // Build code→id lookup
  const acct = {};
  for (const a of db.prepare('SELECT code, id FROM accounts').all()) acct[a.code] = a.id;

  const insEntry = db.prepare(`
    INSERT INTO journal_entries
      (date, reference, description, status, currency, exchange_rate, entry_type,
       created_by_email, created_by_name, created_by_role)
    VALUES (?, ?, ?, 'posted', 'USD', 1.0, 'regular', 'system@sandbox', 'System', 'super_admin')
  `);
  const insLine = db.prepare(`
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, base_debit, base_credit)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  function addEntry(date, ref, desc, lines) {
    const { lastInsertRowid } = insEntry.run(date, ref, desc);
    for (const [code, dr, cr] of lines) {
      insLine.run(lastInsertRowid, acct[code], dr, cr, dr, cr);
    }
  }

  // JE-0001: Owner investment
  addEntry(dAgo(90), 'JE-0001', 'Owner investment — initial capital contribution', [
    ['1010', 50000,     0],
    ['3000',     0, 50000],
  ]);

  // JE-0002: Month-1 rent
  addEntry(dAgo(87), 'JE-0002', 'Monthly office rent — Month 1', [
    ['6100', 3500,    0],
    ['1010',    0, 3500],
  ]);

  // JE-0003: Equipment purchase
  addEntry(dAgo(83), 'JE-0003', 'Office equipment — computers and printers', [
    ['1500', 8500,    0],
    ['1010',    0, 8500],
  ]);

  // JE-0004: Initial inventory stock-up (cash)
  addEntry(dAgo(78), 'JE-0004', 'Initial inventory purchase — widgets and gadgets', [
    ['1200', 22000,     0],
    ['1010',     0, 22000],
  ]);

  // JE-0005: Cash sale
  addEntry(dAgo(72), 'JE-0005', 'Over-the-counter cash sales', [
    ['1000', 5400,    0],
    ['4000',    0, 5400],
  ]);

  // JE-0006: COGS for cash sale
  addEntry(dAgo(72), 'JE-0006', 'Cost of goods sold — cash sales', [
    ['5000', 2700,    0],
    ['1200',    0, 2700],
  ]);

  // JE-0007: Utilities
  addEntry(dAgo(70), 'JE-0007', 'Monthly utilities — electricity and internet', [
    ['6200', 520,   0],
    ['1000',   0, 520],
  ]);

  // JE-0008: Month-1 salaries
  addEntry(dAgo(63), 'JE-0008', 'Staff salaries and wages — Month 1', [
    ['6000', 9500,    0],
    ['1010',    0, 9500],
  ]);

  // JE-0009: Credit sale → Metro Supply Corp (INV-002)
  addEntry(dAgo(58), 'JE-0009', 'Credit sale — Metro Supply Corp (INV-002)', [
    ['1100', 5800,    0],
    ['4000',    0, 5800],
  ]);

  // JE-0010: COGS for Metro Supply sale
  addEntry(dAgo(58), 'JE-0010', 'Cost of goods sold — Metro Supply Corp', [
    ['5000', 2900,    0],
    ['1200',    0, 2900],
  ]);

  // JE-0011: Month-2 rent
  addEntry(dAgo(57), 'JE-0011', 'Monthly office rent — Month 2', [
    ['6100', 3500,    0],
    ['1010',    0, 3500],
  ]);

  // JE-0012: Credit sale → Sunrise Retail (INV-003, overdue)
  addEntry(dAgo(45), 'JE-0012', 'Credit sale — Sunrise Retail (INV-003)', [
    ['1100', 3200,    0],
    ['4000',    0, 3200],
  ]);

  // JE-0013: COGS for Sunrise Retail
  addEntry(dAgo(45), 'JE-0013', 'Cost of goods sold — Sunrise Retail', [
    ['5000', 1600,    0],
    ['1200',    0, 1600],
  ]);

  // JE-0014: Month-2 salaries
  addEntry(dAgo(33), 'JE-0014', 'Staff salaries and wages — Month 2', [
    ['6000', 9500,    0],
    ['1010',    0, 9500],
  ]);

  // JE-0015: Month-3 rent
  addEntry(dAgo(28), 'JE-0015', 'Monthly office rent — Month 3', [
    ['6100', 3500,    0],
    ['1010',    0, 3500],
  ]);

  // JE-0016: Inventory restock on credit
  addEntry(dAgo(20), 'JE-0016', 'Q3 inventory restock — widgets and gadgets (on credit)', [
    ['1200', 11500,     0],
    ['2000',     0, 11500],
  ]);

  // JE-0017: Marketing campaign
  addEntry(dAgo(14), 'JE-0017', 'Digital marketing — social media and online ads', [
    ['6400', 1800,    0],
    ['1010',    0, 1800],
  ]);

  // JE-0018: Credit sale → Pacific Distributors (INV-004)
  addEntry(dAgo(7), 'JE-0018', 'Credit sale — Pacific Distributors (INV-004)', [
    ['1100', 7200,    0],
    ['4000',    0, 7200],
  ]);

  // JE-0019: COGS for Pacific Distributors
  addEntry(dAgo(7), 'JE-0019', 'Cost of goods sold — Pacific Distributors', [
    ['5000', 3600,    0],
    ['1200',    0, 3600],
  ]);

  // JE-0020: Bank service charges
  addEntry(dAgo(3), 'JE-0020', 'Monthly bank service charges', [
    ['6800',  85,  0],
    ['1010',   0, 85],
  ]);

  // ── 5. Receivables (AR) ──────────────────────────────────────────────────────
  const insRec = db.prepare(`
    INSERT INTO receivables
      (customer_name, invoice_number, description, amount, due_date, status, paid_amount,
       currency, exchange_rate, pending_approval, created_by_email, created_by_name, created_by_role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'USD', 1.0, 0, 'system@sandbox', 'System', 'super_admin', ?)
  `);

  // INV-001: Paid in full
  insRec.run('Tech Solutions Inc.', 'INV-001',
    'Software components — Q1 bulk order', 3500, dAgo(50), 'paid', 3500, dAgo(80));

  // INV-002: Partially paid (Metro Supply Corp) — due 28 days ago, overdue
  insRec.run('Metro Supply Corp.', 'INV-002',
    'Widget assortment — bulk order', 5800, dAgo(28), 'partial', 2000, dAgo(58));

  // INV-003: Overdue (Sunrise Retail) — due 15 days ago, not paid
  insRec.run('Sunrise Retail', 'INV-003',
    'Gadget and accessory bundle', 3200, dAgo(15), 'pending', 0, dAgo(45));

  // INV-004: Upcoming (Pacific Distributors) — due in 15 days
  insRec.run('Pacific Distributors', 'INV-004',
    'Q3 product shipment — mixed widgets', 7200, dFwd(15), 'pending', 0, dAgo(7));

  // INV-005: Upcoming (City Merchants) — due in 30 days
  insRec.run('City Merchants Group', 'INV-005',
    'Premium widget collection — seasonal order', 4500, dFwd(30), 'pending', 0, dAgo(3));

  // ── 6. Payables (AP) ─────────────────────────────────────────────────────────
  const insPay = db.prepare(`
    INSERT INTO payables
      (supplier_name, reference_number, description, amount, due_date, status, paid_amount,
       currency, exchange_rate, pending_approval, created_by_email, created_by_name, created_by_role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'USD', 1.0, 0, 'system@sandbox', 'System', 'super_admin', ?)
  `);

  // BILL-001: Paid
  insPay.run('Globe Business Solutions', 'BILL-001',
    'Monthly phone and internet services', 580, dAgo(55), 'paid', 580, dAgo(65));

  // BILL-002: Overdue — freight charges
  insPay.run('FastTrack Logistics', 'BILL-002',
    'Freight and delivery charges — Q2 shipments', 1200, dAgo(10), 'pending', 0, dAgo(25));

  // BILL-003: Upcoming — Q3 inventory supplier
  insPay.run('Prime Wholesale Supply Co.', 'BILL-003',
    'Q3 inventory restock — PO-2024-047', 11500, dFwd(10), 'pending', 0, dAgo(20));

  // BILL-004: Upcoming — rent next month
  insPay.run('Makati Prime Realty Corp.', 'BILL-004',
    'Monthly office rent — next period', 3500, dFwd(25), 'pending', 0, dAgo(5));

  // ── 7. Pending approval requests (to demo the approvals page) ────────────────

  // A) Pending inventory item submitted by a staff user
  const newItemId = db.prepare(`
    INSERT INTO inventory_items
      (sku, name, category, unit, quantity, unit_cost, reorder_point, notes,
       pending_approval, created_by_email, created_by_name, created_by_role)
    VALUES ('NEW-001', 'Deluxe Component Pack', 'Components', 'kit', 25, 55.00, 10,
            'New supplier offering — high-margin product line', 1,
            'juana@xyztrading.com', 'Juana Santos', 'staff')
  `).run().lastInsertRowid;

  db.prepare(`
    INSERT INTO approval_requests
      (type, entity_id, entity_ref, entity_snapshot,
       submitted_by_email, submitted_by_name, submitted_by_role, submitter_note, status, created_at)
    VALUES ('create_inventory', ?, 'NEW-001', ?,
            'juana@xyztrading.com', 'Juana Santos', 'staff',
            'New supplier offered us this product line at very good margins. Requesting approval to add for Q4 push.',
            'pending', ?)
  `).run(newItemId,
    JSON.stringify({ sku: 'NEW-001', name: 'Deluxe Component Pack', category: 'Components',
                     unit: 'kit', quantity: 25, unit_cost: 55.00 }),
    dAgo(1));

  // B) Pending AR invoice submitted by a staff user
  const newRecId = db.prepare(`
    INSERT INTO receivables
      (customer_name, invoice_number, description, amount, due_date, status, paid_amount,
       currency, exchange_rate, pending_approval, created_by_email, created_by_name, created_by_role, created_at)
    VALUES ('North Star Retailers', 'INV-006', 'Special order — custom widget set',
            8500, ?, 'pending', 0, 'USD', 1.0, 1,
            'carlos@xyztrading.com', 'Carlos Reyes', 'staff', ?)
  `).run(dFwd(21), dAgo(0)).lastInsertRowid;

  db.prepare(`
    INSERT INTO approval_requests
      (type, entity_id, entity_ref, entity_snapshot,
       submitted_by_email, submitted_by_name, submitted_by_role, submitter_note, status, created_at)
    VALUES ('create_receivable', ?, 'INV-006', ?,
            'carlos@xyztrading.com', 'Carlos Reyes', 'staff',
            'New client, first large order. Credit check completed — sales manager has verbally approved.',
            'pending', ?)
  `).run(newRecId,
    JSON.stringify({ customer_name: 'North Star Retailers', invoice_number: 'INV-006',
                     description: 'Special order — custom widget set', amount: 8500,
                     due_date: dFwd(21), currency: 'USD' }),
    dAgo(0));
}

module.exports = { seedSandboxData };
