import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import LandingLayout from './LandingLayout.jsx';
import DemoModal from './DemoModal.jsx';
import { ArrowRight, Mail, MapPin } from 'lucide-react';

export default function AboutPage() {
  const [searchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('demo') === 'open') setModalOpen(true);
  }, []);

  return (
    <LandingLayout>
      {/* HERO */}
      <section className="l-section l-section-cream">
        <div className="l-container l-center">
          <div className="l-section-label">Who We Are</div>
          <h1 className="l-section-title" style={{ marginTop: 8 }}>
            Accounting should work <em>for</em> you,<br />not against you.
          </h1>
          <p className="l-section-sub" style={{ margin: '16px auto 0' }}>
            CuentaIQ was built out of a simple frustration: Philippine small businesses deserved better tools than spreadsheets and overpriced enterprise software.
          </p>
        </div>
      </section>

      {/* MISSION / VISION */}
      <section className="l-section">
        <div className="l-container">
          <div className="l-grid-2">
            <div className="l-mv-card mission">
              <div className="l-mv-label">Our Mission</div>
              <p className="l-mv-text">
                To empower Filipino small and medium-sized businesses with professional-grade accounting tools that are simple, affordable, and built for the way they work.
              </p>
            </div>
            <div className="l-mv-card vision">
              <div className="l-mv-label">Our Vision</div>
              <p className="l-mv-text">
                A Philippines where every business — no matter how small — has the financial clarity and confidence to grow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT WE DO */}
      <section className="l-section l-section-cream">
        <div className="l-container">
          <div className="l-grid-2" style={{ alignItems: 'center', gap: 60 }}>
            <div>
              <div className="l-section-label">What We Do</div>
              <h2 className="l-section-title" style={{ marginTop: 12 }}>
                Built from the ground up for Philippine business
              </h2>
              <p style={{ fontSize: 16, color: 'var(--l-ink-mid)', lineHeight: 1.75, marginBottom: 20 }}>
                CuentaIQ is a cloud-based accounting platform tailored for the Philippine market — with native PHP support, BIR tax compliance built in, and government deduction calculations for SSS, PhilHealth, and Pag-IBIG baked right into the payroll engine.
              </p>
              <p style={{ fontSize: 16, color: 'var(--l-ink-mid)', lineHeight: 1.75 }}>
                We combine professional-grade features with a clean, intuitive interface that works for business owners and their accounting staff alike — no formal accounting degree required.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Built for the Philippines', desc: 'BIR compliance, Philippine tax system, PHP-native' },
                { label: 'AI-Powered',                desc: 'Record transactions in plain language with our AI assistant' },
                { label: 'Secure & Private',          desc: 'Each client gets their own dedicated database — no shared data' },
                { label: 'Cloud-Based',               desc: 'Access your books from anywhere, anytime' },
              ].map((item, i) => (
                <div key={i} className="l-card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '16px 20px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--l-green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
                    {['🇵🇭','🤖','🔒','☁️'][i]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, color: 'var(--l-ink)' }}>{item.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--l-ink-mid)' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* REQUEST DEMO */}
      <section className="l-section">
        <div className="l-container">
          <div className="l-grid-2" style={{ alignItems: 'center', gap: 60 }}>
            <div>
              <div className="l-section-label">Get in Touch</div>
              <h2 className="l-section-title" style={{ marginTop: 12 }}>
                Let's show you what CuentaIQ can do
              </h2>
              <p style={{ fontSize: 16, color: 'var(--l-ink-mid)', lineHeight: 1.75, marginBottom: 32 }}>
                Book a free demo and we'll walk you through the platform, answer your questions, and set you up for success.
              </p>
              <button className="l-btn l-btn-primary" onClick={() => setModalOpen(true)}>
                Request a Demo <ArrowRight size={16} />
              </button>
              <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--l-ink-mid)' }}>
                  <Mail size={16} color="var(--l-green)" />
                  <a href="mailto:hello@cuentaiq.com" style={{ color: 'var(--l-green)', textDecoration: 'none', fontWeight: 500 }}>
                    hello@cuentaiq.com
                  </a>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--l-ink-mid)' }}>
                  <MapPin size={16} color="var(--l-green)" />
                  Philippines
                </div>
              </div>
            </div>
            <div className="l-card" style={{ padding: 32, background: 'var(--l-cream)', border: '1px solid var(--l-border)' }}>
              <h3 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, marginBottom: 20, color: 'var(--l-ink)' }}>
                What to expect in a demo
              </h3>
              {[
                'A live walkthrough of the full platform',
                'Answers to your specific questions',
                'Pricing and onboarding details',
                'A custom setup plan for your business',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--l-green)', color: 'white',
                    fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 1,
                  }}>✓</span>
                  <span style={{ fontSize: 14, color: 'var(--l-ink-mid)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* DEMO MODAL */}
      {modalOpen && <DemoModal onClose={() => setModalOpen(false)} />}
    </LandingLayout>
  );
}
