import { useState } from 'react';
import { Link } from 'react-router-dom';
import LandingLayout from './LandingLayout.jsx';
import { Play, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

function ScreenshotCarousel({ images }) {
  const [idx, setIdx] = useState(0);
  if (!images?.length) return null;
  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);
  return (
    <div className="l-carousel">
      <div className="l-carousel-frame">
        <img src={images[idx].src} alt={images[idx].alt} className="l-carousel-img" />
        {images.length > 1 && <>
          <button className="l-carousel-btn prev" onClick={prev}><ChevronLeft size={18} /></button>
          <button className="l-carousel-btn next" onClick={next}><ChevronRight size={18} /></button>
        </>}
      </div>
      {images.length > 1 && (
        <div className="l-carousel-dots">
          {images.map((_, i) => (
            <button key={i} className={`l-carousel-dot ${i === idx ? 'active' : ''}`} onClick={() => setIdx(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

const FEATURES = [
  {
    number: '01',
    title: 'Dashboard & Financial Reports',
    desc: 'Get a real-time snapshot of your business finances — revenue, expenses, net income, and cash position. Export balance sheets, income statements, trial balances, and general ledgers with one click.',
    tags: ['Balance Sheet', 'Income Statement', 'Trial Balance', 'General Ledger'],
    images: [
      { src: '/screenshots/dashboard-overview.png', alt: 'CuentaIQ Dashboard — financial overview with asset totals and approval queue' },
    ],
  },
  {
    number: '02',
    title: 'Journal Entries & Approvals',
    desc: 'Record any business transaction with a structured journal entry. Built-in approval workflow ensures every entry is reviewed before it hits your books. Import entries in bulk via CSV.',
    tags: ['Double-Entry Bookkeeping', 'Approval Workflow', 'Bulk CSV Import', 'Audit Trail'],
    screenshot: 'Journal Entries — Entry list with approval status badges and line detail',
  },
  {
    number: '03',
    title: 'Payments & Recurring Invoices',
    desc: 'Track incoming collections and outgoing payments. Set up recurring invoices for regular clients and let CuentaIQ generate and record them automatically on schedule.',
    tags: ['Accounts Receivable', 'Accounts Payable', 'Recurring Billing', 'Payment Scheduling'],
    screenshot: 'Payments — AR/AP dashboard with recurring invoice management',
  },
  {
    number: '04',
    title: 'Payroll & HR Management',
    desc: 'Run payroll in minutes with automatic computation of SSS, PhilHealth, Pag-IBIG, and withholding tax. Manage employees, leaves, and generate BIR forms 2316 and 1601-C.',
    tags: ['SSS / PhilHealth / Pag-IBIG', 'Withholding Tax', 'BIR 2316 & 1601-C', 'Leave Tracking'],
    screenshot: 'Payroll — Run summary with per-employee deduction breakdown',
  },
  {
    number: '05',
    title: 'Tax Management',
    desc: 'Track VAT, set up custom tax rates, and monitor filing deadlines all in one place. CuentaIQ maps your transactions to the correct tax categories and projects your liabilities forward.',
    tags: ['VAT Tracking', 'Tax Projections', 'Filing Tracker', 'BIR Compliance'],
    screenshot: 'Tax — Rate configuration, application history, and filing status',
  },
  {
    number: '06',
    title: 'AI Accounting Assistant',
    desc: 'Just describe a transaction in plain language — "we paid ₱15,000 rent for June" — and the AI drafts the correct journal entry. Review, adjust, and post in seconds. Available 24/7.',
    tags: ['Natural Language Input', 'Auto Journal Draft', 'Chart of Accounts Aware', '24/7 Available'],
    screenshot: 'AI Assistant — Chat interface with drafted journal entry ready to post',
  },
];

export default function FeaturesPage() {
  return (
    <LandingLayout>
      {/* HERO */}
      <section className="l-section l-section-cream">
        <div className="l-container l-center">
          <div className="l-section-label">Full Feature Overview</div>
          <h1 className="l-section-title" style={{ marginTop: 8 }}>
            Everything your business needs,<br />nothing you don't
          </h1>
          <p className="l-section-sub" style={{ margin: '16px auto 0' }}>
            CuentaIQ covers every accounting need for Philippine SMEs — from basic bookkeeping to full HR and tax compliance.
          </p>
        </div>
      </section>

      {/* VIDEO */}
      <section className="l-section-sm l-section-ink">
        <div className="l-container">
          <div className="l-video-placeholder">
            <div className="l-play-btn">
              <Play size={28} fill="white" color="white" style={{ marginLeft: 3 }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Watch the 1-Minute Demo</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                Coming soon — book a live demo to see it in action
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE ROWS */}
      <section className="l-section">
        <div className="l-container">
          {FEATURES.map((f, i) => (
            <div key={i} className={`l-feature-row ${i % 2 === 1 ? 'reverse' : ''}`}>
              <div>
                <div className="l-feature-number">{f.number}</div>
                <h2 className="l-feature-row-title">{f.title}</h2>
                <p className="l-feature-row-desc">{f.desc}</p>
                <div className="l-feature-tags">
                  {f.tags.map(t => <span key={t} className="l-feature-tag">{t}</span>)}
                </div>
              </div>
              {f.images
                ? <ScreenshotCarousel images={f.images} />
                : <div className="l-screenshot">{f.screenshot}</div>
              }
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="l-section l-section-green">
        <div className="l-container l-center">
          <h2 className="l-section-title white">See it live in a free demo</h2>
          <p className="l-section-sub white" style={{ margin: '16px auto 32px' }}>
            Book a walkthrough and see how CuentaIQ fits your specific business.
          </p>
          <Link to="/about-us?demo=open" className="l-btn l-btn-gold">
            Request a Demo <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </LandingLayout>
  );
}
