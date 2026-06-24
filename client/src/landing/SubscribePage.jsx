import { Link } from 'react-router-dom';
import LandingLayout from './LandingLayout.jsx';
import { CheckCircle, ArrowRight, Zap } from 'lucide-react';

const STARTER_FEATURES = [
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
  'AI Accounting Assistant — 50 messages/month',
  'Audit Logs',
];

const FULL_EXTRAS = [
  'Employee Records & Profiles',
  'Payroll with SSS, PhilHealth & Pag-IBIG',
  'Withholding Tax Computation',
  'Leave Management',
  'BIR Form 2316',
  'BIR Form 1601-C',
  'AI Assistant increased to 100 messages/month',
];

const FAQS = [
  { q: 'Is the price per user or per company?',      a: 'Per company. You can have as many users as you need within your company at no extra charge.' },
  { q: 'Are there setup or onboarding fees?',        a: 'No. We set you up for free as part of your demo and onboarding.' },
  { q: 'Can I switch plans later?',                  a: 'Yes, you can upgrade from Starter to Full Version at any time.' },
  { q: 'What happens when I hit my AI message limit?', a: 'You\'ll receive an in-app warning at 80% usage. When the limit is reached, you can top up $10 for 15 additional messages — just email hello@cuentaiq.com.' },
  { q: 'Is my data safe and private?',               a: 'Yes. Every client gets their own dedicated database — your data is never shared with or visible to other companies.' },
  { q: 'What currency are the prices in?',           a: 'Prices are in USD. Payment is processed via PayPal.' },
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

            {/* STARTER */}
            <div className="l-plan-card">
              <div className="l-plan-name">Starter</div>
              <div className="l-plan-price"><sup>$</sup>39</div>
              <div className="l-plan-period">per company / month</div>
              <p style={{ fontSize: 14, color: 'var(--l-ink-mid)', lineHeight: 1.6, marginBottom: 20 }}>
                Full accounting suite for businesses that don't need HR and payroll.
              </p>
              <hr className="l-plan-divider" />
              <ul className="l-plan-features">
                {STARTER_FEATURES.map(f => (
                  <li key={f}>
                    <span className="l-plan-check"><CheckCircle size={11} /></span>{f}
                  </li>
                ))}
              </ul>
              <Link to="/about-us?demo=open" className="l-btn l-btn-outline" style={{ width: '100%', justifyContent: 'center' }}>
                Request Demo <ArrowRight size={15} />
              </Link>
            </div>

            {/* FULL VERSION */}
            <div className="l-plan-card featured">
              <div className="l-plan-badge">Most Popular</div>
              <div className="l-plan-name">Full Version</div>
              <div className="l-plan-price"><sup>$</sup>59</div>
              <div className="l-plan-period">per company / month</div>
              <p style={{ fontSize: 14, color: 'var(--l-ink-mid)', lineHeight: 1.6, marginBottom: 20 }}>
                Everything in Starter, plus a complete Payroll and HR module for your team.
              </p>
              <hr className="l-plan-divider" />
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--l-ink-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Everything in Starter, plus:
              </div>
              <ul className="l-plan-features">
                {FULL_EXTRAS.map(f => (
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

              <Link to="/about-us?demo=open" className="l-btn l-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Request Demo <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          {/* AI Top-up note */}
          <div style={{
            maxWidth: 820, margin: '24px auto 0',
            background: 'var(--l-green-light)', border: '1px solid #b7d9c8',
            borderRadius: 12, padding: '16px 24px',
            display: 'flex', alignItems: 'flex-start', gap: 14,
          }}>
            <Zap size={18} color="var(--l-green)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: 'var(--l-ink-mid)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--l-ink)' }}>AI message top-up:</strong> Need more AI assistant messages?
              Top up $10 for 15 additional messages at any time — no plan change required.
              You'll receive an in-app warning at 80% usage so you're never caught off guard.
              Contact <a href="mailto:hello@cuentaiq.com" style={{ color: 'var(--l-green)', fontWeight: 600, textDecoration: 'none' }}>hello@cuentaiq.com</a> to top up.
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--l-ink-light)' }}>
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
