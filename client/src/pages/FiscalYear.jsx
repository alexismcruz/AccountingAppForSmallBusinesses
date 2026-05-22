import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';

export default function FiscalYear() {
  const { settings, fmt } = useSettings();
  const [years, setYears] = useState([]);
  const [closedYears, setClosedYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [preview, setPreview] = useState(null);
  const [openingBalances, setOpeningBalances] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [tab, setTab] = useState('close'); // 'close' | 'opening'

  useEffect(() => {
    fetch('/api/fiscal/years').then(r => r.json()).then(d => {
      setYears(d.years || []);
      setClosedYears(d.closedYears || []);
    });
  }, []);

  useEffect(() => {
    if (tab === 'close') loadPreview();
    else loadOpeningBalances();
  }, [selectedYear, tab]);

  const loadPreview = async () => {
    setPreview(null);
    const data = await fetch(`/api/fiscal/preview-close?year=${selectedYear}`).then(r => r.json());
    setPreview(data);
  };

  const loadOpeningBalances = async () => {
    setOpeningBalances(null);
    const data = await fetch(`/api/fiscal/opening-balances?year=${selectedYear}`).then(r => r.json());
    setOpeningBalances(data);
  };

  const handleClose = async () => {
    if (!window.confirm(
      `Are you sure you want to close FY ${selectedYear}?\n\n` +
      `This will create a closing journal entry dated ${selectedYear}-12-31 that:\n` +
      `• Zeros out all Revenue, COGS, and Expense account balances\n` +
      `• Transfers the net income to Retained Earnings\n\n` +
      `This cannot be undone. Proceed?`
    )) return;

    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/fiscal/close-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.error }); return; }
      setMsg({
        type: 'success',
        text: `FY ${selectedYear} closed successfully. Reference: ${data.entry.reference}. ` +
              `Net income of ${fmt(Math.abs(data.netIncome))} transferred to Retained Earnings.`,
      });
      setClosedYears(cy => [...cy, selectedYear]);
      loadPreview();
    } catch {
      setMsg({ type: 'error', text: 'Network error.' });
    } finally {
      setLoading(false);
    }
  };

  const isClosed = closedYears.includes(selectedYear);

  const yearOptions = () => {
    const current = new Date().getFullYear();
    const set = new Set([...years, String(current), String(current - 1)]);
    return [...set].sort((a, b) => b - a);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Fiscal Year Management</div>
          <div className="page-subtitle">Year-end closing and opening balance review</div>
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'} mb-16`}>
          {msg.type === 'success' ? '✓ ' : '⚠ '}{msg.text}
        </div>
      )}

      {/* Year selector + tabs */}
      <div className="card mb-16" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Fiscal Year</label>
            <select className="form-select" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              {yearOptions().map(y => (
                <option key={y} value={y}>{y}{closedYears.includes(y) ? ' ✓ Closed' : ''}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn ${tab === 'close' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab('close')}
            >
              Year-End Closing
            </button>
            <button
              className={`btn ${tab === 'opening' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab('opening')}
            >
              Opening Balances
            </button>
          </div>
        </div>
      </div>

      {/* ── Year-End Closing Tab ── */}
      {tab === 'close' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Year-End Closing Entry Preview — FY {selectedYear}</div>
              <div className="text-muted text-sm" style={{ marginTop: 4 }}>
                This entry will zero out all Revenue, COGS, and Expense accounts by transferring the net income to Retained Earnings (3200).
              </div>
            </div>
            {isClosed ? (
              <span className="badge badge-success" style={{ fontSize: 13, padding: '6px 14px' }}>✓ Already Closed</span>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleClose}
                disabled={loading || !preview || preview.lines?.length === 0}
              >
                {loading ? 'Closing…' : `Close FY ${selectedYear}`}
              </button>
            )}
          </div>

          {isClosed && (
            <div className="alert alert-success mb-16">
              FY {selectedYear} has been closed. Income statement accounts have been zeroed and net income transferred to Retained Earnings.
              Start recording entries for the new year normally — balance sheet balances carry forward automatically.
            </div>
          )}

          {!preview ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading preview…</div>
          ) : preview.lines?.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <p>No revenue or expense balances found for FY {selectedYear}. Nothing to close.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap mb-16">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Account</th>
                      <th>Type</th>
                      <th className="td-right">Debit</th>
                      <th className="td-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((line, i) => (
                      <tr key={i}>
                        <td><span className="td-mono" style={{ fontSize: 11 }}>{line.code}</span></td>
                        <td>{line.name}</td>
                        <td>
                          <span className={`badge ${
                            line.type === 'Revenue' ? 'badge-success' :
                            line.type === 'COGS'    ? 'badge-warning' :
                            line.type === 'Expense' ? 'badge-error'   :
                                                      'badge-info'
                          }`}>{line.type}</span>
                        </td>
                        <td className="td-right tabular">{line.debit > 0 ? fmt(line.debit) : '—'}</td>
                        <td className="td-right tabular">{line.credit > 0 ? fmt(line.credit) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                      <td colSpan={3}>Net Income → Retained Earnings</td>
                      <td className="td-right tabular">
                        {fmt(preview.lines.reduce((s, l) => s + l.debit, 0))}
                      </td>
                      <td className="td-right tabular">
                        {fmt(preview.lines.reduce((s, l) => s + l.credit, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Net Income for FY {selectedYear}</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: preview.netIncome >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {preview.netIncome >= 0 ? '+' : ''}{fmt(preview.netIncome)}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', maxWidth: 340 }}>
                  {preview.netIncome >= 0
                    ? `Profitable year! ${fmt(preview.netIncome)} will be added to Retained Earnings.`
                    : `Net loss of ${fmt(Math.abs(preview.netIncome))} will reduce Retained Earnings.`}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Opening Balances Tab ── */}
      {tab === 'opening' && (
        <div className="card">
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              Opening Balances for FY {selectedYear}
            </div>
            <div className="text-muted text-sm" style={{ marginTop: 4 }}>
              These are the Balance Sheet account balances carried forward from {parseInt(selectedYear) - 1}-12-31.
              They automatically roll over into the new year — no manual entry needed.
            </div>
          </div>

          {!openingBalances ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</div>
          ) : openingBalances.balances?.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📂</div>
              <p>No prior-year balances found. This may be the first year of operation.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Account</th>
                      <th>Type</th>
                      <th className="td-right">Opening Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['Asset', 'Liability', 'Equity'].map(type => {
                      const group = openingBalances.balances.filter(b => b.type === type);
                      if (group.length === 0) return null;
                      return [
                        <tr key={`hdr-${type}`}>
                          <td colSpan={4} style={{ background: 'var(--bg)', fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', padding: '8px 16px' }}>
                            {type === 'Asset' ? 'Assets' : type === 'Liability' ? 'Liabilities' : 'Equity'}
                          </td>
                        </tr>,
                        ...group.map(b => (
                          <tr key={b.id}>
                            <td><span className="td-mono" style={{ fontSize: 11 }}>{b.code}</span></td>
                            <td>{b.name}</td>
                            <td><span className={`badge ${
                              b.type === 'Asset' ? 'badge-info' :
                              b.type === 'Liability' ? 'badge-warning' : 'badge-success'
                            }`}>{b.type}</span></td>
                            <td className="td-right tabular" style={{ fontWeight: 600 }}>
                              {fmt(b.balance)}
                            </td>
                          </tr>
                        )),
                      ];
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-16" style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                <strong>How carryover works:</strong> Balance Sheet accounts (Assets, Liabilities, Equity) accumulate
                indefinitely — their balances automatically carry forward to every new day, month, and year.
                Income statement accounts (Revenue, COGS, Expenses) are reset to zero when you perform the
                Year-End Closing, with the net income transferred to Retained Earnings above.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
