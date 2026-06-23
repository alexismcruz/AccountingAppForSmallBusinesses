import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';

function Amount({ value, indent }) {
  const { fmt } = useSettings();
  return (
    <td className="report-amount" style={{ paddingLeft: indent ? 24 : undefined }}>
      {fmt(value)}
    </td>
  );
}

function BalanceSheet({ date, setDate }) {
  const { fmt, settings } = useSettings();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true); setError('');
    fetch(`/api/reports/balance-sheet?date=${date}`)
      .then(r => { if (!r.ok) throw new Error('Server error'); return r.json(); })
      .then(d => setData(d))
      .catch(() => setError('Failed to load report. Please check your connection and try again.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }} className="no-print">
        <div className="form-group">
          <label className="form-label">As of Date</label>
          <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Generate'}</button>
        <button className="btn btn-ghost" onClick={() => window.print()}>🖨 Print</button>
      </div>

      {loading && <div className="text-muted text-center" style={{ padding: 40 }}>Calculating…</div>}
      {error && <div className="alert alert-error mb-16">⚠ {error}</div>}
      {data && (
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{settings.business_name}</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>BALANCE SHEET</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              As of {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
              All amounts in {settings.currency || 'PHP'} (base currency)
            </div>
          </div>

          <div className="report-bs-grid">
            {/* Assets */}
            <div>
              <table className="report-table" style={{ width: '100%' }}>
                <tbody>
                  <tr className="rt-section"><td colSpan={2}>ASSETS</td></tr>
                  <tr className="rt-header"><td>Current Assets</td><td /></tr>
                  {data.assets.currentAssets.filter(a => a.balance !== 0).map(a => (
                    <tr key={a.id}><td style={{ paddingLeft: 20, fontSize: 13 }}>{a.name}</td><Amount value={a.balance} /></tr>
                  ))}
                  <tr className="rt-subtotal">
                    <td style={{ paddingLeft: 20 }}>Total Current Assets</td>
                    <Amount value={data.assets.totalCurrentAssets} />
                  </tr>

                  <tr className="rt-header"><td>Fixed Assets</td><td /></tr>
                  {data.assets.fixedAssets.filter(a => a.balance !== 0).map(a => (
                    <tr key={a.id}><td style={{ paddingLeft: 20, fontSize: 13 }}>{a.name}</td><Amount value={a.balance} /></tr>
                  ))}
                  <tr className="rt-subtotal">
                    <td style={{ paddingLeft: 20 }}>Total Fixed Assets</td>
                    <Amount value={data.assets.totalFixedAssets} />
                  </tr>

                  <tr className="rt-total">
                    <td>TOTAL ASSETS</td>
                    <Amount value={data.assets.totalAssets} />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Liabilities + Equity */}
            <div>
              <table className="report-table" style={{ width: '100%' }}>
                <tbody>
                  <tr className="rt-section"><td colSpan={2}>LIABILITIES</td></tr>
                  <tr className="rt-header"><td>Current Liabilities</td><td /></tr>
                  {data.liabilities.currentLiabilities.filter(a => a.balance !== 0).map(a => (
                    <tr key={a.id}><td style={{ paddingLeft: 20, fontSize: 13 }}>{a.name}</td><Amount value={a.balance} /></tr>
                  ))}
                  <tr className="rt-subtotal">
                    <td style={{ paddingLeft: 20 }}>Total Current Liabilities</td>
                    <Amount value={data.liabilities.totalCurrentLiabilities} />
                  </tr>
                  <tr className="rt-header"><td>Long-Term Liabilities</td><td /></tr>
                  {data.liabilities.longTermLiabilities.filter(a => a.balance !== 0).map(a => (
                    <tr key={a.id}><td style={{ paddingLeft: 20, fontSize: 13 }}>{a.name}</td><Amount value={a.balance} /></tr>
                  ))}
                  <tr className="rt-subtotal">
                    <td style={{ paddingLeft: 20 }}>Total Long-Term Liabilities</td>
                    <Amount value={data.liabilities.totalLongTermLiabilities} />
                  </tr>
                  <tr className="rt-total"><td>TOTAL LIABILITIES</td><Amount value={data.liabilities.totalLiabilities} /></tr>

                  <tr className="rt-section"><td colSpan={2}>EQUITY</td></tr>
                  {data.equity.items.filter(a => a.balance !== 0).map(a => (
                    <tr key={a.id}><td style={{ paddingLeft: 20, fontSize: 13 }}>{a.name}</td><Amount value={a.displayBalance} /></tr>
                  ))}
                  <tr>
                    <td style={{ paddingLeft: 20, fontSize: 13 }}>Net Income (Current Period)</td>
                    <Amount value={data.equity.netIncome} />
                  </tr>
                  <tr className="rt-total"><td>TOTAL EQUITY</td><Amount value={data.equity.totalEquity} /></tr>

                  <tr style={{ height: 16 }}><td colSpan={2} /></tr>
                  <tr className="rt-total" style={{ fontSize: 14 }}>
                    <td>TOTAL LIABILITIES + EQUITY</td>
                    <Amount value={data.liabilities.totalLiabilities + data.equity.totalEquity} />
                  </tr>
                </tbody>
              </table>
              {!data.balanced && (
                <div className="alert alert-warning mt-12 no-print">
                  ⚠ Balance sheet is out of balance. Check your entries.
                </div>
              )}
              {data.balanced && (
                <div className="alert alert-success mt-12 no-print">
                  ✓ Balance sheet is balanced.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IncomeStatement({ fromDate, toDate, setFromDate, setToDate }) {
  const { settings } = useSettings();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { fmt } = useSettings();

  const load = () => {
    setLoading(true); setError('');
    fetch(`/api/reports/income-statement?from=${fromDate}&to=${toDate}`)
      .then(r => { if (!r.ok) throw new Error('Server error'); return r.json(); })
      .then(d => setData(d))
      .catch(() => setError('Failed to load report. Please check your connection and try again.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }} className="no-print">
        <div className="form-group">
          <label className="form-label">From</label>
          <input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">To</label>
          <input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Generate'}</button>
        <button className="btn btn-ghost" onClick={() => window.print()}>🖨 Print</button>
      </div>

      {loading && <div className="text-muted text-center" style={{ padding: 40 }}>Calculating…</div>}
      {error && <div className="alert alert-error mb-16">⚠ {error}</div>}
      {data && (
        <div className="card" style={{ maxWidth: 600 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{settings.business_name}</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>INCOME STATEMENT</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              For the period {new Date(fromDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to {new Date(toDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
              All amounts in {settings.currency || 'PHP'} (base currency)
            </div>
          </div>
          <table className="report-table">
            <tbody>
              <tr className="rt-section"><td>REVENUE</td><td /></tr>
              {data.revenue.filter(a => a.balance !== 0).map(a => (
                <tr key={a.id}><td style={{ paddingLeft: 20 }}>{a.name}</td><td className="report-amount">{fmt(a.balance)}</td></tr>
              ))}
              <tr className="rt-subtotal"><td>TOTAL REVENUE</td><td className="report-amount">{fmt(data.totalRevenue)}</td></tr>

              <tr className="rt-section"><td>COST OF GOODS SOLD</td><td /></tr>
              {data.cogs.filter(a => a.balance !== 0).map(a => (
                <tr key={a.id}><td style={{ paddingLeft: 20 }}>{a.name}</td><td className="report-amount">({fmt(a.balance)})</td></tr>
              ))}
              <tr className="rt-subtotal"><td>GROSS PROFIT</td><td className="report-amount">{fmt(data.grossProfit)}</td></tr>

              <tr className="rt-section"><td>OPERATING EXPENSES</td><td /></tr>
              {data.expenses.filter(a => a.balance !== 0).map(a => (
                <tr key={a.id}><td style={{ paddingLeft: 20 }}>{a.name}</td><td className="report-amount">({fmt(a.balance)})</td></tr>
              ))}
              <tr className="rt-subtotal"><td>TOTAL EXPENSES</td><td className="report-amount">({fmt(data.totalExpenses)})</td></tr>

              <tr style={{ height: 8 }}><td colSpan={2} /></tr>
              <tr className="rt-total">
                <td>NET INCOME {data.netIncome < 0 ? '(NET LOSS)' : ''}</td>
                <td className="report-amount" style={{ color: data.netIncome >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {fmt(data.netIncome)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TrialBalance({ date, setDate }) {
  const { fmt, settings } = useSettings();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true); setError('');
    fetch(`/api/reports/trial-balance?date=${date}`)
      .then(r => { if (!r.ok) throw new Error('Server error'); return r.json(); })
      .then(d => setData(d))
      .catch(() => setError('Failed to load report. Please check your connection and try again.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20 }} className="no-print">
        <div className="form-group">
          <label className="form-label">As of Date</label>
          <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Generate'}</button>
        <button className="btn btn-ghost" onClick={() => window.print()}>🖨 Print</button>
      </div>
      {loading && <div className="text-muted text-center" style={{ padding: 40 }}>Calculating…</div>}
      {error && <div className="alert alert-error mb-16">⚠ {error}</div>}
      {data && (
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{settings.business_name}</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>TRIAL BALANCE</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>As of {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th className="td-right">Debit</th>
                  <th className="td-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(row => (
                  <tr key={row.id}>
                    <td className="td-mono">{row.code}</td>
                    <td>{row.name}</td>
                    <td><span className="badge badge-muted">{row.type}</span></td>
                    <td className="td-right tabular">{row.debit_balance > 0 ? fmt(row.debit_balance) : ''}</td>
                    <td className="td-right tabular">{row.credit_balance > 0 ? fmt(row.credit_balance) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--text)', fontWeight: 700 }}>
                  <td colSpan={3} style={{ paddingTop: 10 }}>TOTALS</td>
                  <td className="td-right tabular">{fmt(data.totalDebit)}</td>
                  <td className="td-right tabular">{fmt(data.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className={`alert mt-12 no-print ${data.balanced ? 'alert-success' : 'alert-warning'}`}>
            {data.balanced ? '✓ Trial balance is balanced.' : (() => {
              const diff = Math.abs(data.totalDebit - data.totalCredit);
              const higher = data.totalDebit > data.totalCredit ? 'debits' : 'credits';
              const lower  = higher === 'debits' ? 'credits' : 'debits';
              return (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    ⚠ Trial balance is not balanced — difference of {fmt(diff)} ({higher} exceed {lower}).
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
                    <strong>Possible causes (please verify your entries):</strong>
                    <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                      {higher === 'debits' && <li>A journal entry may be missing its credit side — check recent entries for incomplete transactions.</li>}
                      {higher === 'credits' && <li>A journal entry may be missing its debit side — check recent entries for incomplete transactions.</li>}
                      <li>A payroll run or opening balance entry may have only posted one side.</li>
                      <li>The difference ({fmt(diff)}) may match a specific transaction amount — search for it in Journal Entries.</li>
                      <li>Rounding differences on tax or deduction computations can also cause small imbalances.</li>
                    </ul>
                    <div style={{ marginTop: 8, fontStyle: 'italic' }}>
                      This is a suggestion only — please review your entries to confirm the root cause.
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function GeneralLedger({ date }) {
  const { fmt, settings } = useSettings();
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [fromDate, setFromDate] = useState(date.slice(0, 4) + '-01-01');
  const [toDate, setToDate] = useState(date);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/accounts').then(r => r.json()).then(setAccounts).catch(() => {});
  }, []);

  const load = () => {
    if (!accountId) return;
    setLoading(true); setError('');
    fetch(`/api/reports/ledger?accountId=${accountId}&from=${fromDate}&to=${toDate}`)
      .then(r => { if (!r.ok) throw new Error('Server error'); return r.json(); })
      .then(d => setData(d))
      .catch(() => setError('Failed to load ledger. Please check your connection and try again.'))
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }} className="no-print">
        <div className="form-group" style={{ minWidth: 260 }}>
          <label className="form-label">Account</label>
          <select className="form-select" value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">— Select an account —</option>
            {['Asset','Liability','Equity','Revenue','COGS','Expense'].map(type => {
              const group = accounts.filter(a => a.type === type);
              if (!group.length) return null;
              return (
                <optgroup key={type} label={type}>
                  {group.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </optgroup>
              );
            })}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">From</label>
          <input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">To</label>
          <input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={load} disabled={loading || !accountId}>{loading ? 'Loading…' : 'View Ledger'}</button>
        {data && <button className="btn btn-ghost" onClick={() => window.print()}>🖨 Print</button>}
      </div>
      {loading && <div className="text-muted text-center" style={{ padding: 40 }}>Loading…</div>}
      {error && <div className="alert alert-error mb-16">⚠ {error}</div>}
      {data && (
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{settings.business_name}</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>GENERAL LEDGER</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>{data.account.code} — {data.account.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {new Date(fromDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to {new Date(toDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          {data.rows.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <p>No transactions found for this account in the selected period.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Description</th>
                    <th>Notes</th>
                    <th className="td-right">Debit</th>
                    <th className="td-right">Credit</th>
                    <th className="td-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(row => (
                    <tr key={row.id}>
                      <td>{new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="td-mono">{row.reference}</td>
                      <td>{row.entry_description}</td>
                      <td className="text-muted">{row.notes || '—'}</td>
                      <td className="td-right tabular">{row.debit > 0 ? fmt(row.debit) : '—'}</td>
                      <td className="td-right tabular">{row.credit > 0 ? fmt(row.credit) : '—'}</td>
                      <td className="td-right tabular" style={{ fontWeight: 600 }}>{fmt(row.running_balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--text)', fontWeight: 700 }}>
                    <td colSpan={4}>CLOSING BALANCE</td>
                    <td colSpan={3} className="td-right tabular">{fmt(data.rows[data.rows.length - 1]?.running_balance ?? 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Reports({ type }) {
  const today = new Date().toISOString().split('T')[0];
  const yearStart = today.slice(0, 4) + '-01-01';
  const [date, setDate] = useState(today);
  const [fromDate, setFromDate] = useState(yearStart);
  const [toDate, setToDate] = useState(today);

  const LABELS = {
    'balance-sheet': 'Balance Sheet',
    'income-statement': 'Income Statement',
    'trial-balance': 'Trial Balance',
    'ledger': 'General Ledger',
  };

  const DESCS = {
    'balance-sheet': 'Shows what your business owns (assets) and owes (liabilities + equity) at a specific date.',
    'income-statement': 'Shows your revenue, costs, and profit or loss over a period.',
    'trial-balance': 'Lists all accounts with their total debit or credit balances — totals should be equal.',
    'ledger': 'Shows every transaction for a single account in chronological order.',
  };

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <div className="page-title">{LABELS[type]}</div>
          <div className="page-subtitle">{DESCS[type]}</div>
        </div>
      </div>
      {type === 'balance-sheet'    && <BalanceSheet date={date} setDate={setDate} />}
      {type === 'income-statement' && <IncomeStatement fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} />}
      {type === 'trial-balance'    && <TrialBalance date={date} setDate={setDate} />}
      {type === 'ledger'           && <GeneralLedger date={date} />}
    </div>
  );
}
