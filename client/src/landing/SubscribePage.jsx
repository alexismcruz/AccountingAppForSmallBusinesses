import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import LandingLayout from './LandingLayout.jsx';
import DemoModal from './DemoModal.jsx';
import { trackLeadConversion } from './track.js';
import { CheckCircle, ArrowRight, Zap, Info } from 'lucide-react';

const STARTER_FEATURES = [
  'Up to 10 users per company',
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
  'Up to 25 users per company (vs. 10 in Starter)',
  'Employee Records & Profiles',
  'Payroll with SSS, PhilHealth & Pag-IBIG',
  'Withholding Tax Computation',
  'Leave Management',
  'BIR Form 2316',
  'BIR Form 1601-C',
  'AI Assistant increased to 100 messages/month',
];

const SETUP_FEE_TIP = `Your $150 setup fee covers: provisioning your dedicated database (your data is never shared with any other client), setting up your personal subdomain at [yourname].cuentaiq.com, and full account onboarding. One-time only — never charged again as long as you stay subscribed. No second fee if you upgrade from Starter to Pro. If you ever cancel, your complete data is exportable in CSV within 5 business days at no charge. This fee is non-refundable once charged as we proceed to set up your environment after payment.`;

const ANNUAL_FEE_TIP = `From Year 2 onward, this $150 annual fee covers ongoing maintenance of your dedicated database hosted on Railway's Singapore servers, and your subdomain renewal. Charged once per year on your account anniversary. We will notify you at least 30 days in advance of any changes to this fee. Your data remains yours — exportable in CSV at any time by emailing support@cuentaiq.com. This fee is non-refundable once charged as we proceed to continue maintenance of your environment once payment is received.`;

const FAQS = [
  { q: 'Is the price per user or per instance?',     a: 'Per instance. Each instance covers one business location or branch — with its own dedicated database, subdomain, and user seats. You can have up to 10 users per Starter instance and up to 25 users per Pro instance at no extra charge. If your business has multiple branches, each branch is set up as a separate instance and billed independently at the same plan rate, with its own $150 setup fee and annual maintenance fee.' },
  { q: 'Are there setup or maintenance fees?',         a: 'Yes — a one-time $150 setup fee applies to all plans. This covers provisioning your dedicated database, your personal subdomain, and full onboarding. From Year 2 onward, there is a $150 annual maintenance fee for database hosting and subdomain renewal, charged on your account anniversary with 30 days advance notice.' },
  { q: 'How long does setup take?',                    a: 'Your environment is ready within 3 to 5 business days of our receiving your one-time setup fee and the onboarding details we need (your business information, chart of accounts preferences, and user list). It is often faster — the window simply gives us room to provision your dedicated database, configure your subdomain, and onboard you properly.' },
  { q: 'Can I switch plans later?',                  a: 'Yes, you can upgrade from Starter to Pro Version at any time.' },
  { q: 'What happens when I hit my AI message limit?', a: 'You\'ll receive an in-app warning at 80% usage. When the limit is reached, you can top up $10 for 15 additional messages — just email support@cuentaiq.com.' },
  { q: 'Is my data safe and private?',               a: 'Yes. Every client gets their own dedicated database — your data is never shared with or visible to other companies.' },
  { q: 'What currency are the prices in?',           a: 'Prices are in USD. Payment is processed via PayPal.' },
  { q: 'What is the Pioneer Program?',               a: 'The Pioneer Program is a limited-time offer for our first 5 clients. Pay a one-time $150 setup fee, get 60 days of real access (free for Starter, $29/month for Pro), then choose to continue at regular pricing — or cancel with no further charges.' },
];

function Tooltip({ tip }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  return (
    <span ref={ref} className="l-tt-wrap">
      <button className="l-tt-btn" type="button" aria-label="More information" onClick={() => setOpen(v => !v)}>
        <Info size={12} />
      </button>
      {open && <div className="l-tt-box">{tip}</div>}
    </span>
  );
}

function PlanCheck() {
  return (
    <span className="l-plan-check"><CheckCircle size={11} /></span>
  );
}

export default function SubscribePage() {
  const [modalOpen, setModalOpen] = useState(false);
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
          <div className="l-pricing-layout">

            {/* ── PIONEER PROGRAM ─────────────────────────────── */}
            <div className="l-pricing-pioneer">
              <div className="l-plan-card pioneer">
                <div className="l-plan-badge-limited">Limited</div>

                <div className="l-plan-name" style={{ paddingRight: 72 }}>Pioneer Program</div>
                <div className="l-pioneer-scarcity">5 slots only · 15-day intake window</div>

                {/* Comparison table: label | Starter | Pro */}
                <div className="l-pioneer-table">
                  {/* Header row */}
                  <div className="l-pioneer-th" />
                  <div className="l-pioneer-th">Starter</div>
                  <div className="l-pioneer-th">Pro</div>
                  {/* Setup fee */}
                  <div className="l-pioneer-td label">Setup fee <Tooltip tip={SETUP_FEE_TIP} /></div>
                  <div className="l-pioneer-td">
                    <div className="l-pioneer-val">$150</div>
                    <div className="l-pioneer-sub">one-time</div>
                  </div>
                  <div className="l-pioneer-td">
                    <div className="l-pioneer-val">$150</div>
                    <div className="l-pioneer-sub">one-time</div>
                  </div>
                  {/* Annual maintenance */}
                  <div className="l-pioneer-td label">Annual fee <Tooltip tip={ANNUAL_FEE_TIP} /></div>
                  <div className="l-pioneer-td">
                    <div className="l-pioneer-val">$150<span className="l-pioneer-sub">/yr</span></div>
                    <div className="l-pioneer-sub">from Year 2</div>
                  </div>
                  <div className="l-pioneer-td">
                    <div className="l-pioneer-val">$150<span className="l-pioneer-sub">/yr</span></div>
                    <div className="l-pioneer-sub">from Year 2</div>
                  </div>
                  {/* Months 1–2 */}
                  <div className="l-pioneer-td label">Months 1–2</div>
                  <div className="l-pioneer-td">
                    <div className="l-pioneer-val">Free</div>
                  </div>
                  <div className="l-pioneer-td">
                    <div className="l-pioneer-val">$29<span className="l-pioneer-sub">/mo</span></div>
                  </div>
                  {/* From month 3 */}
                  <div className="l-pioneer-td label">From month 3</div>
                  <div className="l-pioneer-td">
                    <div className="l-pioneer-val">$39<span className="l-pioneer-sub">/mo</span></div>
                  </div>
                  <div className="l-pioneer-td">
                    <div className="l-pioneer-val">$59<span className="l-pioneer-sub">/mo</span></div>
                  </div>
                  {/* AI messages */}
                  <div className="l-pioneer-td label">AI messages</div>
                  <div className="l-pioneer-td">
                    <div className="l-pioneer-val">50<span className="l-pioneer-sub">/mo</span></div>
                  </div>
                  <div className="l-pioneer-td">
                    <div className="l-pioneer-val">100<span className="l-pioneer-sub">/mo</span></div>
                  </div>
                  {/* Users */}
                  <div className="l-pioneer-td label last">Users</div>
                  <div className="l-pioneer-td last">
                    <div className="l-pioneer-val">Up to 5</div>
                  </div>
                  <div className="l-pioneer-td last">
                    <div className="l-pioneer-val">Up to 5</div>
                  </div>
                </div>

                <p className="l-pioneer-tagline">
                  For small business owners who want to try CuentaIQ before committing. Pay a one-time setup fee, get 60 days of real access, and decide if you want to continue — no pressure.
                </p>

                <hr className="l-plan-divider" />

                <div className="l-pioneer-features">
                  <strong>Pioneer Starter includes:</strong>
                  bookkeeping, BIR forms, inventory, e-commerce sync, AI Assistant
                  <strong>Pioneer Pro includes:</strong>
                  everything in Starter + HR &amp; Payroll, payroll computation, SSS/PhilHealth/Pag-IBIG, leave management, BIR payroll forms
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <hr className="l-plan-divider" />
                  <a href="https://form.typeform.com/to/FgwZydmg" target="_blank" rel="noopener noreferrer" onClick={trackLeadConversion} className="l-btn l-btn-pioneer" style={{ width: '100%', justifyContent: 'center' }}>
                    Apply for Pioneer Access <ArrowRight size={15} />
                  </a>
                  <div className="l-pioneer-cta-footer">Intake closes 15 days after launch · Max 5 pioneers</div>
                  <div className="l-pioneer-notice">
                    <strong>Conversion notice:</strong> You'll receive a notice 15 days before your pioneer period ends — choose to continue, upgrade, downgrade, or cancel. No automatic charges beyond what you've already paid.
                  </div>
                </div>
              </div>
            </div>

            {/* ── STARTER + FULL VERSION ───────────────────────── */}
            <div className="l-pricing-standard">

              {/* STARTER */}
              <div className="l-plan-card">
                <div className="l-plan-name">Starter</div>
                <div className="l-plan-price"><sup>$</sup>39</div>
                <div className="l-plan-period">per company / month</div>
                <div style={{ fontSize: 13, color: 'var(--l-ink-mid)', marginBottom: 6 }}>
                  + <strong style={{ color: 'var(--l-ink)' }}>$150</strong> one-time setup fee <Tooltip tip={SETUP_FEE_TIP} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--l-ink-mid)', marginBottom: 16 }}>
                  + <strong style={{ color: 'var(--l-ink)' }}>$150</strong>/yr annual maintenance <Tooltip tip={ANNUAL_FEE_TIP} />{' '}
                  <span style={{ fontSize: 11, color: 'var(--l-ink-light)' }}>(from Year 2)</span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--l-ink-mid)', lineHeight: 1.6, marginBottom: 20 }}>
                  Full accounting suite for businesses that don't need HR and payroll.
                </p>
                <hr className="l-plan-divider" />
                <ul className="l-plan-features">
                  {STARTER_FEATURES.map(f => (
                    <li key={f}><PlanCheck />{f}</li>
                  ))}
                </ul>
                <button type="button" className="l-btn l-btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setModalOpen(true)}>
                  Request Demo <ArrowRight size={15} />
                </button>
              </div>

              {/* PRO VERSION */}
              <div className="l-plan-card featured">
                <div className="l-plan-badge">Most Popular</div>
                <div className="l-plan-name">Pro Version</div>
                <div className="l-plan-price"><sup>$</sup>59</div>
                <div className="l-plan-period">per company / month</div>
                <div style={{ fontSize: 13, color: 'var(--l-ink-mid)', marginBottom: 6 }}>
                  + <strong style={{ color: 'var(--l-ink)' }}>$150</strong> one-time setup fee <Tooltip tip={SETUP_FEE_TIP} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--l-ink-mid)', marginBottom: 16 }}>
                  + <strong style={{ color: 'var(--l-ink)' }}>$150</strong>/yr annual maintenance <Tooltip tip={ANNUAL_FEE_TIP} />{' '}
                  <span style={{ fontSize: 11, color: 'var(--l-ink-light)' }}>(from Year 2)</span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--l-ink-mid)', lineHeight: 1.6, marginBottom: 20 }}>
                  Everything in Starter, plus a complete Payroll and HR module for your team.
                </p>
                <hr className="l-plan-divider" />
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--l-ink-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Everything in Starter, plus:
                </div>
                <ul className="l-plan-features">
                  {FULL_EXTRAS.map(f => (
                    <li key={f}><PlanCheck />{f}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto' }}>
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

                  <button type="button" className="l-btn l-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setModalOpen(true)}>
                    Request Demo <ArrowRight size={15} />
                  </button>
                </div>
              </div>

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
              Contact <a href="mailto:support@cuentaiq.com" style={{ color: 'var(--l-green)', fontWeight: 600, textDecoration: 'none' }}>support@cuentaiq.com</a> to top up.
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--l-ink-light)' }}>
            Have a specific need or want to negotiate terms?{' '}
            <a href="mailto:support@cuentaiq.com" style={{ color: 'var(--l-green)', fontWeight: 600, textDecoration: 'none' }}>
              support@cuentaiq.com
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
      {modalOpen && <DemoModal onClose={() => setModalOpen(false)} />}
    </LandingLayout>
  );
}
