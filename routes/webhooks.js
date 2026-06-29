const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { query } = require('../db/database');
const { addSuppression } = require('../utils/email');

// ── Connector registry (mirrors integrations/index.js) ────────────────────────
const CONNECTORS = {
  bigcommerce: require('./integrations/bigcommerce'),
};

// ── Resend email events (Svix-signed) ─────────────────────────────────────────
// Verifies the Svix signature against EMAIL_WEBHOOK_SECRET using the raw body
// (captured in server.js). Updates email_log delivery status and grows the
// suppression list on bounces/complaints.

function verifySvixSignature(req, secret) {
  const id  = req.headers['svix-id'];
  const ts  = req.headers['svix-timestamp'];
  const hdr = req.headers['svix-signature'];
  if (!id || !ts || !hdr || !req.rawBody) return false;

  const key      = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signed   = Buffer.concat([Buffer.from(`${id}.${ts}.`), req.rawBody]);
  const expected = crypto.createHmac('sha256', key).update(signed).digest('base64');

  return hdr.split(' ').some((part) => {
    const sig = part.includes(',') ? part.split(',')[1] : part;
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(sig);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch { return false; }
  });
}

router.post('/resend', async (req, res) => {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (secret) {
    if (!verifySvixSignature(req, secret)) {
      console.warn('[Webhook/resend] signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } else {
    console.warn('[Webhook/resend] EMAIL_WEBHOOK_SECRET not set — processing unverified');
  }

  const { type, data } = req.body || {};
  res.json({ ok: true }); // ack immediately

  setImmediate(async () => {
    try {
      const emailId    = data?.email_id || null;
      const recipients = Array.isArray(data?.to) ? data.to : (data?.to ? [data.to] : []);

      if (type === 'email.delivered') {
        if (emailId) await query(`UPDATE email_log SET status='delivered' WHERE provider_id=$1 AND status='sent'`, [emailId]);
      } else if (type === 'email.bounced') {
        if (emailId) await query(`UPDATE email_log SET status='bounced' WHERE provider_id=$1`, [emailId]);
        const detail = data?.bounce?.message || data?.bounce?.type || 'Hard bounce';
        for (const r of recipients) await addSuppression(r, 'bounced', detail);
      } else if (type === 'email.complained') {
        if (emailId) await query(`UPDATE email_log SET status='complained' WHERE provider_id=$1`, [emailId]);
        for (const r of recipients) await addSuppression(r, 'complained', 'Recipient marked as spam');
      }
    } catch (err) {
      console.error('[Webhook/resend] processing error:', err.message);
    }
  });
});

// ── POST /api/webhooks/:provider ──────────────────────────────────────────────
// Public endpoint — no session auth. Security is via webhook token verification.
router.post('/:provider', async (req, res) => {
  const { provider } = req.params;
  const connector    = CONNECTORS[provider];

  if (!connector) {
    console.warn(`Webhook: unknown provider "${provider}"`);
    return res.status(404).json({ error: 'Unknown provider' });
  }

  // Load integration from DB
  let integration;
  try {
    const { rows: [row] } = await query(
      'SELECT enabled, credentials FROM integrations WHERE provider=$1', [provider]
    );
    integration = row;
  } catch (err) {
    console.error(`Webhook DB error [${provider}]:`, err.message);
    return res.status(500).json({ error: 'Internal error' });
  }

  if (!integration?.enabled) {
    return res.status(403).json({ error: 'Integration is not enabled' });
  }

  const credentials = integration.credentials || {};

  // ── Token verification ─────────────────────────────────────────────────────
  // We check the custom header we set when registering the webhook in BC
  const tokenHeader = req.headers['x-bc-webhook-token'];
  if (credentials.webhook_secret) {
    if (!connector.verifyWebhookToken(tokenHeader, credentials.webhook_secret)) {
      console.warn(`Webhook: invalid token for provider "${provider}"`);
      return res.status(401).json({ error: 'Invalid webhook token' });
    }
  }

  // ── Dispatch ───────────────────────────────────────────────────────────────
  const { scope, data } = req.body || {};
  if (!scope) {
    return res.status(400).json({ error: 'Missing scope in webhook payload' });
  }

  // Respond immediately — BigCommerce expects a fast 200
  res.json({ ok: true });

  // Process async so we don't block BC's delivery retry timer
  setImmediate(async () => {
    try {
      await connector.handleWebhook(scope, data || {}, credentials);
    } catch (err) {
      console.error(`Webhook handler error [${provider}/${scope}]:`, err.message);
    }
  });
});

module.exports = router;
