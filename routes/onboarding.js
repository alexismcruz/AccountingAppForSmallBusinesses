const router = require('express').Router();

// Landing-site route (no database) — mirrors routes/contact.js. Emails the
// completed onboarding checklist to support@cuentaiq.com via Resend.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function buildHtml({ business_name, contact_person, contact_email, subdomain, plan, items, notes }) {
  const rows = (Array.isArray(items) ? items : []).map(it => `
    <tr>
      <td style="padding:6px 0;width:26px;font-size:16px;color:${it.checked ? '#2D6A4F' : '#C0392B'}">${it.checked ? '&#10003;' : '&#10007;'}</td>
      <td style="padding:6px 0;font-size:14px;color:#1B2E24">${esc(it.label)}${it.optional ? ' <span style="color:#8A9E92;font-size:12px">(optional)</span>' : ''}</td>
    </tr>`).join('');

  return `
  <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#1B2E24">
    <div style="background:#2D6A4F;padding:24px 32px;border-radius:12px 12px 0 0">
      <h2 style="color:white;margin:0;font-size:20px;font-weight:600">New Onboarding Checklist</h2>
    </div>
    <div style="background:#F8F5EF;padding:24px 32px">
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:18px">
        <tr><td style="padding:5px 0;color:#4A5E52;width:140px;vertical-align:top">Business</td><td style="padding:5px 0;font-weight:600">${esc(business_name)}</td></tr>
        <tr><td style="padding:5px 0;color:#4A5E52;vertical-align:top">Contact</td><td style="padding:5px 0;font-weight:600">${esc(contact_person)}</td></tr>
        <tr><td style="padding:5px 0;color:#4A5E52;vertical-align:top">Email</td><td style="padding:5px 0"><a href="mailto:${esc(contact_email)}" style="color:#2D6A4F;font-weight:600">${esc(contact_email)}</a></td></tr>
        ${subdomain ? `<tr><td style="padding:5px 0;color:#4A5E52;vertical-align:top">Subdomain</td><td style="padding:5px 0;font-weight:600">${esc(subdomain)}.cuentaiq.com</td></tr>` : ''}
        ${plan ? `<tr><td style="padding:5px 0;color:#4A5E52;vertical-align:top">Plan</td><td style="padding:5px 0;font-weight:600">${esc(plan)}</td></tr>` : ''}
      </table>
      <div style="font-size:11px;font-weight:700;color:#8A9E92;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Checklist</div>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      ${notes ? `<hr style="border:none;border-top:1px solid #E2DDD4;margin:16px 0" />
        <div style="font-size:11px;font-weight:700;color:#8A9E92;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Notes</div>
        <p style="font-size:14px;line-height:1.7;margin:0">${esc(notes).replace(/\n/g, '<br>')}</p>` : ''}
    </div>
    <div style="background:#1B2E24;padding:14px 32px;border-radius:0 0 12px 12px;font-size:12px;color:rgba(255,255,255,0.4)">
      Submitted from cuentaiq.com &middot; Onboarding checklist
    </div>
  </div>`;
}

router.post('/', async (req, res) => {
  try {
    const { business_name, contact_person, contact_email, subdomain, plan, items, notes } = req.body;

    if (!business_name?.trim() || !contact_person?.trim() || !contact_email?.trim())
      return res.status(400).json({ error: 'Please fill in your business name, contact person, and email.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email))
      return res.status(400).json({ error: 'Please enter a valid email address.' });

    if (!process.env.RESEND_API_KEY) {
      console.log('[Onboarding] RESEND_API_KEY not set. Submission from:', business_name, contact_email);
      return res.json({ success: true });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:     'CuentaIQ Website <hello@cuentaiq.com>',
        to:       ['support@cuentaiq.com'],
        reply_to: contact_email,
        subject:  `Onboarding Checklist — ${business_name}`,
        html:     buildHtml({ business_name, contact_person, contact_email, subdomain, plan, items, notes }),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Onboarding] Resend error:', err);
      return res.status(500).json({ error: 'Failed to submit. Please email support@cuentaiq.com directly.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Onboarding] Error:', err);
    res.status(500).json({ error: 'Failed to submit. Please email support@cuentaiq.com directly.' });
  }
});

module.exports = router;
