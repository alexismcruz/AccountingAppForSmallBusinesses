import { useState } from 'react';

function CuentaIQLogo({ size = 60 }) {
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

export default function Login({ onLogin }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data.user || null);
      } else {
        setError(data.error || 'Incorrect credentials.');
      }
    } catch {
      setError('Could not connect to the server. Make sure the app is running.');
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !email || !password;

  const inputStyle = {
    width: '100%', padding: '11px 14px', fontSize: 14,
    fontFamily: 'var(--font-body, Inter, sans-serif)',
    background: '#FFFFFF',
    border: '1px solid #E2DDD4', borderRadius: 6,
    outline: 'none', boxSizing: 'border-box',
    color: '#1B2E24',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 60% 40%, #EAF2EE 0%, #F8F5EF 60%)',
      fontFamily: 'var(--font-body, Inter, sans-serif)',
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: 14,
        padding: '48px 52px',
        boxShadow: '0 8px 32px rgba(27,46,36,0.12)',
        width: '100%', maxWidth: 400, margin: '0 16px',
      }}>
        {/* Logo + wordmark */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <CuentaIQLogo size={60} />
          </div>
          <div style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontWeight: 400, fontSize: 26,
            color: '#2D6A4F', letterSpacing: '-0.01em',
            lineHeight: 1,
          }}>
            CuentaIQ
          </div>
          <div style={{
            fontFamily: 'var(--font-body, Inter, sans-serif)',
            color: '#4A5E52', fontSize: 13, marginTop: 7,
          }}>
            Sign in to access your books
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 500,
              color: '#4A5E52', marginBottom: 6,
              fontFamily: 'var(--font-body, Inter, sans-serif)',
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoFocus
              required
              style={inputStyle}
              onFocus={e => {
                e.target.style.borderColor = '#2D6A4F';
                e.target.style.boxShadow = '0 0 0 3px #EAF2EE';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#E2DDD4';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 500,
              color: '#4A5E52', marginBottom: 6,
              fontFamily: 'var(--font-body, Inter, sans-serif)',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={inputStyle}
              onFocus={e => {
                e.target.style.borderColor = '#2D6A4F';
                e.target.style.boxShadow = '0 0 0 3px #EAF2EE';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#E2DDD4';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
              borderRadius: 6, padding: '10px 14px', fontSize: 13,
              fontFamily: 'var(--font-body, Inter, sans-serif)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={disabled}
            style={{
              width: '100%', padding: '12px',
              background: disabled ? '#8A9E92' : '#2D6A4F',
              color: 'white', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 600,
              fontFamily: 'var(--font-body, Inter, sans-serif)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={e => { if (!disabled) e.target.style.background = '#245740'; }}
            onMouseLeave={e => { if (!disabled) e.target.style.background = '#2D6A4F'; }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{
          textAlign: 'center', marginTop: 24, fontSize: 12,
          color: '#8A9E92',
          fontFamily: 'var(--font-body, Inter, sans-serif)',
        }}>
          Your financial data is private and encrypted in transit.
        </div>
      </div>
    </div>
  );
}
