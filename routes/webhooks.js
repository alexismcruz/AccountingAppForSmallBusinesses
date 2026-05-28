const express = require('express');
const router  = express.Router();
const { query } = require('../db/database');

// ── Connector registry (mirrors integrations/index.js) ────────────────────────
const CONNECTORS = {
  bigcommerce: require('./integrations/bigcommerce'),
};

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
