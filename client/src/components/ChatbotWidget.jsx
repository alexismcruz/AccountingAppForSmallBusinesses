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
      background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
      padding: 14, marginTop: 8,
    }}>
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 15 }}>📝</span>
        <span style={{ fontWeight: 700, color: '#15803d', fontSize: 13 }}>Draft Journal Entry</span>
      </div>

      {/* Description + date */}
      <div style={{ marginBottom: 10, fontSize: 13 }}>
        <span style={{ fontWeight: 600, color: '#1f2937' }}>{entry.description}</span>
        <span style={{
          marginLeft: 8, background: '#dcfce7', color: '#166534',
          padding: '1px 7px', borderRadius: 12, fontSize: 11, fontWeight: 500,
        }}>
          {entry.date}
        </span>
      </div>

      {/* Lines table */}
      <div style={{ border: '1px solid #d1fae5', borderRadius: 7, overflow: 'hidden', marginBottom: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#dcfce7' }}>
              <th style={{ padding: '5px 8px', textAlign: 'left',  color: '#166534', fontWeight: 600 }}>Account</th>
              <th style={{ padding: '5px 8px', textAlign: 'right', color: '#166534', fontWeight: 600, width: 80 }}>Debit</th>
              <th style={{ padding: '5px 8px', textAlign: 'right', color: '#166534', fontWeight: 600, width: 80 }}>Credit</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line, i) => (
              <tr key={i} style={{ borderTop: '1px solid #d1fae5', background: i % 2 ? '#f0fdf4' : '#fff' }}>
                <td style={{ padding: '5px 8px' }}>
                  <span style={{ fontWeight: 600, color: '#374151', fontSize: 11 }}>{line.account_code}</span>
                  <span style={{ color: '#6b7280', marginLeft: 4 }}>{line.account_name}</span>
                  {line.description && (
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{line.description}</div>
                  )}
                </td>
                <td style={{
                  padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace',
                  color: line.debit > 0 ? '#1d4ed8' : '#d1d5db',
                }}>
                  {line.debit > 0 ? fmt(line.debit) : '—'}
                </td>
                <td style={{
                  padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace',
                  color: line.credit > 0 ? '#b91c1c' : '#d1d5db',
                }}>
                  {line.credit > 0 ? fmt(line.credit) : '—'}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid #86efac', background: '#dcfce7', fontWeight: 700 }}>
              <td style={{ padding: '5px 8px', color: '#166534', fontSize: 12 }}>Total</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#1d4ed8', fontSize: 12 }}>
                {fmt(totalDebit)}
              </td>
              <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#b91c1c', fontSize: 12 }}>
                {fmt(totalCredit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Plain-English explanation */}
      {entry.explanation && (
        <div style={{
          fontSize: 12, color: '#4b5563', marginBottom: 12,
          lineHeight: 1.6, padding: '8px 10px',
          background: '#fff', borderRadius: 6, border: '1px solid #d1fae5',
        }}>
          💡 {entry.explanation}
        </div>
      )}

      {!balanced && (
        <div style={{
          color: '#dc2626', fontSize: 12, marginBottom: 10,
          background: '#fef2f2', padding: '6px 10px', borderRadius: 6,
        }}>
          ⚠ This entry is not balanced. Please discard and try again.
        </div>
      )}

      {/* Actions */}
      {posted ? (
        <div style={{
          color: '#16a34a', fontWeight: 600, fontSize: 13,
          padding: '8px 10px', background: '#dcfce7', borderRadius: 6,
        }}>
          ✅ Posted as <strong>{posted.reference}</strong>
          {posted.status === 'pending_approval' && (
            <span style={{ fontWeight: 400, color: '#15803d' }}> · Pending approval</span>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onPost}
            disabled={!balanced || posting}
            style={{
              flex: 1, padding: '8px 14px',
              background: !balanced || posting ? '#86efac' : '#16a34a',
              color: '#fff', border: 'none', borderRadius: 7,
              cursor: !balanced || posting ? 'default' : 'pointer',
              fontWeight: 600, fontSize: 13, transition: 'background 0.15s',
            }}
          >
            {posting ? 'Posting…' : '✓ Post Entry'}
          </button>
          <button
            onClick={onDiscard}
            disabled={posting}
            style={{
              padding: '8px 14px', background: '#fff',
              color: '#6b7280', border: '1px solid #d1d5db',
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
          background: 'linear-gradient(135deg, #1e40af, #2563eb)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, flexShrink: 0, marginRight: 7, marginTop: 2,
        }}>
          ✨
        </div>
      )}

      <div style={{ maxWidth: '84%' }}>
        {/* Text bubble */}
        {msg.content && (
          <div style={{
            background:   isUser ? '#2563eb' : '#f3f4f6',
            color:        isUser ? '#fff'    : '#1f2937',
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
        background: 'linear-gradient(135deg, #1e40af, #2563eb)',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
      }}>
        ✨
      </div>
      <div style={{
        background: '#f3f4f6', padding: '10px 14px',
        borderRadius: '4px 18px 18px 18px', display: 'flex', gap: 4, alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 7, height: 7, borderRadius: '50%', background: '#9ca3af', display: 'inline-block',
            animation: `chatbotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Main Widget ───────────────────────────────────────────────────────────────

const WELCOME = {
  id: 0,
  role: 'assistant',
  content:
    "Hi there! 👋 I'm your accounting assistant.\n\n" +
    "Just describe any business transaction in plain language and I'll help you record it correctly — " +
    "no accounting experience needed!\n\n" +
    "For example, you can say things like:\n" +
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

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  // Build conversation history for the API (text-only, alternating roles)
  const buildHistory = useCallback((msgs, plusUser = null) => {
    const history = msgs
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
      .map(m => ({ role: m.role, content: m.content || '' }));
    if (plusUser) history.push({ role: 'user', content: plusUser });
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

      // Add a follow-up assistant message
      setMessages(prev => [...prev, {
        id:   nextId(),
        role: 'assistant',
        content:
          `✅ Done! Entry **${data.reference}** has been ` +
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

  return (
    <>
      {/* Bounce animation keyframes injected once */}
      <style>{`
        @keyframes chatbotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%            { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>

      {/* ── Chat Panel ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24,
          width: 390, height: 530,
          background: '#fff', borderRadius: 18,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column',
          zIndex: 1000, border: '1px solid #e5e7eb', overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 11,
            flexShrink: 0,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>
              ✨
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
                Accounting Assistant
              </div>
              <div style={{ color: '#bfdbfe', fontSize: 11, marginTop: 1 }}>
                Powered by Claude · Ask me to record any transaction
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#e0f2fe', cursor: 'pointer', fontSize: 14, lineHeight: 1,
                borderRadius: '50%', width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
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
              }}>
                ⚠ {error}
                <button
                  onClick={() => setError('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', marginLeft: 8, fontSize: 14 }}
                >
                  ✕
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{ padding: '10px 12px 12px', borderTop: '1px solid #f3f4f6', background: '#fafafa', flexShrink: 0 }}>
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
                  border: '1.5px solid #d1d5db', borderRadius: 10,
                  padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                  outline: 'none', lineHeight: 1.5, transition: 'border-color 0.15s',
                  background: loading ? '#f9fafb' : '#fff',
                }}
                onFocus={e  => e.target.style.borderColor = '#2563eb'}
                onBlur={e   => e.target.style.borderColor = '#d1d5db'}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: input.trim() && !loading
                    ? 'linear-gradient(135deg, #1e40af, #2563eb)'
                    : '#e5e7eb',
                  border: 'none',
                  cursor: input.trim() && !loading ? 'pointer' : 'default',
                  color:  input.trim() && !loading ? '#fff' : '#9ca3af',
                  fontSize: 17,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                  boxShadow: input.trim() && !loading ? '0 2px 8px rgba(37,99,235,0.3)' : 'none',
                }}
                title="Send (Enter)"
              >
                ➤
              </button>
            </div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 5, textAlign: 'center' }}>
              Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Bubble Button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Accounting Assistant"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1001,
          width: 58, height: 58, borderRadius: '50%',
          background: open
            ? '#1e3a8a'
            : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(37,99,235,0.45)',
          color: '#fff', fontSize: open ? 20 : 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s, background 0.2s, font-size 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';   }}
      >
        {open ? '✕' : '✨'}
      </button>
    </>
  );
}
