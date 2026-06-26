import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import DemoModal from './DemoModal.jsx';
import './landing.css';

function CuentaIQLogo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="30" r="28" fill="#2D6A4F" />
      <text x="30" y="42" textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700" fontSize="32" fill="#FFFFFF">Q</text>
      <circle cx="44" cy="16" r="10" fill="#D4A017" />
      <polyline points="39,16 43,20 50,12"
        stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function LandingNav({ onRequestDemo }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const links = [
    { to: '/features',  label: 'Features' },
    { to: '/subscribe', label: 'Pricing'  },
    { to: '/about-us',  label: 'About Us' },
  ];

  return (
    <nav className="l-nav">
      <div className="l-container">
        <div className="l-nav-inner">
          <Link to="/" className="l-nav-logo">
            <CuentaIQLogo size={34} />
            CuentaIQ
          </Link>

          <ul className="l-nav-links">
            {links.map(l => (
              <li key={l.to}>
                <Link to={l.to} className={pathname === l.to ? 'active' : ''}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <button className="l-nav-cta" onClick={onRequestDemo}>Request Demo</button>
            </li>
          </ul>

          <button className="l-nav-toggle" onClick={() => setOpen(o => !o)} aria-label="Menu">
            <span /><span /><span />
          </button>
        </div>

        <div className={`l-nav-mobile ${open ? 'open' : ''}`}>
          {links.map(l => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          <button className="l-btn l-btn-primary"
            style={{ marginTop: 8, justifyContent: 'center' }}
            onClick={() => { setOpen(false); onRequestDemo(); }}>
            Request Demo
          </button>
        </div>
      </div>
    </nav>
  );
}

export function LandingFooter() {
  return (
    <footer className="l-footer">
      <div className="l-container">
        <div className="l-footer-grid">
          <div>
            <div className="l-footer-logo">
              <CuentaIQLogo size={30} />
              CuentaIQ
            </div>
            <p className="l-footer-desc">
              Smart, affordable accounting software built for Philippine small and medium-sized businesses.
            </p>
          </div>
          <div>
            <div className="l-footer-heading">Product</div>
            <ul className="l-footer-links">
              <li><Link to="/features">Features</Link></li>
              <li><Link to="/subscribe">Pricing</Link></li>
              <li><Link to="/about-us">Request a Demo</Link></li>
            </ul>
          </div>
          <div>
            <div className="l-footer-heading">Contact</div>
            <ul className="l-footer-links">
              <li><a href="mailto:hello@cuentaiq.com">hello@cuentaiq.com</a></li>
              <li><a href="mailto:support@cuentaiq.com">support@cuentaiq.com</a></li>
            </ul>
          </div>
        </div>
        <div className="l-footer-bottom">
          <span>© {new Date().getFullYear()} CuentaIQ. All rights reserved.</span>
          <span>Built for Philippine SMEs</span>
        </div>
      </div>
    </footer>
  );
}

export default function LandingLayout({ children }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="l-wrap">
      <LandingNav onRequestDemo={() => setModalOpen(true)} />
      <main>{children}</main>
      <LandingFooter />
      {modalOpen && <DemoModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
