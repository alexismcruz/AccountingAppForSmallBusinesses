import { Link } from 'react-router-dom';
import LandingLayout from './LandingLayout.jsx';
import { CheckCircle, ArrowRight } from 'lucide-react';

const CORE_FEATURES = [
  'Journal Entries (double-entry bookkeeping)',
  'Chart of Accounts',
  'Approval Workflow',
  'Accounts Receivable & Payable',
  'Recurring Invoices',
  'Payment Scheduling',
  'Inventory Management',
  'Tax Management (VAT, custom rates)',
  'Balance Sheet, Income Statement & More',
  'Bulk CSV Import',
  'AI Accounting Assistant',
  'Audit Logs',
];

const PRO_EXTRAS = [
  'Employee Records & Profiles',
  'Payroll with SSS, PhilHealth & Pag-IBIG',
  'Withholding Tax Computation',
  'Leave Management',
  'BIR Form 2316',
  'BIR Form 1601-C',
];

const FAQS = [
  { q: 'Is the price per user or per company?', a: 'Per company. You can have as many users as you need within your company at no extra charge.' },
  { q: 'Are there setup or onboarding fees?',   a: 'No. We set you up for free as part of your demo and onboarding.' },
  { q: 'Can I switch plans later?',             a: 'Yes, you can upgrade from Core to Professional at any time.' },
  { q: 'Is my data safe and private?',          a: 'Yes. Every client gets their own dedicated database — your data is never shared with or visible to other companies.' },
  { q: 'What currency are the prices in?',      a: 'Prices are in USD. Payment is processed via PayPal.' },
];

export default function SubscribePage() {
  return (
    <LandingLayout>
      {/* HEADER */}
      <section className="l-section l-section-cream">
        <div className="l-container l-center">
          <div className="l-section-label">Pricing</div>
          <h1 className="l-section-title" style={{ marginTop: 8 }}>Simple, transparent pricing</h1>
          <p className="l-section-sub" style={{ margin: '16px auto 0' }}>
            One price per company. No per-user fees. No hidden charges. Cancel anytime.
          </p>
        </div>
      </section>

      {/* PLAN CARDS */}
      <section className="l-section">
        <div className="l-container">
          <div className="l-grid-2" style={{ maxWidth: 820, margin: '0 auto', alignItems: 'start' }}>

            {/* CORE */}
            <div className="l-plan-card">
              <div className="l-plan-name">Core</div>
              <div className="l-plan-price"><sup>$</sup>30</div>
              <div className="l-plan-period">per company / month</div>
              <p style={{ fontSize: 14, color: 'var(--l-ink-mid)', lineHeight: 1.6, marginBottom: 20 }}>
                Full accounting suite for businesses that don't need HR and payroll.
              </p>
              <hr className="l-plan-divider" />
              <ul className="l-plan-features">
                {CORE_FEATURES.map(f => (
                  <li key={f}>
                    <span className="l-plan-check"><CheckCircle size={11} /></span>{f}
                  </li>
                ))}
              </ul>
              <Link to="/about-us" className="l-btn l-btn-outline" style={{ width: '100%', justifyContent: 'center' }}>
                Request Demo <ArrowRight size={15} />
              </Link>
            </div>

            {/* PROFESSIONAL */}
            <div className="l-plan-card featured">
              <div className="l-plan-badge">Most Popular</div>
              <div className="l-plan-name">Professional</div>
              <div className="l-plan-price"><sup>$</sup>50</div>
              <div className="l-plan-period">per company / month</div>
              <p style={{ fontSize: 14, color: 'var(--l-ink-mid)', lineHeight: 1.6, marginBottom: 20 }}>
                Everything in Core, plus a complete Payroll and HR module for your team.
              </p>
              <hr className="l-plan-divider" />
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--l-ink-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Everything in Core, plus:
              </div>
              <ul className="l-plan-features">
                {PRO_EXTRAS.map(f => (
                  <li key={f}>
                    <span className="l-plan-check"><CheckCircle size={11} /></span>{f}
                  </li>
                ))}
              </ul>
              <hr className="l-plan-divider" />

              {/* PayPal placeholder */}
              <div style={{
                background: 'var(--l-cream)', border: '1px dashed var(--l-border)',
                borderRadius: 10, padding: '16px', textAlign: 'center', marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, color: 'var(--l-ink-light)', marginBottom: 6 }}>Subscribe via</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#003087', fontFamily: 'Arial, sans-serif', letterSpacing: '-0.5px' }}>
                  Pay<span style={{ color: '#009cde' }}>Pal</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--l-ink-light)', marginTop: 4 }}>
                  Online payment coming soon — contact us to subscribe now
                </div>
              </div>

              <Link to="/about-us" className="l-btn l-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Request Demo <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--l-ink-light)' }}>
            Have a specific need or want to negotiate terms?{' '}
            <a href="mailto:hello@cuentaiq.com" style={{ color: 'var(--l-green)', fontWeight: 600, textDecoration: 'none' }}>
              hello@cuentaiq.com
            </a>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="l-section l-section-cream">
        <div className="l-container" style={{ maxWidth: 680 }}>
          <div className="l-center" style={{ marginBottom: 40 }}>
            <h2 className="l-section-title">Common Questions</h2>
          </div>
          {FAQS.map((item, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--l-border)', paddingBottom: 20, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: 'var(--l-ink)' }}>{item.q}</div>
              <div style={{ fontSize: 14, color: 'var(--l-ink-mid)', lineHeight: 1.7 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </section>
    </LandingLayout>
  );
}
