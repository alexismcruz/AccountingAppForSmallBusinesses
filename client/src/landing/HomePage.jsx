import { useState } from 'react';
import { Link } from 'react-router-dom';
import LandingLayout from './LandingLayout.jsx';
import DemoModal from './DemoModal.jsx';
import { trackLeadConversion } from './track.js';
import { BookOpen, Users, Sparkles, BarChart2, FileCheck, Package, ArrowRight, CheckCircle } from 'lucide-react';

const FEATURES = [
  {
    icon: <BookOpen size={22} />,
    title: 'Complete Accounting Suite',
    desc: 'Journal entries, chart of accounts, payments, recurring invoices, and financial reports — everything in one place.',
  },
  {
    icon: <Users size={22} />,
    title: 'Payroll & HR Management',
    desc: 'Run payroll with automatic SSS, PhilHealth, and Pag-IBIG computations. Manage leaves, BIR forms, and employees.',
  },
  {
    icon: <Sparkles size={22} />,
    title: 'AI Accounting Assistant',
    desc: 'Describe a transaction in plain language and the AI drafts the correct journal entry — just review and post.',
  },
  {
    icon: <BarChart2 size={22} />,
    title: 'Financial Reports',
    desc: 'Balance sheet, income statement, trial balance, and general ledger — ready to export anytime.',
  },
  {
    icon: <FileCheck size={22} />,
    title: 'BIR Tax Compliance',
    desc: 'VAT tracking, tax projections, and BIR form generation. Stay compliant without the headache.',
  },
  {
    icon: <Package size={22} />,
    title: 'Inventory Management',
    desc: 'Track stock levels, set reorder points, and manage inventory with a complete audit trail.',
  },
];

const STATS = [
  { val: '7+',  label: 'Core Modules'       },
  { val: 'BIR', label: 'Tax Ready'          },
  { val: 'AI',  label: 'Powered Assistant'  },
  { val: 'PHP', label: 'Native Currency'    },
];

function AppMockup() {
  const bars = [45, 60, 40, 75, 55, 80, 65, 90, 70, 85, 60, 95];
  return (
    <div className="l-hero-mockup">
      <div className="l-hero-mockup-bar">
        <div className="l-hero-mockup-dot" style={{ background: '#ff5f57' }} />
        <div className="l-hero-mockup-dot" style={{ background: '#ffbd2e' }} />
        <div className="l-hero-mockup-dot" style={{ background: '#28c840' }} />
        <span style={{ marginLeft: 8, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
          CuentaIQ — Dashboard
        </span>
      </div>
      <div style={{ display: 'flex', height: 290 }}>
        {/* Sidebar */}
        <div style={{ width: 52, background: '#1B2E24', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 8 }}>
          {['Q','J','P','R','T','⚙'].map((item, i) => (
            <div key={i} style={{
              width: 30, height: 30, borderRadius: 7,
              background: i === 0 ? '#2D6A4F' : 'rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: i === 0 ? 'white' : 'rgba(255,255,255,0.5)', fontWeight: 600,
            }}>{item}</div>
          ))}
        </div>
        {/* Content */}
        <div style={{ flex: 1, background: '#F8F5EF', padding: 14, overflow: 'hidden' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#4A5E52', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Dashboard</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 10 }}>
            {[{ l: 'Revenue', v: '₱248K', c: '#2D6A4F' }, { l: 'Expenses', v: '₱142K', c: '#D4A017' }, { l: 'Net Income', v: '₱106K', c: '#1B2E24' }].map((s, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 6, padding: '8px 10px', border: '1px solid #E2DDD4' }}>
                <div style={{ fontSize: 8, color: '#8A9E92', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.l}</div>
                <div style={{ fontSize: 15, fontFamily: "'DM Serif Display',serif", color: s.c, marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'white', borderRadius: 6, border: '1px solid #E2DDD4', padding: '10px 12px' }}>
            <div style={{ fontSize: 8, color: '#8A9E92', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Monthly Overview</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
              {bars.map((h, i) => (
                <div key={i} style={{
                  flex: 1, height: `${h}%`, borderRadius: '3px 3px 0 0',
                  background: i === bars.length - 1 ? '#2D6A4F' : (i % 2 === 0 ? '#D4E8DC' : '#EAF2EE'),
                }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <LandingLayout>
      {/* HERO */}
      <section className="l-hero">
        <div className="l-container">
          <div className="l-hero-inner">
            <div>
              <div className="l-hero-tag">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2D6A4F', display: 'inline-block' }} />
                Built for Philippine SMEs
              </div>
              <h1 className="l-hero-title">
                Smart Accounting<br />
                Built for <span className="accent">Filipino</span><br />
                Business
              </h1>
              <p className="l-hero-sub">
                From journal entries and payroll to tax compliance and inventory — CuentaIQ is the all-in-one accounting platform your business deserves.
              </p>
              <div className="l-hero-btns">
                <button className="l-btn l-btn-primary" onClick={() => setModalOpen(true)}>
                  Request a Demo <ArrowRight size={16} />
                </button>
                <Link to="/features" className="l-btn l-btn-outline">
                  See Features
                </Link>
              </div>
            </div>
            <div>
              <AppMockup />
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="l-stats-bar">
        {STATS.map((s, i) => (
          <div key={i} className="l-stat">
            <div className="l-stat-val">{s.val}</div>
            <div className="l-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* FEATURES */}
      <section className="l-section">
        <div className="l-container">
          <div className="l-center" style={{ marginBottom: 48 }}>
            <div className="l-section-label">Everything You Need</div>
            <h2 className="l-section-title">One platform, your complete books</h2>
            <p className="l-section-sub">
              CuentaIQ brings together every tool a Philippine SME needs to manage finances — without the complexity or cost of enterprise software.
            </p>
          </div>
          <div className="l-grid-3">
            {FEATURES.map((f, i) => (
              <div key={i} className="l-card">
                <div className="l-feature-icon">{f.icon}</div>
                <div className="l-feature-title">{f.title}</div>
                <p className="l-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section className="l-section l-section-cream">
        <div className="l-container">
          <div className="l-center" style={{ marginBottom: 48 }}>
            <div className="l-section-label">Simple Pricing</div>
            <h2 className="l-section-title">One price, no surprises</h2>
            <p className="l-section-sub">Per company. No per-user fees. Cancel anytime.</p>
          </div>
          <div className="l-pricing-layout">

            {/* ── Pioneer ── */}
            <div className="l-pricing-pioneer">
              <div className="l-plan-card pioneer" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="l-plan-name" style={{ color: 'var(--l-gold-dark)' }}>Pioneer Program</div>
                <div style={{ fontSize: 13, color: 'var(--l-ink-mid)', marginBottom: 16, lineHeight: 1.6 }}>
                  Early access with a $150 one-time setup fee. Get 60 days of real access — then decide to stay, upgrade, or cancel. No pressure.
                </div>
                <ul className="l-plan-features" style={{ flex: 1 }}>
                  {[
                    'Full platform access during trial',
                    'Months 1–2 free (Starter) or $29/mo (Pro)',
                    'From month 3: $39–$59/mo',
                    '$150/yr maintenance from Year 2',
                    'Up to 5 users',
                  ].map(f => (
                    <li key={f}><span className="l-plan-check" style={{ color: 'var(--l-gold)' }}><CheckCircle size={11} /></span>{f}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                  <a href="https://form.typeform.com/to/FgwZydmg" target="_blank" rel="noopener noreferrer"
                    onClick={trackLeadConversion}
                    className="l-btn l-btn-pioneer" style={{ width: '100%', justifyContent: 'center' }}>
                    Apply for Pioneer Access <ArrowRight size={15} />
                  </a>
                  <div className="l-pioneer-cta-footer">Max 5 pioneers · Intake closes 15 days after launch</div>
                </div>
              </div>
            </div>

            {/* ── Starter + Pro ── */}
            <div className="l-pricing-standard">
              <div className="l-plan-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="l-plan-name">Starter</div>
                <div className="l-plan-price"><sup>$</sup>39</div>
                <div className="l-plan-period">per company / month</div>
                <ul className="l-plan-features" style={{ flex: 1 }}>
                  {['Journal Entries & Approvals','Payments & Invoicing','Tax Management','Inventory Tracking','Financial Reports','AI Assistant'].map(f => (
                    <li key={f}><span className="l-plan-check"><CheckCircle size={11} /></span>{f}</li>
                  ))}
                </ul>
                <Link to="/subscribe" className="l-btn l-btn-outline" style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}>
                  Learn More
                </Link>
              </div>
              <div className="l-plan-card featured" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="l-plan-badge">Most Popular</div>
                <div className="l-plan-name">Pro</div>
                <div className="l-plan-price"><sup>$</sup>59</div>
                <div className="l-plan-period">per company / month</div>
                <ul className="l-plan-features" style={{ flex: 1 }}>
                  {['Everything in Starter','Payroll Management','HR & Employee Records','Leave Management','BIR Forms (2316, 1601-C)','Government Remittances'].map(f => (
                    <li key={f}><span className="l-plan-check"><CheckCircle size={11} /></span>{f}</li>
                  ))}
                </ul>
                <Link to="/subscribe" className="l-btn l-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}>
                  Learn More
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="l-section l-section-green">
        <div className="l-container l-center">
          <div className="l-section-label white">Get Started</div>
          <h2 className="l-section-title white" style={{ marginTop: 8 }}>
            Ready to simplify your accounting?
          </h2>
          <p className="l-section-sub white" style={{ margin: '16px auto 32px' }}>
            Book a free demo and see how CuentaIQ can work for your business.
          </p>
          <button className="l-btn l-btn-gold" onClick={() => setModalOpen(true)}>
            Request a Free Demo <ArrowRight size={16} />
          </button>
        </div>
      </section>
      {modalOpen && <DemoModal onClose={() => setModalOpen(false)} />}
    </LandingLayout>
  );
}
