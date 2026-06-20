import { useState, useRef, useEffect, useCallback } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Draft Entry Card ──────────────────────────────────────────────────────────

function DraftEntryCard({ entry, onPost, onDiscard, posted, posting }) {
  const totalDebit  = entry.lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = entry.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.005;

  return (
    <div style={{
      background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-mid)',
      borderRadius: 10, padding: 14, marginTop: 8,
    }}>
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: 13 }}>Draft Journal Entry</span>
      </div>

      {/* Description + date */}
      <div style={{ marginBottom: 10, fontSize: 13 }}>
        <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{entry.description}</span>
        <span style={{
          marginLeft: 8, background: 'var(--color-primary)', color: '#fff',
          padding: '1px 7px', borderRadius: 12, fontSize: 11, fontWeight: 500,
        }}>
          {entry.date}
        </span>
      </div>

      {/* Lines table */}
      <div style={{ border: '1px solid var(--color-primary-mid)', borderRadius: 7, overflow: 'hidden', marginBottom: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--color-primary)' }}>
              <th style={{ padding: '5px 8px', textAlign: 'left',  color: '#fff', fontWeight: 600 }}>Account</th>
              <th style={{ padding: '5px 8px', textAlign: 'right', color: '#fff', fontWeight: 600, width: 72 }}>Debit</th>
              <th style={{ padding: '5px 8px', textAlign: 'right', color: '#fff', fontWeight: 600, width: 72 }}>Credit</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--color-primary-mid)', background: i % 2 ? 'var(--color-primary-light)' : '#fff' }}>
                <td style={{ padding: '5px 8px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-ink)', fontSize: 11 }}>{line.account_code}</span>
                  <span style={{ color: 'var(--color-ink-mid)', marginLeft: 4 }}>{line.account_name}</span>
                  {line.description && (
                    <div style={{ fontSize: 10, color: 'var(--color-ink-light)', marginTop: 1 }}>{line.description}</div>
                  )}
                </td>
                <td style={{
                  padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace',
                  color: line.debit > 0 ? 'var(--color-primary)' : 'var(--color-border)',
                }}>
                  {line.debit > 0 ? fmt(line.debit) : '—'}
                </td>
                <td style={{
                  padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace',
                  color: line.credit > 0 ? 'var(--danger)' : 'var(--color-border)',
                }}>
                  {line.credit > 0 ? fmt(line.credit) : '—'}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid var(--color-primary)', background: 'var(--color-primary)', fontWeight: 700 }}>
              <td style={{ padding: '5px 8px', color: '#fff', fontSize: 12 }}>Total</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#fff', fontSize: 12 }}>
                {fmt(totalDebit)}
              </td>
              <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#fff', fontSize: 12 }}>
                {fmt(totalCredit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Plain-English explanation */}
      {entry.explanation && (
        <div style={{
          fontSize: 12, color: 'var(--color-ink-mid)', marginBottom: 12,
          lineHeight: 1.6, padding: '8px 10px',
          background: '#fff', borderRadius: 6, border: '1px solid var(--color-primary-mid)',
        }}>
          {entry.explanation}
        </div>
      )}

      {!balanced && (
        <div style={{
          color: 'var(--danger)', fontSize: 12, marginBottom: 10,
          background: 'var(--danger-bg)', padding: '6px 10px', borderRadius: 6,
        }}>
          This entry is not balanced. Please discard and try again.
        </div>
      )}

      {/* Actions */}
      {posted ? (
        <div style={{
          color: 'var(--color-primary)', fontWeight: 600, fontSize: 13,
          padding: '8px 10px', background: 'var(--color-primary-light)', borderRadius: 6,
        }}>
          Posted as <strong>{posted.reference}</strong>
          {posted.status === 'pending_approval' && (
            <span style={{ fontWeight: 400, color: 'var(--color-ink-mid)' }}> · Pending approval</span>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onPost}
            disabled={!balanced || posting}
            style={{
              flex: 1, padding: '8px 14px',
              background: !balanced || posting ? 'var(--color-ink-light)' : 'var(--color-primary)',
              color: '#fff', border: 'none', borderRadius: 7,
              cursor: !balanced || posting ? 'default' : 'pointer',
              fontWeight: 600, fontSize: 13, transition: 'background 0.15s',
            }}
          >
            {posting ? 'Posting…' : 'Post Entry'}
          </button>
          <button
            onClick={onDiscard}
            disabled={posting}
            style={{
              padding: '8px 14px', background: '#fff',
              color: 'var(--color-ink-mid)', border: '1px solid var(--color-border)',
              borderRadius: 7, cursor: posting ? 'default' : 'pointer',
              fontSize: 13,
            }}
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
}

// ── Single Message Bubble ─────────────────────────────────────────────────────

function ChatMessage({ msg, onPost, onDiscard }) {
  const isUser = msg.role === 'user';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 10,
      alignItems: 'flex-start',
    }}>
      {/* Assistant avatar */}
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--color-primary)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, flexShrink: 0, marginRight: 7, marginTop: 2,
          fontFamily: 'var(--font-body, Inter, sans-serif)',
          letterSpacing: '0.02em',
        }}>
          IQ
        </div>
      )}

      <div style={{ maxWidth: '84%' }}>
        {/* Text bubble */}
        {msg.content && (
          <div style={{
            background:   isUser ? 'var(--color-primary)' : 'var(--color-surface-2)',
            color:        isUser ? '#fff' : 'var(--color-ink)',
            padding:      '9px 13px',
            borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
            fontSize:     13,
            lineHeight:   1.55,
            whiteSpace:   'pre-wrap',
          }}>
            {msg.content}
          </div>
        )}

        {/* Draft entry card */}
        {msg.draftEntry && !msg.discarded && (
          <DraftEntryCard
            entry={msg.draftEntry}
            onPost={() => onPost(msg.id)}
            onDiscard={() => onDiscard(msg.id)}
            posted={msg.posted}
            posting={msg.posting}
          />
        )}
      </div>
    </div>
  );
}

// ── Typing Indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'var(--color-primary)',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-body, Inter, sans-serif)',
      }}>
        IQ
      </div>
      <div style={{
        background: 'var(--color-surface-2)', padding: '10px 14px',
        borderRadius: '4px 18px 18px 18px', display: 'flex', gap: 4, alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--color-ink-light)', display: 'inline-block',
            animation: `chatbotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Send icon SVG ─────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M14 8L2 2l2.5 6L2 14l12-6z" fill="currentColor" />
    </svg>
  );
}

// ── Main Widget ───────────────────────────────────────────────────────────────

const WELCOME = {
  id: 0,
  role: 'assistant',
  content:
    "Hi there! I'm your CuentaIQ accounting assistant.\n\n" +
    "Just describe any business transaction in plain language and I'll help you record it correctly — " +
    "no accounting experience needed!\n\n" +
    "For example:\n" +
    "• \"I paid ₱15,000 rent for May from my BDO account\"\n" +
    "• \"A customer paid their invoice of ₱50,000 in cash\"\n" +
    "• \"We bought office supplies worth ₱3,200 on credit\"",
};

let _nextId = 1;
const nextId = () => _nextId++;

export default function ChatbotWidget() {
  const [open,     setOpen]     = useState(false);
  const [input,    setInput]    = useState('');
  const [messages, setMessages] = useState([WELCOME]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Track viewport width
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  // Prevent body scroll on mobile when panel is open
  useEffect(() => {
    if (isMobile) {
      document.body.style.overflow = open ? 'hidden' : '';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open, isMobile]);

  const buildHistory = useCallback((msgs, plusUser = null) => {
    const history = msgs
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
      .map(m => ({ role: m.role, content: m.content || '' }));
    if (plusUser) history.push({ role: 'user', content: plusUser });
    while (history.length > 0 && history[0].role === 'assistant') history.shift();
    return history;
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { id: nextId(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const history = buildHistory([...messages, userMsg]);

      const res = await fetch('/api/chatbot/message', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      setMessages(prev => [...prev, {
        id:         nextId(),
        role:       'assistant',
        content:    data.text    || '',
        draftEntry: data.draftEntry || null,
      }]);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (msgId) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg?.draftEntry || msg.posting || msg.posted) return;

    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, posting: true } : m));

    try {
      const res = await fetch('/api/chatbot/post', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ draftEntry: msg.draftEntry }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post');

      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, posting: false, posted: data } : m
      ));

      setMessages(prev => [...prev, {
        id:   nextId(),
        role: 'assistant',
        content:
          `Entry ${data.reference} has been ` +
          `${data.status === 'posted' ? 'posted to the ledger' : 'submitted for approval'}.\n\n` +
          `Is there anything else you'd like to record?`,
      }]);
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, posting: false } : m));
      setError(err.message);
    }
  };

  const handleDiscard = (msgId) => {
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, discarded: true } : m
    ));
    setMessages(prev => [...prev, {
      id:   nextId(),
      role: 'assistant',
      content: "No problem — I've discarded that draft. Feel free to describe the transaction again with any corrections!",
    }]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Panel dimensions — full screen on mobile, corner popup on desktop
  const panelStyle = isMobile ? {
    position: 'fixed', inset: 0,
    width: '100%', height: '100%',
    borderRadius: 0,
    zIndex: 1000,
  } : {
    position: 'fixed', bottom: 90, right: 24,
    width: 390, height: 530,
    borderRadius: 18,
    zIndex: 1000,
  };

  return (
    <>
      <style>{`
        @keyframes chatbotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%            { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>

      {/* ── Chat Panel ── */}
      {open && (
        <div style={{
          ...panelStyle,
          background: '#fff',
          boxShadow: '0 8px 32px rgba(27,46,36,0.18)',
          display: 'flex', flexDirection: 'column',
          border: '1px solid var(--color-border)', overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            background: 'var(--color-primary)',
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 11,
            flexShrink: 0,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff',
              fontFamily: 'var(--font-body, Inter, sans-serif)',
            }}>
              IQ
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
                CuentaIQ Assistant
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 }}>
                Powered by Claude · Ask me to record any transaction
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1,
                borderRadius: '50%', width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Messages area */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '14px 12px',
            display: 'flex', flexDirection: 'column',
            WebkitOverflowScrolling: 'touch',
          }}>
            {messages.map(msg => (
              <ChatMessage
                key={msg.id}
                msg={msg}
                onPost={handlePost}
                onDiscard={handleDiscard}
              />
            ))}

            {loading && <TypingIndicator />}

            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 8, padding: '8px 12px',
                fontSize: 12, color: '#dc2626', marginBottom: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>{error}</span>
                <button
                  onClick={() => setError('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, lineHeight: 1, padding: '0 0 0 8px' }}
                >
                  ✕
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{
            padding: '10px 12px 12px',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            flexShrink: 0,
            paddingBottom: isMobile ? 'max(12px, env(safe-area-inset-bottom))' : 12,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe a transaction… (e.g. 'Paid ₱15,000 rent from BDO')"
                disabled={loading}
                rows={2}
                style={{
                  flex: 1, resize: 'none',
                  border: '1px solid var(--color-border)', borderRadius: 10,
                  padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                  outline: 'none', lineHeight: 1.5, transition: 'border-color 0.15s',
                  background: loading ? 'var(--color-surface-2)' : '#fff',
                  color: 'var(--color-ink)',
                }}
                onFocus={e  => e.target.style.borderColor = 'var(--color-primary)'}
                onBlur={e   => e.target.style.borderColor = 'var(--color-border)'}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: input.trim() && !loading ? 'var(--color-primary)' : 'var(--color-border)',
                  border: 'none',
                  cursor: input.trim() && !loading ? 'pointer' : 'default',
                  color:  input.trim() && !loading ? '#fff' : 'var(--color-ink-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                  boxShadow: input.trim() && !loading ? '0 2px 8px rgba(45,106,79,0.35)' : 'none',
                }}
                title="Send (Enter)"
              >
                <SendIcon />
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--color-ink-light)', marginTop: 5, textAlign: 'center' }}>
              Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Bubble Button — hidden on mobile when panel is open ── */}
      {(!isMobile || !open) && (
        <button
          onClick={() => setOpen(o => !o)}
          title="CuentaIQ Assistant"
          style={{
            position: 'fixed',
            bottom: isMobile ? 16 : 24,
            right:  isMobile ? 16 : 24,
            zIndex: 1001,
            width: 56, height: 56, borderRadius: '50%',
            background: open ? 'var(--color-primary-hover, #245740)' : 'var(--color-primary)',
            border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(45,106,79,0.45)',
            color: '#fff', fontSize: open ? 18 : 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s, background 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';   }}
        >
          {open ? '✕' : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 2C6.03 2 2 5.8 2 10.5c0 2.1.8 4 2.1 5.5L3 20l4.3-1.4A9.3 9.3 0 0 0 11 19c4.97 0 9-3.8 9-8.5S15.97 2 11 2z" fill="white"/>
            </svg>
          )}
        </button>
      )}
    </>
  );
}
