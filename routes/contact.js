const router = require('express').Router();

router.post('/', async (req, res) => {
  try {
    const { name, company, email, phone, message } = req.body;

    if (!name?.trim() || !company?.trim() || !email?.trim() || !message?.trim())
      return res.status(400).json({ error: 'Please fill in all required fields.' });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Please enter a valid email address.' });

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      // Dev mode — SMTP not configured, log and confirm
      console.log('[Contact Form] SMTP not configured. Submission:', { name, company, email, phone });
      return res.json({ success: true });
    }

    const nodemailer  = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      family: 4,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout:    8000,
      socketTimeout:     10000,
    });

    await transporter.sendMail({
      from:    `"CuentaIQ Website" <${process.env.SMTP_USER}>`,
      to:      'hello@cuentaiq.com',
      replyTo: email,
      subject: `Demo Request — ${company}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;color:#1B2E24">
          <div style="background:#2D6A4F;padding:24px 32px;border-radius:12px 12px 0 0">
            <h2 style="color:white;margin:0;font-size:20px;font-weight:600">New Demo Request</h2>
          </div>
          <div style="background:#F8F5EF;padding:24px 32px">
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:7px 0;color:#4A5E52;width:110px;vertical-align:top">Name</td><td style="padding:7px 0;font-weight:600">${name}</td></tr>
              <tr><td style="padding:7px 0;color:#4A5E52;vertical-align:top">Company</td><td style="padding:7px 0;font-weight:600">${company}</td></tr>
              <tr><td style="padding:7px 0;color:#4A5E52;vertical-align:top">Email</td><td style="padding:7px 0"><a href="mailto:${email}" style="color:#2D6A4F;font-weight:600">${email}</a></td></tr>
              ${phone ? `<tr><td style="padding:7px 0;color:#4A5E52;vertical-align:top">Phone</td><td style="padding:7px 0">${phone}</td></tr>` : ''}
            </table>
            <hr style="border:none;border-top:1px solid #E2DDD4;margin:16px 0" />
            <div style="font-size:11px;font-weight:700;color:#8A9E92;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Message</div>
            <p style="font-size:14px;line-height:1.75;margin:0;color:#1B2E24">${message.replace(/\n/g, '<br>')}</p>
          </div>
          <div style="background:#1B2E24;padding:14px 32px;border-radius:0 0 12px 12px;font-size:12px;color:rgba(255,255,255,0.4)">
            Sent from cuentaiq.com · Contact form
          </div>
        </div>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Contact Form] Error:', err);
    res.status(500).json({ error: 'Failed to send your message. Please email hello@cuentaiq.com directly.' });
  }
});

module.exports = router;
