// ── Shared outgoing-email module ──────────────────────────────────────────────
// One place all app-side email flows through: Resend transport, "ClientName via
// CuentaIQ" branding, attachments, and an audit-log row per send.
//
// Option A model: every message is sent from a CuentaIQ-owned address
// (EMAIL_FROM_ADDRESS) with the business name as the display name and the
// business's own email as Reply-To, so no per-client domain setup is needed.
//
// NOTE: This module touches the database (for business identity + logging), so
// it must only be used on app deployments — never the landing site (no DB there).

const { query } = require('../db/database');

const APP_LABEL    = 'CuentaIQ';
const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'notifications@cuentaiq.com';

// Strip characters that could break an email header line
const cleanHeader = (s) => String(s || '').replace(/[\r\n"<>]/g, ' ').trim();

const isValidEmail = (e) =>
  typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

// Business name + reply-to address from settings (graceful fallback)
async function getBusinessIdentity() {
  try {
    const { rows: [biz] } = await query(
      'SELECT business_name, business_email FROM business_settings WHERE id = 1'
    );
    return {
      name:  biz?.business_name || APP_LABEL,
      email: isValidEmail(biz?.business_email) ? biz.business_email.trim() : null,
    };
  } catch {
    return { name: APP_LABEL, email: null };
  }
}

// Branded HTML wrapper — forest green header, cream body (matches the CuentaIQ look)
function renderEmail({ heading, bodyHtml, footnote }) {
  return `
  <div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1B2E24">
    <div style="background:#2D6A4F;padding:24px 32px;border-radius:12px 12px 0 0">
      <h2 style="color:white;margin:0;font-size:20px;font-weight:600">${cleanHeader(heading)}</h2>
    </div>
    <div style="background:#F8F5EF;padding:24px 32px;font-size:14px;line-height:1.7">
      ${bodyHtml}
    </div>
    <div style="background:#1B2E24;padding:14px 32px;border-radius:0 0 12px 12px;font-size:12px;color:rgba(255,255,255,0.45)">
      ${footnote || `Sent via ${APP_LABEL}`}
    </div>
  </div>`;
}

// Write one audit row. Never throws — logging must not break a send.
async function logEmail(entry) {
  try {
    await query(`
      INSERT INTO email_log
        (to_email, subject, template, status, error, related_type, related_id, provider_id, sent_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [
      entry.to, entry.subject, entry.template || null, entry.status,
      entry.error ? String(entry.error).slice(0, 500) : null,
      entry.relatedType || null, entry.relatedId || null,
      entry.providerId || null, entry.sentBy || null,
    ]);
  } catch (e) {
    console.error('[Email] audit log write failed:', e.message);
  }
}

/**
 * Send an email through Resend and record it in email_log.
 *
 * @param {object}   opts
 * @param {string|string[]} opts.to        Recipient(s)
 * @param {string}   opts.subject
 * @param {string}   opts.html             Body HTML (use renderEmail() for branding)
 * @param {string}  [opts.fromName]        Display name override (default "<Business> via CuentaIQ")
 * @param {string}  [opts.from]            From address override (default EMAIL_FROM_ADDRESS)
 * @param {string}  [opts.replyTo]         Reply-To override (default business email)
 * @param {Array}   [opts.attachments]     [{ filename, content: Buffer|base64 }]
 * @param {string}  [opts.template]        Label stored in the log
 * @param {string}  [opts.relatedType]     e.g. 'receivable'
 * @param {number}  [opts.relatedId]
 * @param {string}  [opts.sentBy]          Acting user email (for the log)
 * @returns {Promise<{ok:boolean, id?:string, skipped?:boolean, error?:string}>}
 */
async function sendEmail(opts = {}) {
  const { to, subject, html } = opts;
  const recipients = Array.isArray(to) ? to.filter(isValidEmail) : (isValidEmail(to) ? [to] : []);

  if (!recipients.length) return { ok: false, error: 'A valid recipient is required' };
  if (!subject || !html)  return { ok: false, error: 'subject and html are required' };

  const identity    = await getBusinessIdentity();
  const displayName = cleanHeader(opts.fromName || `${identity.name} via ${APP_LABEL}`);
  const fromLine    = `${displayName} <${opts.from || FROM_ADDRESS}>`;
  const replyTo     = opts.replyTo || identity.email || null;

  const logBase = {
    to: recipients.join(', '), subject, template: opts.template,
    relatedType: opts.relatedType, relatedId: opts.relatedId, sentBy: opts.sentBy,
  };

  // No key configured — record as skipped, don't throw (mirrors contact-form behaviour)
  if (!process.env.RESEND_API_KEY) {
    console.log('[Email] RESEND_API_KEY not set — skipping:', subject, '→', logBase.to);
    await logEmail({ ...logBase, status: 'skipped', error: 'RESEND_API_KEY not set' });
    return { ok: false, skipped: true, error: 'Email is not configured (RESEND_API_KEY not set).' };
  }

  const payload = { from: fromLine, to: recipients, subject, html };
  if (replyTo) payload.reply_to = replyTo;
  if (opts.attachments?.length) {
    payload.attachments = opts.attachments.map(a => ({
      filename: a.filename,
      content:  Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
    }));
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error('[Email] send failed:', errText);
      await logEmail({ ...logBase, status: 'failed', error: errText });
      return { ok: false, error: 'Email send failed. Please try again.' };
    }
    const data = await response.json().catch(() => ({}));
    await logEmail({ ...logBase, status: 'sent', providerId: data?.id });
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error('[Email] send error:', err.message);
    await logEmail({ ...logBase, status: 'failed', error: err.message });
    return { ok: false, error: err.message };
  }
}

module.exports = { sendEmail, renderEmail, isValidEmail };
