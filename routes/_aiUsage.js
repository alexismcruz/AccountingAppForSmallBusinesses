// Shared monthly AI-message usage cap.
//
// Both the AI Assistant chat (routes/chatbot.js) and Snap-to-Record receipt
// scanning (routes/receipts.js) draw from this SAME counter, so a receipt scan
// costs exactly one message from the customer's monthly allowance — identical to
// a plain-language entry. The table name is kept as `chatbot_usage` so existing
// counts carry over unchanged.

const { query } = require('../db/database');

const currentMonth  = () => new Date().toISOString().slice(0, 7); // YYYY-MM
const monthlyLimit  = () => parseInt(process.env.CHATBOT_MONTHLY_LIMIT || '50');
const limitDisabled = () => process.env.CHATBOT_LIMIT_DISABLED === 'true';

// Create table on startup (safe to call every deploy)
query(`
  CREATE TABLE IF NOT EXISTS chatbot_usage (
    month         VARCHAR(7) PRIMARY KEY,
    message_count INTEGER    NOT NULL DEFAULT 0
  )
`).catch(err => console.error('[AI usage] chatbot_usage table error:', err.message));

async function getUsage() {
  const month = currentMonth();
  await query(
    `INSERT INTO chatbot_usage (month, message_count) VALUES ($1, 0) ON CONFLICT DO NOTHING`,
    [month]
  );
  const { rows } = await query(
    `SELECT message_count FROM chatbot_usage WHERE month = $1`,
    [month]
  );
  return { month, count: rows[0]?.message_count || 0 };
}

async function incrementUsage(month) {
  await query(
    `UPDATE chatbot_usage SET message_count = message_count + 1 WHERE month = $1`,
    [month]
  );
}

module.exports = { currentMonth, monthlyLimit, limitDisabled, getUsage, incrementUsage };
