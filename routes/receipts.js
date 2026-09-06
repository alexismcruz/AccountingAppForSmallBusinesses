// Snap to Record — receipt image → draft journal entry.
//
// Reuses the existing Claude AI Assistant integration (same API key, same
// monthly cap) with a vision prompt tuned to extract structured data from a
// receipt. It NEVER auto-posts: every scan becomes a draft that enters the same
// Pending Approval workflow as manual and chat-drafted entries. The original
// image is stored in the client's own Postgres DB for audit reference.

const router = require('express').Router();
const { query, withTransaction } = require('../db/database');
const { logAction } = require('../utils/auditLog');
const { monthlyLimit, limitDisabled, getUsage, incrementUsage } = require('./_aiUsage');

// ── Config ──────────────────────────────────────────────────────────────────
const MAX_BYTES     = 8 * 1024 * 1024; // 8 MB decoded — matches client downscaling
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf'];

// Attachment storage lives in the same per-client database — no new storage service.
query(`
  CREATE TABLE IF NOT EXISTS receipt_attachments (
    id               SERIAL PRIMARY KEY,
    entry_id         INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE,
    filename         TEXT,
    media_type       TEXT,
    data             TEXT,          -- base64-encoded original image/PDF
    byte_size        INTEGER,
    extracted_json   TEXT,          -- the AI extraction, kept for audit
    created_by_email TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(err => console.error('[Receipts] receipt_attachments table error:', err.message));
query(`CREATE INDEX IF NOT EXISTS idx_receipt_attachments_entry ON receipt_attachments(entry_id)`)
  .catch(() => {});

// ── Direct vision call to Anthropic (same pattern as chatbot.js) ──────────────
async function callClaudeVision(systemPrompt, contentBlocks, tools) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:       'claude-haiku-4-5',
      max_tokens:  1500,
      system:      systemPrompt,
      tools,
      tool_choice: { type: 'tool', name: 'extract_receipt' }, // force structured output
      messages:    [{ role: 'user', content: contentBlocks }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

// ── Extraction tool ───────────────────────────────────────────────────────────
const EXTRACT_TOOL = {
  name: 'extract_receipt',
  description:
    'Return the structured data you can read from a receipt image or PDF. ' +
    'Only fill a field if you are confident about it — leave anything unclear as null ' +
    'and list its name in low_confidence_fields. Never guess an amount.',
  input_schema: {
    type: 'object',
    properties: {
      readable: {
        type: 'boolean',
        description: 'true if the image is a receipt/invoice with at least some legible content; false if it is blank, not a receipt, or completely unreadable.',
      },
      vendor:       { type: ['string', 'null'], description: 'Merchant / vendor / supplier name, or null if not legible.' },
      date:         { type: ['string', 'null'], description: 'Transaction date as YYYY-MM-DD, or null if not legible.' },
      currency:     { type: 'string',           description: 'ISO currency code of the amounts (e.g. PHP, USD, SGD). Default to the business currency if the receipt does not show one.' },
      total_amount: { type: ['number', 'null'], description: 'Grand total actually paid, as a number with no separators, or null if not confidently legible.' },
      suggested_expense_code: { type: ['string', 'null'], description: 'Best-fit expense/COGS account CODE from the Chart of Accounts for what was purchased, or null.' },
      suggested_expense_name: { type: ['string', 'null'], description: 'Exact account NAME matching suggested_expense_code, or null.' },
      suggested_paid_from_code: { type: ['string', 'null'], description: 'Cash or bank asset account CODE the money was most likely paid from, or null.' },
      suggested_paid_from_name: { type: ['string', 'null'], description: 'Exact account NAME matching suggested_paid_from_code, or null.' },
      line_items: {
        type: 'array',
        description: 'Best-effort line items if clearly legible. Optional — do not block on this.',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            amount:      { type: 'number' },
          },
          required: ['description', 'amount'],
        },
      },
      low_confidence_fields: {
        type: 'array',
        description: "Names of fields you could NOT read confidently. Use only these values: 'vendor', 'date', 'total_amount'.",
        items: { type: 'string' },
      },
      note: {
        type: 'string',
        description: 'One short, friendly sentence for the user about anything that could not be read (or empty if everything was clear). No accounting jargon.',
      },
    },
    required: ['readable', 'currency', 'low_confidence_fields', 'note'],
  },
};

// ── Fetch Chart of Accounts + settings for context ────────────────────────────
async function loadContext() {
  let accounts = [];
  try {
    const { rows } = await query(
      `SELECT code, name, type, normal_balance FROM accounts
       WHERE is_active = 1 AND pending_approval = 0 ORDER BY code`
    );
    accounts = rows;
  } catch (_) {
    try {
      const { rows } = await query(
        `SELECT code, name, type, normal_balance FROM accounts WHERE is_active = 1 ORDER BY code`
      );
      accounts = rows;
    } catch (__) { /* no accounts table — continue empty */ }
  }

  let companyName = 'the business', currency = 'PHP';
  try {
    const { rows: [s] } = await query(
      `SELECT business_name, currency FROM business_settings WHERE id = 1`
    );
    if (s) {
      companyName = s.business_name || companyName;
      currency    = s.currency      || currency;
    }
  } catch (_) { /* use defaults */ }

  return { accounts, companyName, currency };
}

function isAdminViewer(req) { return (req.session?.user?.role || 'staff') === 'admin'; }

// ── POST /api/receipts/scan ───────────────────────────────────────────────────
// Runs the vision extraction. Consumes exactly ONE message from the shared cap.
router.post('/scan', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY)
      return res.status(503).json({ error: 'The AI assistant is not configured. Please contact your administrator.' });
    if (isAdminViewer(req))
      return res.status(403).json({ error: 'Admin role is view-only — receipt capture requires Staff, Manager, or Finance access.' });

    const { media_type, data } = req.body || {};
    if (!data || !media_type)
      return res.status(400).json({ error: 'An image or PDF file is required.' });
    if (!ALLOWED_TYPES.includes(media_type))
      return res.status(400).json({ error: 'Unsupported file type. Please upload a JPG, PNG, or PDF receipt.' });

    const byteSize = Math.floor(data.length * 3 / 4); // approx decoded size
    if (byteSize > MAX_BYTES)
      return res.status(413).json({ error: 'That file is too large. Please use a photo under 8 MB.' });

    // Shared monthly cap — a scan counts identically to a chat message.
    const disabled = limitDisabled();
    const limit    = disabled ? null : monthlyLimit();
    const { month, count } = await getUsage();
    if (!disabled && count >= limit) {
      return res.status(429).json({
        error: `You've reached your ${limit}-message monthly limit. Top up $10 for 15 more — contact hello@cuentaiq.com.`,
        usage: { count, limit, warning: true, limitReached: true },
      });
    }

    const { accounts, companyName, currency } = await loadContext();
    const accountsList = accounts.length
      ? accounts.map(a => `  ${a.code.padEnd(8)} ${a.name.padEnd(35)} [${a.type}, normal: ${a.normal_balance}]`).join('\n')
      : '  (No accounts configured yet — leave suggested account fields null.)';
    const today = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are a receipt-reading assistant built into CuentaIQ, serving ${companyName}. \
You are given a photo or scan of a receipt/invoice. Extract the transaction details so the user can record an expense.

RULES:
- Read only what is actually on the receipt. NEVER invent or guess an amount, date, or vendor.
- If a field is blurry, cut off, or ambiguous, set it to null and add its name to low_confidence_fields.
- total_amount is the grand total the customer paid (include tax; it is the final amount due/paid).
- currency: use the code shown on the receipt; if none is shown, default to ${currency}.
- For suggested_expense_code/name, pick the single best-fit Expense or COGS account from the Chart of Accounts
  below based on what was bought. Only use codes/names that appear in the list. If nothing fits, leave null.
- For suggested_paid_from_code/name, pick the most likely Cash or Bank asset account. If unsure, leave null.
- Keep "note" to one short, friendly sentence about anything unclear (or empty string if all clear).
- Today's date is ${today} (use it only to sanity-check the year, never to fabricate a date).
- Always call the extract_receipt tool.

CHART OF ACCOUNTS — ${companyName}
${'─'.repeat(65)}
Code     Account Name                        Type        Normal Bal
${'─'.repeat(65)}
${accountsList}
${'─'.repeat(65)}`;

    const fileBlock = media_type === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type, data } }
      : { type: 'image',    source: { type: 'base64', media_type, data } };

    const contentBlocks = [
      { type: 'text', text: 'Extract the details from this receipt.' },
      fileBlock,
    ];

    const response = await callClaudeVision(systemPrompt, contentBlocks, [EXTRACT_TOOL]);

    let extraction = null;
    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === 'extract_receipt') extraction = block.input;
    }
    if (!extraction)
      return res.status(502).json({ error: "The assistant couldn't read that image. Please try a clearer photo." });

    // Normalize
    extraction.low_confidence_fields = Array.isArray(extraction.low_confidence_fields) ? extraction.low_confidence_fields : [];
    extraction.currency = extraction.currency || currency;

    await incrementUsage(month);
    const newCount = count + 1;

    res.json({
      extraction,
      usage: {
        count:        newCount,
        limit,
        warning:      disabled ? false : newCount / limit >= 0.8,
        limitReached: false,
      },
    });
  } catch (err) {
    console.error('[Receipts] /scan error:', err);
    res.status(500).json({ error: 'The assistant is temporarily unavailable. Please try again in a moment.' });
  }
});

// ── POST /api/receipts/commit ─────────────────────────────────────────────────
// Creates the draft journal entry + stores the image, atomically. Does NOT
// consume a message (the scan already did). Routes into Pending Approval.
router.post('/commit', async (req, res) => {
  const user = req.session?.user;
  try {
    if (isAdminViewer(req))
      return res.status(403).json({ error: 'Admin role is view-only — changes require Staff, Manager, or Finance access.' });

    const {
      date, vendor, description, currency, exchange_rate, amount,
      expense_account_code, paid_from_account_code,
      filename, media_type, image_base64, extracted_json,
    } = req.body || {};

    const amt = parseFloat(amount);
    if (!date)                         return res.status(400).json({ error: 'Date is required.' });
    if (!(amt > 0))                    return res.status(400).json({ error: 'A valid amount greater than zero is required.' });
    if (!expense_account_code)         return res.status(400).json({ error: 'Please choose an expense account.' });
    if (!paid_from_account_code)       return res.status(400).json({ error: 'Please choose the account this was paid from.' });
    if (expense_account_code === paid_from_account_code)
      return res.status(400).json({ error: 'The expense account and the paid-from account must be different.' });

    if (image_base64) {
      if (!ALLOWED_TYPES.includes(media_type))
        return res.status(400).json({ error: 'Unsupported file type.' });
      if (Math.floor(image_base64.length * 3 / 4) > MAX_BYTES)
        return res.status(413).json({ error: 'That file is too large. Please use a photo under 8 MB.' });
    }

    // Resolve account codes → ids
    const { rows: acctRows } = await query(
      `SELECT id, code, name FROM accounts WHERE code = ANY($1::text[]) AND is_active = 1`,
      [[expense_account_code, paid_from_account_code]]
    );
    const acctMap = Object.fromEntries(acctRows.map(a => [a.code, a]));
    const missing = [expense_account_code, paid_from_account_code].filter(c => !acctMap[c]);
    if (missing.length)
      return res.status(400).json({ error: `Account code(s) not found: ${missing.join(', ')}. Please check the Chart of Accounts.` });

    const rate = parseFloat(exchange_rate) > 0 ? parseFloat(exchange_rate) : 1.0;
    const cur  = currency || 'PHP';
    const desc = (description && description.trim())
      || `${vendor ? vendor.trim() + ' — ' : ''}receipt ${date}`.slice(0, 255);

    // Auto-generate reference: RC-YYYYMMDD-NNN
    const dateStr = String(date).replace(/-/g, '');
    const { rows: [{ cnt }] } = await query(
      `SELECT COUNT(*) AS cnt FROM journal_entries WHERE reference LIKE $1`,
      [`RC-${dateStr}-%`]
    );
    const reference = `RC-${dateStr}-${String(Number(cnt) + 1).padStart(3, '0')}`;

    const isSuperAdmin = user?.role === 'super_admin';
    const status       = isSuperAdmin ? 'posted' : 'pending_approval';

    const result = await withTransaction(async (client) => {
      const { rows: [entry] } = await client.query(
        `INSERT INTO journal_entries
           (date, reference, description, status, currency, exchange_rate, entry_type,
            created_by_email, created_by_name, created_by_role)
         VALUES ($1,$2,$3,$4,$5,$6,'regular',$7,$8,$9) RETURNING id`,
        [date, reference, desc, status, cur, rate,
         user?.email || 'system', user?.name || 'System', user?.role || 'staff']
      );
      const id = entry.id;

      // Debit expense, credit paid-from — a balanced 2-line expense entry.
      const lines = [
        { account_id: acctMap[expense_account_code].id,   debit: amt, credit: 0 },
        { account_id: acctMap[paid_from_account_code].id, debit: 0,   credit: amt },
      ];
      for (const l of lines) {
        await client.query(
          `INSERT INTO journal_lines (entry_id, account_id, debit, credit, notes, base_debit, base_credit)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, l.account_id, l.debit, l.credit, null, l.debit / rate, l.credit / rate]
        );
      }

      if (!isSuperAdmin) {
        await client.query(
          `INSERT INTO approval_requests
             (type, entity_id, entity_ref, submitted_by_email, submitted_by_name, submitted_by_role, submitter_note)
           VALUES ('create_entry', $1, $2, $3, $4, $5, $6)`,
          [id, reference, user?.email || 'system', user?.name || 'System', user?.role || 'staff',
           'Drafted from a scanned receipt via Snap to Record.']
        );
      }

      if (image_base64) {
        await client.query(
          `INSERT INTO receipt_attachments
             (entry_id, filename, media_type, data, byte_size, extracted_json, created_by_email)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, filename || 'receipt', media_type, image_base64,
           Math.floor(image_base64.length * 3 / 4),
           extracted_json ? JSON.stringify(extracted_json) : null,
           user?.email || 'system']
        );
      }

      return { id };
    });

    logAction(user, 'CREATE_ENTRY_FROM_RECEIPT', 'journal_entry', result.id, reference);
    res.json({ success: true, entryId: result.id, reference, status });
  } catch (err) {
    console.error('[Receipts] /commit error:', err);
    res.status(err.code === '23505' ? 400 : 500)
       .json({ error: err.code === '23505' ? 'That reference already exists — please try again.' : 'Failed to save the entry. Please try again.' });
  }
});

// ── GET /api/receipts/:entryId/meta ───────────────────────────────────────────
// Lightweight existence check for the Journal Entries detail view.
router.get('/:entryId/meta', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT filename, media_type, byte_size, created_at
       FROM receipt_attachments WHERE entry_id = $1 ORDER BY id DESC LIMIT 1`,
      [req.params.entryId]
    );
    if (!rows.length) return res.json({ exists: false });
    res.json({ exists: true, ...rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/receipts/:entryId ────────────────────────────────────────────────
// Serves the original image/PDF inline for audit reference.
router.get('/:entryId', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT filename, media_type, data FROM receipt_attachments
       WHERE entry_id = $1 ORDER BY id DESC LIMIT 1`,
      [req.params.entryId]
    );
    if (!rows.length) return res.status(404).json({ error: 'No receipt attached to this entry.' });
    const { filename, media_type, data } = rows[0];
    const buf = Buffer.from(data, 'base64');
    res.setHeader('Content-Type', media_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${(filename || 'receipt').replace(/[^a-zA-Z0-9.\-_]/g, '-')}"`);
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
