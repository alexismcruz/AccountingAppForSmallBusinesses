const router    = require('express').Router();
const { query, withTransaction } = require('../db/database');
const Anthropic  = require('@anthropic-ai/sdk');

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Tool definition ───────────────────────────────────────────────────────────

const DRAFT_TOOL = {
  name: 'draft_journal_entry',
  description:
    'Create a draft journal entry for the user to review and optionally post. ' +
    'Call this tool when you have all the details needed for a complete, balanced entry.',
  input_schema: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: 'Entry date in YYYY-MM-DD format. Use today if the user did not specify.',
      },
      description: {
        type: 'string',
        description: 'Concise transaction description (e.g. "Rent payment for May 2026").',
      },
      lines: {
        type: 'array',
        description: 'Journal lines. Total debits MUST equal total credits.',
        items: {
          type: 'object',
          properties: {
            account_code: { type: 'string',  description: 'Exact account code from the Chart of Accounts.' },
            account_name: { type: 'string',  description: 'Exact account name from the Chart of Accounts.' },
            debit:        { type: 'number',  description: 'Debit amount; use 0 for credit lines.' },
            credit:       { type: 'number',  description: 'Credit amount; use 0 for debit lines.' },
            description:  { type: 'string',  description: 'Optional line-level note.' },
          },
          required: ['account_code', 'account_name', 'debit', 'credit'],
        },
      },
      explanation: {
        type: 'string',
        description:
          'Plain-English explanation of why the entry is recorded this way. ' +
          'Briefly mention which accounts are debited/credited and why.',
      },
    },
    required: ['date', 'description', 'lines', 'explanation'],
  },
};

// ── POST /api/chatbot/message ─────────────────────────────────────────────────

router.post('/message', async (req, res) => {
  try {
    const { messages } = req.body;
    const user = req.session?.user;
    if (!user)            return res.status(401).json({ error: 'Not authenticated' });
    if (!messages?.length) return res.status(400).json({ error: 'messages array required' });

    // Fetch chart of accounts for context injection (graceful fallback if table missing)
    let accounts = [];
    try {
      const { rows } = await query(
        `SELECT code, name, type, normal_balance
         FROM accounts
         WHERE is_active = 1 AND pending_approval = 0
         ORDER BY code`
      );
      accounts = rows;
    } catch (_) { /* table may not exist yet — continue with empty list */ }

    // Fetch company settings (graceful fallback if table missing)
    let companyName = 'your company';
    let currency    = 'PHP';
    let taxSystem   = 'VAT';
    try {
      const { rows: settingRows } = await query(
        `SELECT key, value FROM settings WHERE key IN ('business_name','currency','tax_system')`
      );
      const s = Object.fromEntries(settingRows.map(r => [r.key, r.value]));
      companyName = s.business_name || companyName;
      currency    = s.currency      || currency;
      taxSystem   = s.tax_system    || taxSystem;
    } catch (_) { /* table may not exist yet — use defaults */ }

    const today = new Date().toISOString().split('T')[0];

    const accountsList = accounts.length
      ? accounts
          .map(a => `  ${a.code.padEnd(8)} ${a.name.padEnd(35)} [${a.type}, normal: ${a.normal_balance}]`)
          .join('\n')
      : '  No accounts configured yet — ask the user to set up their Chart of Accounts first.';

    const systemPrompt = `You are a friendly and knowledgeable accounting assistant for ${companyName}. \
Your users are business owners and staff who may not have formal accounting training. \
Your primary job is to help them record business transactions correctly as journal entries.

PERSONALITY & STYLE:
- Warm, patient, and encouraging — accounting can be intimidating
- Use plain language; avoid jargon when possible
- When you must use accounting terms (debit, credit, AR, AP, accrual, etc.), briefly explain them
- Never make the user feel embarrassed for not knowing accounting

YOUR WORKFLOW:
1. Listen to the user's description of a transaction
2. If key details are missing (amount, date, cash vs. credit, which bank account, etc.) ask ONE focused clarifying question at a time
3. Once you have all the details, call the draft_journal_entry tool — do NOT just describe the entry in text
4. Your tool call explanation should be friendly and educational, not technical

HARD RULES:
- ONLY use account codes and names from the Chart of Accounts below — never invent accounts
- Every entry MUST balance: total debits = total credits
- If no suitable account exists in the CoA, explain this and suggest the user add it via Chart of Accounts
- Currency: ${currency} | Tax system: ${taxSystem} | Today's date: ${today}
- For VAT-registered businesses: remember to split output/input VAT on sales/purchases when applicable

COMMON TRANSACTIONS YOU SHOULD HANDLE:
- Cash sales and collections from customers (AR)
- Credit sales (accounts receivable)
- Cash purchases and payments to suppliers
- Credit purchases (accounts payable / AP)
- Payroll and salary disbursements
- Bank loan proceeds and repayments
- Equipment / asset purchases
- Depreciation entries
- Tax payments (VAT, income tax, withholding)
- Petty cash disbursements and replenishment
- Owner capital contributions or drawings
- Utility, rent, and operating expenses
- Inter-bank transfers

CHART OF ACCOUNTS — ${companyName}
${'─'.repeat(65)}
Code     Account Name                        Type        Normal Bal
${'─'.repeat(65)}
${accountsList}
${'─'.repeat(65)}`;

    const response = await ai.messages.create({
      model:      'claude-3-haiku-20240307',
      max_tokens: 1024,
      system:     systemPrompt,
      tools:      [DRAFT_TOOL],
      messages,
    });

    // Parse response blocks — extract text and optional tool call
    let textParts  = [];
    let draftEntry = null;

    for (const block of response.content) {
      if (block.type === 'text')
        textParts.push(block.text);
      if (block.type === 'tool_use' && block.name === 'draft_journal_entry')
        draftEntry = block.input;
    }

    res.json({
      text:       textParts.join('\n').trim(),
      draftEntry,
      stopReason: response.stop_reason,
    });

  } catch (err) {
    console.error('Chatbot /message error:', err);
    // Return the real error message so it's visible in the chat widget
    const detail = err?.message || String(err);
    res.status(500).json({ error: `Assistant error: ${detail}` });
  }
});

// ── POST /api/chatbot/post ────────────────────────────────────────────────────
// Resolves account codes → IDs and creates the journal entry

router.post('/post', async (req, res) => {
  try {
    const { draftEntry } = req.body;
    const user = req.session?.user;
    if (!user)       return res.status(401).json({ error: 'Not authenticated' });
    if (!draftEntry) return res.status(400).json({ error: 'draftEntry required' });

    const { date, description, lines } = draftEntry;
    if (!date || !description || !Array.isArray(lines) || lines.length < 2)
      return res.status(400).json({ error: 'Incomplete draft entry' });

    // Resolve account codes → IDs
    const codes = [...new Set(lines.map(l => l.account_code))];
    const { rows: acctRows } = await query(
      `SELECT id, code, name FROM accounts WHERE code = ANY($1::text[]) AND is_active = 1`,
      [codes]
    );
    const acctMap = Object.fromEntries(acctRows.map(a => [a.code, a]));

    const missing = codes.filter(c => !acctMap[c]);
    if (missing.length)
      return res.status(400).json({
        error: `Account code(s) not found: ${missing.join(', ')}. Please check the Chart of Accounts.`,
      });

    // Build resolved lines
    const resolvedLines = lines.map(l => ({
      account_id: acctMap[l.account_code].id,
      debit:      parseFloat(l.debit)  || 0,
      credit:     parseFloat(l.credit) || 0,
      notes:      l.description        || null,
    }));

    // Balance check
    const totalD = resolvedLines.reduce((s, l) => s + l.debit,  0);
    const totalC = resolvedLines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalD - totalC) > 0.005)
      return res.status(400).json({
        error: `Entry is not balanced — Debits: ${totalD.toFixed(2)}, Credits: ${totalC.toFixed(2)}`,
      });

    // Auto-generate chatbot reference: CB-YYYYMMDD-NNN
    const dateStr = date.replace(/-/g, '');
    const { rows: [{ cnt }] } = await query(
      `SELECT COUNT(*) AS cnt FROM journal_entries WHERE reference LIKE $1`,
      [`CB-${dateStr}-%`]
    );
    const reference = `CB-${dateStr}-${String(Number(cnt) + 1).padStart(3, '0')}`;

    // Currency from settings
    const { rows: currRows } = await query(
      `SELECT value FROM settings WHERE key = 'currency'`
    );
    const currency = currRows[0]?.value || 'PHP';

    const isSuperAdmin = user.role === 'super_admin';
    const status       = isSuperAdmin ? 'posted' : 'pending_approval';

    const entryId = await withTransaction(async (client) => {
      const { rows: [entry] } = await client.query(
        `INSERT INTO journal_entries
           (date, reference, description, status, currency, exchange_rate,
            entry_type, created_by_email, created_by_name, created_by_role)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [date, reference, description, status, currency, 1.0, 'regular',
         user.email, user.name, user.role]
      );
      const id = entry.id;

      for (const line of resolvedLines) {
        await client.query(
          `INSERT INTO journal_lines
             (entry_id, account_id, debit, credit, notes, base_debit, base_credit)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, line.account_id, line.debit, line.credit, line.notes, line.debit, line.credit]
        );
      }

      if (!isSuperAdmin) {
        await client.query(
          `INSERT INTO approval_requests
             (entry_id, action, status, submitted_by_email, submitted_by_name, submitted_by_role)
           VALUES ($1,'approve_entry','pending',$2,$3,$4)`,
          [id, user.email, user.name, user.role]
        );
      }

      return id;
    });

    res.json({ success: true, entryId, reference, status });

  } catch (err) {
    console.error('Chatbot /post error:', err);
    res.status(500).json({ error: 'Failed to post the entry. Please try again.' });
  }
});

module.exports = router;
