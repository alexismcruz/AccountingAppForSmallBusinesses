const express    = require('express');
const router     = express.Router();
const PDFDocument = require('pdfkit');
const { query }  = require('../db/database');

// ── Colour palette (matches app UI) ──────────────────────────────────────────
const C = {
  blue:    '#2563eb',
  dark:    '#1e293b',
  gray:    '#64748b',
  light:   '#f1f5f9',
  border:  '#e2e8f0',
  success: '#15803d',
  danger:  '#dc2626',
  warn:    '#d97706',
  successBg: '#f0fdf4',
  dangerBg:  '#fef2f2',
  warnBg:    '#fffbeb',
};

const MAR   = 50;
const PW    = 612;
const RIGHT = PW - MAR;

function fmtDate(d) {
  if (!d) return '—';
  const s = d.includes('T') ? d.split('T')[0] : d;
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

// ── Load a receivable + everything its invoice needs ─────────────────────────
// Returns null if the receivable doesn't exist.
async function loadInvoiceData(id) {
  const { rows: [rec] } = await query('SELECT * FROM receivables WHERE id = $1', [id]);
  if (!rec) return null;

  const { rows: [biz] } = await query('SELECT * FROM business_settings LIMIT 1');
  const bizData = biz || {};

  const { rows: taxes } = await query(`
    SELECT ta.tax_amount, tr.name AS tax_name, tr.code AS tax_code, tr.rate, tr.type
    FROM tax_applications ta
    JOIN tax_rates tr ON tr.id = ta.tax_rate_id
    WHERE ta.entity_type = 'receivable' AND ta.entity_id = $1
    ORDER BY ta.created_at
  `, [id]);

  const totalTax    = taxes.reduce((s, t) => s + (parseFloat(t.tax_amount) || 0), 0);
  const grandTotal  = (rec.amount || 0) + totalTax;
  const balance     = grandTotal - (rec.paid_amount || 0);
  const invNum      = rec.invoice_number || String(rec.id);

  return { rec, bizData, taxes, totalTax, grandTotal, balance, invNum };
}

// ── Render the invoice PDF to a Buffer ───────────────────────────────────────
// Shared by the download route and (future) email sending.
function renderInvoicePdf(data) {
  const { rec, bizData, taxes, grandTotal, balance, invNum } = data;
  const sym = bizData.currency_symbol || '$';
  const fmt = (v) =>
    `${sym}${parseFloat(v || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: MAR, info: {
      Title:   `Invoice ${invNum}`,
      Author:  bizData.business_name || 'My Business',
      Subject: `Invoice for ${rec.customer_name}`,
    }});

    const chunks = [];
    doc.on('data',  c => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── HEADER — business info (left) ─────────────────────────────────────────
    doc.fontSize(22).font('Helvetica-Bold').fillColor(C.dark)
       .text(bizData.business_name || 'My Business', MAR, 50);

    let by = 78;
    doc.fontSize(9).font('Helvetica').fillColor(C.gray);
    if (bizData.address) {
      bizData.address.split('\n').slice(0, 4).forEach(line => {
        if (line.trim()) { doc.text(line.trim(), MAR, by); by += 13; }
      });
    }
    if (bizData.tax_id)              { doc.text(`TIN: ${bizData.tax_id}`, MAR, by); by += 13; }
    if (bizData.registration_number) { doc.text(`Reg. No.: ${bizData.registration_number}`, MAR, by); }

    // ── HEADER — INVOICE title + details (right) ──────────────────────────────
    doc.fontSize(34).font('Helvetica-Bold').fillColor(C.blue)
       .text('INVOICE', 340, 48, { width: RIGHT - 340, align: 'right' });

    const createdDate = rec.created_at
      ? (typeof rec.created_at === 'string' ? rec.created_at.split('T')[0] : rec.created_at.toISOString().split('T')[0])
      : '';

    const details = [
      ['Invoice #',  invNum],
      ['Date',       fmtDate(createdDate)],
      ['Due Date',   fmtDate(rec.due_date)],
    ];
    if (rec.currency && rec.currency !== (bizData.currency || 'USD')) {
      details.push(['Currency', rec.currency]);
    }

    let dy = 93;
    details.forEach(([label, value]) => {
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.gray)
         .text(label, 350, dy, { width: 85 });
      doc.fontSize(8.5).font('Helvetica').fillColor(C.dark)
         .text(String(value), 435, dy, { width: RIGHT - 435, align: 'right' });
      dy += 14;
    });

    // ── DIVIDER ───────────────────────────────────────────────────────────────
    const div1Y = Math.max(by + 20, dy + 10, 148);
    doc.moveTo(MAR, div1Y).lineTo(RIGHT, div1Y)
       .strokeColor(C.border).lineWidth(1).stroke();

    // ── BILL TO ───────────────────────────────────────────────────────────────
    const billY = div1Y + 14;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.gray)
       .text('BILL TO', MAR, billY, { characterSpacing: 1.2 });
    doc.fontSize(15).font('Helvetica-Bold').fillColor(C.dark)
       .text(rec.customer_name, MAR, billY + 13);

    // ── ITEMS TABLE ───────────────────────────────────────────────────────────
    const tableY    = billY + 48;
    const colDescW  = (RIGHT - MAR) * 0.68;
    doc.rect(MAR, tableY, RIGHT - MAR, 26).fill(C.blue);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#ffffff')
       .text('DESCRIPTION', MAR + 10, tableY + 9)
       .text('AMOUNT',      MAR + 10, tableY + 9, { width: RIGHT - MAR - 20, align: 'right' });

    let rowY = tableY + 26;
    const items = [{ desc: rec.description || 'Services rendered', amount: rec.amount }];
    items.forEach((item, i) => {
      const bg = i % 2 === 0 ? C.light : '#ffffff';
      doc.rect(MAR, rowY, RIGHT - MAR, 30).fill(bg);
      doc.fontSize(10).font('Helvetica').fillColor(C.dark)
         .text(item.desc, MAR + 10, rowY + 10, { width: colDescW - 10 });
      doc.fontSize(10).font('Helvetica-Bold').fillColor(C.dark)
         .text(fmt(item.amount), MAR + 10, rowY + 10, { width: RIGHT - MAR - 20, align: 'right' });
      rowY += 30;
    });
    doc.rect(MAR, tableY, RIGHT - MAR, rowY - tableY)
       .strokeColor(C.border).lineWidth(0.5).stroke();

    // ── TOTALS BLOCK ─────────────────────────────────────────────────────────
    const totX = 370;
    const totW = RIGHT - totX;
    let   totY = rowY + 20;

    const addRow = (label, value, bold = false, valColor = C.dark) => {
      doc.fontSize(9.5)
         .font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(C.gray)
         .text(label, totX, totY, { width: totW * 0.52 });
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(valColor)
         .text(value, totX, totY, { width: totW, align: 'right' });
      totY += 18;
    };

    addRow('Subtotal', fmt(rec.amount));
    taxes.forEach(t => {
      const rateLabel = t.type === 'percentage' ? ` (${parseFloat(t.rate) || 0}%)` : '';
      addRow(`${t.tax_name}${rateLabel}`, fmt(t.tax_amount), false, C.gray);
    });
    if (taxes.length > 0) {
      doc.moveTo(totX, totY + 2).lineTo(RIGHT, totY + 2)
         .strokeColor(C.border).lineWidth(0.5).stroke();
      totY += 10;
      addRow('Total', fmt(grandTotal), true);
    }
    if (rec.paid_amount > 0) addRow('Amount Paid', `− ${fmt(rec.paid_amount)}`, false, C.success);

    doc.moveTo(totX, totY + 2).lineTo(RIGHT, totY + 2)
       .strokeColor(C.border).lineWidth(0.5).stroke();
    totY += 10;

    doc.fontSize(11).font('Helvetica-Bold').fillColor(C.dark)
       .text('Balance Due', totX, totY, { width: totW * 0.52 });
    doc.fillColor(balance <= 0 ? C.success : C.dark)
       .text(fmt(balance), totX, totY, { width: totW, align: 'right' });
    totY += 28;

    // ── STATUS BADGE ─────────────────────────────────────────────────────────
    const isPaid    = rec.status === 'paid';
    const isPartial = rec.status === 'partial';
    const statusText = isPaid ? 'PAID IN FULL' : isPartial ? 'PARTIALLY PAID' : 'PAYMENT DUE';
    const statusFg   = isPaid ? C.success : isPartial ? C.warn : C.danger;
    const statusBg   = isPaid ? C.successBg : isPartial ? C.warnBg : C.dangerBg;

    doc.rect(MAR, totY, 140, 26).fill(statusBg);
    doc.rect(MAR, totY, 4, 26).fill(statusFg);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(statusFg)
       .text(statusText, MAR + 12, totY + 9);

    // ── FOOTER ───────────────────────────────────────────────────────────────
    const footY = 718;
    doc.moveTo(MAR, footY).lineTo(RIGHT, footY)
       .strokeColor(C.border).lineWidth(0.5).stroke();
    doc.fontSize(9).font('Helvetica-Bold').fillColor(C.dark)
       .text('Thank you for your business!', MAR, footY + 12, { width: RIGHT - MAR, align: 'center' });
    doc.fontSize(8).font('Helvetica').fillColor(C.gray)
       .text(
         bizData.address
           ? `${bizData.business_name || ''} · ${bizData.address.split('\n')[0].trim()}`
           : (bizData.business_name || ''),
         MAR, footY + 27, { width: RIGHT - MAR, align: 'center' }
       );

    doc.end();
  });
}

// ── GET /api/invoices/receivable/:id ─────────────────────────────────────────
router.get('/receivable/:id', async (req, res) => {
  try {
    const data = await loadInvoiceData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Invoice not found' });

    const filename = `Invoice-${data.invNum}.pdf`.replace(/[^a-zA-Z0-9.\-_]/g, '-');
    const pdf = await renderInvoicePdf(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
module.exports.loadInvoiceData  = loadInvoiceData;
module.exports.renderInvoicePdf = renderInvoicePdf;
