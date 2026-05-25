import { useState, useEffect, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useUser }     from '../context/UserContext.jsx';

// ── Tooltip ───────────────────────────────────────────────────────────────────
function InfoTip({ text, wide }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 5, verticalAlign: 'middle' }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ cursor: 'help', color: 'var(--text-muted)', fontSize: 12, userSelect: 'none' }}
      >ⓘ</span>
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)', background: '#1e293b', color: '#f8fafc',
          fontSize: 12, padding: '10px 14px', borderRadius: 6,
          width: wide ? 340 : 280, zIndex: 300, lineHeight: 1.7,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', pointerEvents: 'none',
        }}>
          {text}
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            borderWidth: '6px 6px 0', borderStyle: 'solid',
            borderColor: '#1e293b transparent transparent',
          }} />
        </div>
      )}
    </span>
  );
}

// ── Per-type configuration ─────────────────────────────────────────────────────
const TYPE_ORDER = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

const TYPE_CONFIG = {
  Asset: {
    icon: '🏦', color: '#2563eb', bg: '#eff6ff',
    tip: 'Assets normally carry Debit balances. Enter cash, bank account balances, outstanding receivables, inventory value, prepaid expenses, and the cost of fixed assets (equipment, vehicles, furniture). Contra-assets like Accumulated Depreciation go in the Credit column.',
    hint: 'Year-start or mid-year: always required.',
  },
  Liability: {
    icon: '💳', color: '#dc2626', bg: '#fef2f2',
    tip: 'Liabilities normally carry Credit balances. Enter all outstanding amounts you owe — accounts payable to suppliers, short and long-term loans, tax payables (VAT, income tax), and any accrued expenses not yet paid.',
    hint: 'Year-start or mid-year: always required.',
  },
  Equity: {
    icon: '💼', color: '#7c3aed', bg: '#f5f3ff',
    tip: "Equity accounts normally carry Credit balances. Enter the owner's total capital contributions and accumulated retained earnings. Owner's Drawings (a contra-equity) goes in the Debit column.",
    hint: 'Year-start or mid-year: always required.',
  },
  Revenue: {
    icon: '📈', color: '#15803d', bg: '#f0fdf4',
    tip: 'Revenue accounts normally carry Credit balances. If your cutover date is the first day of a new fiscal year, leave these at zero — your books start fresh. If migrating mid-year, enter each account\'s year-to-date balance so your Income Statement is accurate.',
    hint: 'Leave at 0 for fiscal year-start cutover. Fill in YTD amounts for mid-year migration.',
  },
  Expense: {
    icon: '📉', color: '#d97706', bg: '#fffbeb',
    tip: 'Expense accounts normally carry Debit balances. Same rule as Revenue — leave at zero for a year-start cutover, or enter year-to-date amounts if you are migrating mid-year.',
    hint: 'Leave at 0 for fiscal year-start cutover. Fill in YTD amounts for mid-year migration.',
  },
};

const fmt2 = (v) => parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OpeningBalance() {
  const { settings } = useSettings();
  const { user, can } = useUser();
  const sym = settings.currency_symbol || '₱';

  const [loading,     setLoading]     = useState(true);
  const [posted,      setPosted]      = useState(false);
  const [postDate,    setPostDate]    = useState('');
  const [accounts,    setAccounts]    = useState([]);
  const [balances,    setBalances]    = useState({});
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [collapsed,   setCollapsed]   = useState({});

  const canEdit = can('finance');

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/opening-balance', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      setAccounts(data.accounts || []);
      setPosted(data.posted);
      if (data.date) setPostDate(data.date);

      const init = {};
      for (const acc of (data.accounts || [])) init[acc.id] = { debit: '', credit: '' };
      for (const line of (data.lines   || [])) {
        init[line.account_id] = {
          debit:  parseFloat(line.debit)  > 0 ? String(line.debit)  : '',
          credit: parseFloat(line.credit) > 0 ? String(line.credit) : '',
        };
      }
      setBalances(init);
    } catch { setError('Failed to load accounts.'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const g = {};
    for (const acc of accounts) {
      if (!g[acc.type]) g[acc.type] = [];
      g[acc.type].push(acc);
    }
    return g;
  }, [accounts]);

  const { totalDebit, totalCredit, diff } = useMemo(() => {
    let d = 0, c = 0;
    for (const b of Object.values(balances)) {
      d += parseFloat(b.debit)  || 0;
      c += parseFloat(b.credit) || 0;
    }
    return { totalDebit: d, totalCredit: c, diff: Math.abs(d - c) };
  }, [balances]);

  const isBalanced = diff < 0.005;
  const hasEntries = Object.values(balances).some(
    b => (parseFloat(b.debit) || 0) > 0 || (parseFloat(b.credit) || 0) > 0
  );

  const handleChange = (accountId, field, value) => {
    if (value && !/^\d*\.?\d*$/.test(value)) return;
    setBalances(b => ({ ...b, [accountId]: { ...b[accountId], [field]: value } }));
  };

  const handlePost = async () => {
    setError(''); setSuccess('');
    if (!postDate)    return setError('Please enter a cutover date.');
    if (!hasEntries)  return setError('Please enter at least one balance.');
    if (!isBalanced)  return setError(`Out of balance by ${sym}${fmt2(diff)}. Total debits must equal total credits.`);

    const lines = Object.entries(balances)
      .map(([account_id, b]) => ({
        account_id: parseInt(account_id),
        debit:  parseFloat(b.debit)  || 0,
        credit: parseFloat(b.credit) || 0,
      }))
      .filter(l => l.debit > 0 || l.credit > 0);

    setSaving(true);
    try {
      const res  = await fetch('/api/opening-balance', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: postDate, lines }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setPosted(true);
      setSuccess('Opening balances posted successfully. Your books are ready to use.');
    } catch { setError('Network error. Please try again.'); }
    finally   { setSaving(false); }
  };

  const handleVoid = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const res  = await fetch('/api/opening-balance', { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setPosted(false);
      setConfirmVoid(false);
      setSuccess('Opening balances cleared. You can now re-enter them.');
    } catch { setError('Network error.'); }
    finally   { setSaving(false); }
  };

  const toggleCollapse = (type) => setCollapsed(c => ({ ...c, [type]: !c[type] }));

  if (loading) return <div className="page-loading">Loading accounts…</div>;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 120 }}>

      {/* ── Page intro ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
          Opening Balances
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Enter your account balances as of your cutover date. This creates the starting point for all
          future reports — Balance Sheet, Trial Balance, and General Ledger.
        </p>
      </div>

      {/* ── What is a Trial Balance card ────────────────────────────────────── */}
      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
        padding: '14px 18px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 22, marginTop: 1 }}>📋</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1e40af', marginBottom: 4 }}>
              What is a Trial Balance and where do I get one?
            </div>
            <div style={{ fontSize: 12, color: '#1e3a8a', lineHeight: 1.7 }}>
              A <strong>Trial Balance</strong> is a report from your previous accounting system (QuickBooks,
              spreadsheet, or prepared by your accountant) that lists every account and its balance as of
              a specific date. It always has equal total debits and credits.
              <br />
              <strong>How to use it here:</strong> Set the cutover date below to match the "as of" date on
              your Trial Balance, then enter each account's balance in the matching Debit or Credit column.
              Accounts not on your Trial Balance stay at zero.
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: '1px solid #bfdbfe',
          display: 'flex', gap: 24, flexWrap: 'wrap',
        }}>
          {[
            { label: 'Fiscal year start', tip: 'Fill in Assets, Liabilities, and Equity only. Leave Revenue and Expenses at zero — income and costs start fresh each fiscal year.' },
            { label: 'Mid-year migration', tip: 'Fill in all accounts including year-to-date Revenue and Expense balances so your Income Statement reflects the full year.' },
            { label: 'Brand new business', tip: 'Enter only the owner\'s initial cash investment: Debit "Cash" and Credit "Owner\'s Capital" for the same amount.' },
          ].map(({ label, tip }) => (
            <div key={label} style={{ fontSize: 12, color: '#1e40af' }}>
              <strong>{label}</strong>
              <InfoTip text={tip} wide />
            </div>
          ))}
        </div>
      </div>

      {/* ── Alerts ──────────────────────────────────────────────────────────── */}
      {error   && <div className="alert alert-error   mb-16">⚠ {error}</div>}
      {success && <div className="alert alert-success mb-16">✓ {success}</div>}

      {/* ── Posted banner ───────────────────────────────────────────────────── */}
      {posted && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10,
          padding: '12px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          flexWrap: 'wrap',
        }}>
          <div>
            <span style={{ fontWeight: 700, color: '#15803d', fontSize: 13 }}>
              ✓ Opening balances posted
            </span>
            {postDate && (
              <span style={{ fontSize: 12, color: '#166534', marginLeft: 8 }}>
                as of {new Date(postDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
          {canEdit && !confirmVoid && (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
              onClick={() => setConfirmVoid(true)}>
              Re-enter Opening Balances
            </button>
          )}
          {confirmVoid && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--danger)' }}>This will clear the existing entry. Continue?</span>
              <button className="btn btn-danger btn-sm" onClick={handleVoid} disabled={saving}>
                {saving ? 'Clearing…' : 'Yes, Clear It'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmVoid(false)}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* ── Cutover date ────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
              Cutover Date
            </label>
            <InfoTip
              text='The "as of" date for your opening balances — usually the last day of your previous fiscal period (e.g. Dec 31) or the day before you go live. All balances are entered as they stood at the close of business on this date.'
              wide
            />
          </div>
          <input
            type="date"
            className="form-input"
            style={{ width: 180 }}
            value={postDate}
            onChange={e => setPostDate(e.target.value)}
            disabled={posted && !confirmVoid}
          />
          {!posted && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Tip: use the last day of your most recent closed period (e.g. Dec 31, 2024).
            </span>
          )}
        </div>
      </div>

      {/* ── Column header legend ────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
        padding: '8px 16px', marginBottom: 4,
        fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        <span>Account</span>
        <span style={{ textAlign: 'right' }}>
          Debit
          <InfoTip text="Assets and Expenses normally have Debit balances. Enter positive amounts here for those accounts. Contra-accounts (e.g. Accumulated Depreciation, Owner's Drawings) that reduce their group also go in the Debit column if their normal balance is Debit." />
        </span>
        <span style={{ textAlign: 'right' }}>
          Credit
          <InfoTip text="Liabilities, Equity, and Revenue normally have Credit balances. Enter positive amounts here for those accounts. The grand total of all Debits must exactly equal the grand total of all Credits before you can post." />
        </span>
      </div>

      {/* ── Account groups ───────────────────────────────────────────────────── */}
      {TYPE_ORDER.filter(t => grouped[t]?.length).map(type => {
        const cfg      = TYPE_CONFIG[type];
        const isOpen   = !collapsed[type];
        const typeAccs = grouped[type] || [];
        const typeDebit  = typeAccs.reduce((s, a) => s + (parseFloat(balances[a.id]?.debit)  || 0), 0);
        const typeCredit = typeAccs.reduce((s, a) => s + (parseFloat(balances[a.id]?.credit) || 0), 0);
        const hasValues  = typeDebit > 0 || typeCredit > 0;

        return (
          <div key={type} className="card" style={{ marginBottom: 12, overflow: 'hidden', padding: 0 }}>

            {/* Group header */}
            <div
              onClick={() => toggleCollapse(type)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                background: cfg.bg, cursor: 'pointer', borderBottom: isOpen ? `1px solid ${cfg.color}22` : 'none',
              }}
            >
              <span style={{ fontSize: 16 }}>{cfg.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: cfg.color, flex: 1 }}>
                {type}s
              </span>
              <InfoTip text={cfg.tip} wide />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, fontStyle: 'italic' }}>
                {cfg.hint}
              </span>
              {hasValues && (
                <span style={{
                  fontSize: 11, background: cfg.color, color: '#fff',
                  borderRadius: 999, padding: '1px 8px', marginLeft: 8, fontWeight: 600,
                }}>
                  {typeDebit > 0 ? `D ${sym}${fmt2(typeDebit)}` : `C ${sym}${fmt2(typeCredit)}`}
                </span>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>
                {isOpen ? '▲' : '▼'}
              </span>
            </div>

            {/* Account rows */}
            {isOpen && typeAccs.map((acc, i) => {
              const bal = balances[acc.id] || { debit: '', credit: '' };
              const isNormalDebit  = acc.normal_balance === 'Debit';
              const isNormalCredit = acc.normal_balance === 'Credit';
              const disabled = posted && !confirmVoid;

              return (
                <div key={acc.id} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
                  alignItems: 'center', padding: '7px 16px',
                  background: i % 2 === 0 ? '#fff' : '#f8fafc',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, marginRight: 6 }}>{acc.code}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{acc.name}</span>
                    {acc.normal_balance && (
                      <span style={{
                        marginLeft: 6, fontSize: 10, color: isNormalDebit ? '#2563eb' : '#15803d',
                        background: isNormalDebit ? '#eff6ff' : '#f0fdf4',
                        borderRadius: 4, padding: '1px 5px', fontWeight: 600,
                      }}>
                        {acc.normal_balance === 'Debit' ? 'Dr' : 'Cr'}
                      </span>
                    )}
                  </div>

                  {/* Debit input */}
                  <div style={{ padding: '0 4px' }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input"
                      style={{
                        textAlign: 'right', fontSize: 13, padding: '4px 8px',
                        background: isNormalDebit ? '#eff6ff' : '#fff',
                        border: bal.debit ? '1px solid #2563eb' : '1px solid var(--border)',
                      }}
                      placeholder="0.00"
                      value={bal.debit}
                      disabled={disabled}
                      onChange={e => handleChange(acc.id, 'debit', e.target.value)}
                    />
                  </div>

                  {/* Credit input */}
                  <div style={{ padding: '0 4px' }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input"
                      style={{
                        textAlign: 'right', fontSize: 13, padding: '4px 8px',
                        background: isNormalCredit ? '#f0fdf4' : '#fff',
                        border: bal.credit ? '1px solid #15803d' : '1px solid var(--border)',
                      }}
                      placeholder="0.00"
                      value={bal.credit}
                      disabled={disabled}
                      onChange={e => handleChange(acc.id, 'credit', e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ── Sticky totals footer ─────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: '#fff', borderTop: '2px solid var(--border)',
        padding: '14px 20px', marginTop: 8,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        {/* Totals */}
        <div style={{ display: 'flex', gap: 24, flex: 1, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Total Debits</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2563eb' }}>
              {sym}{fmt2(totalDebit)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Total Credits</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#15803d' }}>
              {sym}{fmt2(totalCredit)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Difference</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: isBalanced ? '#15803d' : '#dc2626' }}>
              {isBalanced
                ? '✓ Balanced'
                : `${sym}${fmt2(diff)} out`}
            </div>
          </div>
        </div>

        {/* Action */}
        {canEdit && !posted && (
          <button
            className="btn btn-primary"
            style={{ minWidth: 180 }}
            onClick={handlePost}
            disabled={saving || !hasEntries || !postDate}
          >
            {saving ? 'Posting…' : 'Post Opening Balances'}
          </button>
        )}
        {canEdit && posted && !confirmVoid && (
          <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>
            ✓ Posted — use "Re-enter Opening Balances" above to make changes
          </div>
        )}
        {!canEdit && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Finance role or above required to post opening balances.
          </div>
        )}
      </div>
    </div>
  );
}
