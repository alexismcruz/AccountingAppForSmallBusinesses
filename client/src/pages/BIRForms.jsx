import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';

const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

function triggerDownload(url, filename) {
  fetch(url, { credentials: 'include' })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    });
}

// ── 1601-C — Monthly Withholding Tax on Compensation ─────────────────────────
function Form1601C({ sym }) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  return (
    <div>
      <div className="card" style={{ padding:'16px 20px', marginBottom:16, background:'#eff6ff', border:'1px solid #bfdbfe' }}>
        <div style={{ fontWeight:700, fontSize:14, color:'#1d4ed8', marginBottom:6 }}>BIR Form 1601-C</div>
        <div style={{ fontSize:13, color:'#1e40af', lineHeight:1.6 }}>
          Monthly Remittance Return of Income Taxes Withheld on Compensation.<br />
          Covers all employees with withholding tax for the selected month's pay dates.
        </div>
      </div>

      <div style={{ display:'flex', gap:12, alignItems:'flex-end', marginBottom:20 }}>
        <div className="form-group" style={{ margin:0 }}>
          <label className="form-label">Year</label>
          <select className="form-input" style={{ width:100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[now.getFullYear()+1, now.getFullYear(), now.getFullYear()-1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin:0 }}>
          <label className="form-label">Month</label>
          <select className="form-input" style={{ width:140 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
        <button className="btn btn-primary"
          onClick={() => triggerDownload(
            `/api/payroll/bir/1601c?year=${year}&month=${month}`,
            `BIR-1601C-${year}-${String(month).padStart(2,'0')}.pdf`
          )}>
          📄 Download PDF
        </button>
      </div>

      <div className="card" style={{ padding:'14px 18px' }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Filing Reference</div>
        <div style={{ fontSize:13, color:'var(--text-primary)', lineHeight:1.8 }}>
          <div>• <strong>Deadline:</strong> 10th day of the following month (or next business day if holiday)</div>
          <div>• <strong>Where to file:</strong> BIR eFPS (Large Taxpayers) or eBIRForms (others)</div>
          <div>• <strong>Payment:</strong> Remit withheld tax together with the return</div>
          <div>• <strong>Penalties:</strong> 25% surcharge + 12% interest per year for late filing</div>
        </div>
      </div>
    </div>
  );
}

// ── 2316 — Annual Employee Tax Certificate ────────────────────────────────────
function Form2316({ sym }) {
  const now = new Date();
  const [year,      setYear]      = useState(now.getFullYear());
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/employees', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setEmployees(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="card" style={{ padding:'16px 20px', marginBottom:16, background:'#eff6ff', border:'1px solid #bfdbfe' }}>
        <div style={{ fontWeight:700, fontSize:14, color:'#1d4ed8', marginBottom:6 }}>BIR Form 2316</div>
        <div style={{ fontSize:13, color:'#1e40af', lineHeight:1.6 }}>
          Certificate of Compensation Payment / Tax Withheld. Issued to each employee at year-end.<br />
          Shows gross compensation, government contributions, and total withholding tax for the calendar year.
        </div>
      </div>

      <div style={{ display:'flex', gap:12, alignItems:'flex-end', marginBottom:20 }}>
        <div className="form-group" style={{ margin:0 }}>
          <label className="form-label">Calendar Year</label>
          <select className="form-input" style={{ width:100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[now.getFullYear(), now.getFullYear()-1, now.getFullYear()-2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? <div className="page-loading">Loading employees…</div> : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Position</th>
                <th>TIN</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.filter(e => e.is_active).map(e => (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight:600 }}>{e.first_name} {e.last_name}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{e.employee_number}</div>
                  </td>
                  <td style={{ fontSize:13 }}>{e.position || '—'}</td>
                  <td style={{ fontSize:13 }}>{e.tin || '—'}</td>
                  <td style={{ textAlign:'right' }}>
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => triggerDownload(
                        `/api/payroll/bir/2316/${e.id}/${year}`,
                        `BIR-2316-${e.employee_number}-${year}.pdf`
                      )}>
                      📄 Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ padding:'14px 18px', marginTop:16 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Filing Reference</div>
        <div style={{ fontSize:13, color:'var(--text-primary)', lineHeight:1.8 }}>
          <div>• <strong>Deadline:</strong> Provide to each employee on or before February 28 of the following year</div>
          <div>• <strong>Substituted filing:</strong> Employees with only one employer + only compensation income may use Form 2316 in lieu of filing ITR (BIR RR 3-2002)</div>
          <div>• <strong>Employer copy:</strong> Retain for 10 years as per BIR recordkeeping requirements</div>
        </div>
      </div>
    </div>
  );
}

// ── Business Tax Form builder ─────────────────────────────────────────────────
function BusinessTaxForm({ formCode, title, description, apiPath, periodType }) {
  const now = new Date();
  const [year,     setYear]    = useState(now.getFullYear());
  const [period,   setPeriod]  = useState(periodType === 'quarterly' ? 1 : now.getMonth() + 1);
  const [data,     setData]    = useState(null);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState('');
  const sym = '₱';
  const fmt = (v) => `${sym}${parseFloat(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  const load = async () => {
    setLoading(true); setError('');
    try {
      const params = periodType === 'quarterly'
        ? `year=${year}&quarter=${period}`
        : `year=${year}&month=${period}`;
      const res  = await fetch(`${apiPath}?${params}`, { credentials:'include' });
      const d    = await res.json();
      if (!res.ok) { setError(d.error); return; }
      setData(d);
    } catch { setError('Failed to load data.'); }
    finally   { setLoading(false); }
  };

  return (
    <div>
      <div className="card" style={{ padding:'16px 20px', marginBottom:16, background:'#eff6ff', border:'1px solid #bfdbfe' }}>
        <div style={{ fontWeight:700, fontSize:14, color:'#1d4ed8', marginBottom:6 }}>{formCode}</div>
        <div style={{ fontSize:13, color:'#1e40af', lineHeight:1.6 }}>{description}</div>
      </div>

      <div style={{ display:'flex', gap:12, alignItems:'flex-end', marginBottom:20 }}>
        <div className="form-group" style={{ margin:0 }}>
          <label className="form-label">Year</label>
          <select className="form-input" style={{ width:100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[now.getFullYear(), now.getFullYear()-1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin:0 }}>
          <label className="form-label">{periodType === 'quarterly' ? 'Quarter' : 'Month'}</label>
          {periodType === 'quarterly' ? (
            <select className="form-input" style={{ width:120 }} value={period} onChange={e => setPeriod(parseInt(e.target.value))}>
              <option value={1}>Q1 (Jan–Mar)</option>
              <option value={2}>Q2 (Apr–Jun)</option>
              <option value={3}>Q3 (Jul–Sep)</option>
              <option value={4}>Q4 (Oct–Dec)</option>
            </select>
          ) : (
            <select className="form-input" style={{ width:140 }} value={period} onChange={e => setPeriod(parseInt(e.target.value))}>
              {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          )}
        </div>
        <button className="btn btn-primary" onClick={load} disabled={loading}>
          {loading ? 'Computing…' : 'Compute'}
        </button>
      </div>

      {error && <div className="alert alert-error mb-12">⚠ {error}</div>}

      {data && (
        <div>
          {/* Summary cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:16 }}>
            {data.summary && Object.entries(data.summary).map(([k, v]) => (
              <div key={k} className="card" style={{ padding:'12px 16px' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{k}</div>
                <div style={{ fontSize:17, fontWeight:700, color:'#1d4ed8' }}>{typeof v === 'number' ? fmt(v) : v}</div>
              </div>
            ))}
          </div>

          {/* Line items */}
          {data.lines && data.lines.length > 0 && (
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <table className="table" style={{ fontSize:13 }}>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ textAlign:'right' }}>Base Amount</th>
                    <th style={{ textAlign:'right' }}>Rate</th>
                    <th style={{ textAlign:'right' }}>Tax Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.name}</td>
                      <td style={{ textAlign:'right' }}>{fmt(l.base)}</td>
                      <td style={{ textAlign:'right' }}>{l.rate != null ? `${l.rate}%` : '—'}</td>
                      <td style={{ textAlign:'right', fontWeight:600 }}>{fmt(l.tax)}</td>
                    </tr>
                  ))}
                </tbody>
                {data.total_tax != null && (
                  <tfoot>
                    <tr style={{ background:'#f1f5f9', fontWeight:700 }}>
                      <td colSpan={3}>Total Tax Due</td>
                      <td style={{ textAlign:'right' }}>{fmt(data.total_tax)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          <div className="card" style={{ padding:'14px 18px', marginTop:16 }}>
            <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.7 }}>
              <strong>Note:</strong> This is a system-generated summary based on recorded transactions in this system.
              Always cross-check against your official BIR eFPS or eBIRForms return before filing.
              Figures are based on tax applications recorded in this system only.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── VAT / PT / CIT data endpoints (served from tax route) ─────────────────────
// We'll build lightweight wrappers that call the existing projections endpoint

function VATForm({ sym }) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data,  setData]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fmt = (v) => `${sym}${parseFloat(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/api/tax/projections?year=${year}&period_type=monthly`, { credentials:'include' });
      const proj = await res.json();
      if (!res.ok) { setError(proj.error); return; }
      const periodKey = `${year}-${String(month).padStart(2,'0')}`;
      const p = proj.periods?.find(p => p.period_key === periodKey);
      if (!p) { setError('No data found for the selected period.'); return; }

      const vatOut = p.tax_breakdown.find(t => t.tax_code === 'VAT-OUT');
      const vatIn  = p.tax_breakdown.find(t => t.tax_code === 'VAT-IN');
      const outAmt = vatOut?.tax_amount || 0;
      const inAmt  = vatIn?.tax_amount  || 0;

      setData({
        period: p.period_label,
        output_vat_base: vatOut?.base_amount || 0,
        output_vat: outAmt,
        input_vat_base:  vatIn?.base_amount || 0,
        input_vat: inAmt,
        vat_payable: Math.max(0, outAmt - inAmt),
        excess_input: Math.max(0, inAmt - outAmt),
      });
    } catch { setError('Failed to compute VAT data.'); }
    finally   { setLoading(false); }
  };

  return (
    <div>
      <div className="card" style={{ padding:'16px 20px', marginBottom:16, background:'#eff6ff', border:'1px solid #bfdbfe' }}>
        <div style={{ fontWeight:700, fontSize:14, color:'#1d4ed8', marginBottom:6 }}>BIR Form 2550M</div>
        <div style={{ fontSize:13, color:'#1e40af', lineHeight:1.6 }}>
          Monthly VAT Return. Computes Output VAT on sales vs. Input VAT on purchases.
          Tax payable = Output VAT − Input VAT. Excess input carries forward.
        </div>
      </div>
      <div style={{ display:'flex', gap:12, alignItems:'flex-end', marginBottom:20 }}>
        <div className="form-group" style={{ margin:0 }}>
          <label className="form-label">Year</label>
          <select className="form-input" style={{ width:100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[now.getFullYear(), now.getFullYear()-1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin:0 }}>
          <label className="form-label">Month</label>
          <select className="form-input" style={{ width:140 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={load} disabled={loading}>
          {loading ? 'Computing…' : 'Compute'}
        </button>
      </div>
      {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
      {data && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:16 }}>
            {[
              { label:'Output VAT Base (Sales)', value: fmt(data.output_vat_base), color:'#2563eb' },
              { label:'Output VAT (12%)',        value: fmt(data.output_vat),      color:'#2563eb' },
              { label:'Input VAT Base (Purchases)', value: fmt(data.input_vat_base), color:'#dc2626' },
              { label:'Input VAT (12%)',          value: fmt(data.input_vat),      color:'#dc2626' },
              { label:'VAT Payable (Net)',         value: fmt(data.vat_payable),    color: data.vat_payable > 0 ? '#15803d' : '#64748b' },
              { label:'Excess Input (carry fwd)', value: fmt(data.excess_input),   color: data.excess_input > 0 ? '#7c3aed' : '#64748b' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card" style={{ padding:'12px 16px' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:17, fontWeight:700, color }}>{value}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding:'14px 18px' }}>
            <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.7 }}>
              <strong>Deadline:</strong> 20th day of the following month. File via BIR eFPS or eBIRForms (BIR Form 2550M).
              Quarterly summary via BIR Form 2550Q (last month of each quarter, 25th day of following month).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PetForm({ sym }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [quarter, setQ]   = useState(Math.ceil((now.getMonth()+1)/3));
  const [data, setData]   = useState(null);
  const [loading, setL]   = useState(false);
  const [error, setError] = useState('');
  const fmt = (v) => `${sym}${parseFloat(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  const load = async () => {
    setL(true); setError('');
    try {
      const res  = await fetch(`/api/tax/projections?year=${year}&period_type=quarterly`, { credentials:'include' });
      const proj = await res.json();
      if (!res.ok) { setError(proj.error); return; }
      const periodKey = `${year}-Q${quarter}`;
      const p = proj.periods?.find(p => p.period_key === periodKey);
      if (!p) { setError('No data found for the selected period.'); return; }
      const pt = p.tax_breakdown.find(t => t.tax_code === 'PT-3');
      setData({ period: p.period_label, base: pt?.base_amount||0, tax: pt?.tax_amount||0, rate: pt?.rate||3 });
    } catch { setError('Failed to compute data.'); }
    finally   { setL(false); }
  };

  return (
    <div>
      <div className="card" style={{ padding:'16px 20px', marginBottom:16, background:'#eff6ff', border:'1px solid #bfdbfe' }}>
        <div style={{ fontWeight:700, fontSize:14, color:'#1d4ed8', marginBottom:6 }}>BIR Form 2551Q</div>
        <div style={{ fontSize:13, color:'#1e40af', lineHeight:1.6 }}>
          Quarterly Percentage Tax Return. Applies to non-VAT registered businesses (3% on gross receipts).
        </div>
      </div>
      <div style={{ display:'flex', gap:12, alignItems:'flex-end', marginBottom:20 }}>
        <div className="form-group" style={{ margin:0 }}>
          <label className="form-label">Year</label>
          <select className="form-input" style={{ width:100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[now.getFullYear(), now.getFullYear()-1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin:0 }}>
          <label className="form-label">Quarter</label>
          <select className="form-input" style={{ width:130 }} value={quarter} onChange={e => setQ(parseInt(e.target.value))}>
            {[1,2,3,4].map(q => <option key={q} value={q}>Q{q}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={load} disabled={loading}>{loading ? 'Computing…' : 'Compute'}</button>
      </div>
      {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
      {data && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
            {[
              { label:'Gross Receipts (Sales Base)', value: fmt(data.base),   color:'#2563eb' },
              { label:`Percentage Tax (${data.rate}%)`,   value: fmt(data.tax),    color:'#15803d' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card" style={{ padding:'12px 16px' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:17, fontWeight:700, color }}>{value}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding:'14px 18px' }}>
            <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.7 }}>
              <strong>Deadline:</strong> 25th day of the month following the close of each taxable quarter.
              File via BIR eFPS or eBIRForms (BIR Form 2551Q).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CITForm({ sym }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [quarter, setQ]   = useState(Math.ceil((now.getMonth()+1)/3));
  const [data, setData]   = useState(null);
  const [loading, setL]   = useState(false);
  const [error, setError] = useState('');
  const fmt = (v) => `${sym}${parseFloat(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  const load = async () => {
    setL(true); setError('');
    try {
      const res  = await fetch(`/api/tax/projections?year=${year}&period_type=quarterly`, { credentials:'include' });
      const proj = await res.json();
      if (!res.ok) { setError(proj.error); return; }
      const periodKey = `${year}-Q${quarter}`;
      const p = proj.periods?.find(p => p.period_key === periodKey);
      if (!p) { setError('No data found for the selected period.'); return; }
      const cit = p.tax_breakdown.find(t => t.tax_code === 'CIT-25');
      const pit = p.tax_breakdown.find(t => t.tax_code === 'PIT-GRAD');
      const relevant = cit || pit;
      setData({ period: p.period_label, base: relevant?.base_amount||0, tax: relevant?.tax_amount||0,
                name: cit ? 'Corporate Income Tax (25%)' : 'Personal Income Tax (Graduated)',
                code: cit ? 'CIT-25' : 'PIT-GRAD', rate: relevant?.rate||0 });
    } catch { setError('Failed to compute data.'); }
    finally   { setL(false); }
  };

  return (
    <div>
      <div className="card" style={{ padding:'16px 20px', marginBottom:16, background:'#eff6ff', border:'1px solid #bfdbfe' }}>
        <div style={{ fontWeight:700, fontSize:14, color:'#1d4ed8', marginBottom:6 }}>BIR Form 1702Q / 1701Q</div>
        <div style={{ fontSize:13, color:'#1e40af', lineHeight:1.6 }}>
          Quarterly Income Tax Return for Corporations (1702Q) or Individuals / Sole Props (1701Q).
          Based on net income from recorded revenue and expenses.
        </div>
      </div>
      <div style={{ display:'flex', gap:12, alignItems:'flex-end', marginBottom:20 }}>
        <div className="form-group" style={{ margin:0 }}>
          <label className="form-label">Year</label>
          <select className="form-input" style={{ width:100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[now.getFullYear(), now.getFullYear()-1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin:0 }}>
          <label className="form-label">Quarter</label>
          <select className="form-input" style={{ width:130 }} value={quarter} onChange={e => setQ(parseInt(e.target.value))}>
            {[1,2,3,4].map(q => <option key={q} value={q}>Q{q}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={load} disabled={loading}>{loading ? 'Computing…' : 'Compute'}</button>
      </div>
      {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
      {data && (
        <div>
          <div className="card" style={{ padding:'14px 18px', marginBottom:12, background:'#fffbeb', border:'1px solid #fbbf24' }}>
            <div style={{ fontSize:12, color:'#92400e' }}>
              ⚠ Income tax is computed on <strong>net income</strong> from your books, not just from tax_applications.
              This is a projection based on recorded receivables/payables. For accurate quarterly IT, use your Trial Balance report.
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
            <div className="card" style={{ padding:'12px 16px' }}>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>Tax Type</div>
              <div style={{ fontSize:14, fontWeight:700, color:'#1d4ed8' }}>{data.name}</div>
            </div>
            <div className="card" style={{ padding:'12px 16px' }}>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>Projected Taxable Base</div>
              <div style={{ fontSize:17, fontWeight:700, color:'#2563eb' }}>{fmt(data.base)}</div>
            </div>
            <div className="card" style={{ padding:'12px 16px' }}>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>Projected Tax</div>
              <div style={{ fontSize:17, fontWeight:700, color:'#15803d' }}>{fmt(data.tax)}</div>
            </div>
          </div>
          <div className="card" style={{ padding:'14px 18px' }}>
            <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.7 }}>
              <strong>Deadline:</strong> 60 days after the close of each quarter. File via BIR eFPS or eBIRForms.
              Final Annual ITR is due April 15 (Corporations: 1702; Individuals: 1701).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main BIR Forms Page ───────────────────────────────────────────────────────
const TABS = [
  { key:'1601c', label:'1601-C · Comp. Withholding' },
  { key:'2316',  label:'2316 · Employee Tax Cert.' },
  { key:'2550m', label:'2550M · Monthly VAT' },
  { key:'2551q', label:'2551Q · Percentage Tax' },
  { key:'1702q', label:'1702Q/1701Q · Income Tax' },
];

export default function BIRForms() {
  const { settings } = useSettings();
  const sym = settings.currency_symbol || '₱';
  const [tab, setTab] = useState('1601c');

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display:'flex', gap:2, marginBottom:24, overflowX:'auto', paddingBottom:2,
                    borderBottom:'2px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'8px 14px', border:'none', background:'none', cursor:'pointer', whiteSpace:'nowrap',
              fontWeight: tab===t.key ? 700 : 400, fontSize:13,
              color: tab===t.key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: tab===t.key ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom:-2 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === '1601c' && <Form1601C sym={sym} />}
      {tab === '2316'  && <Form2316  sym={sym} />}
      {tab === '2550m' && <VATForm   sym={sym} />}
      {tab === '2551q' && <PetForm   sym={sym} />}
      {tab === '1702q' && <CITForm   sym={sym} />}
    </div>
  );
}
