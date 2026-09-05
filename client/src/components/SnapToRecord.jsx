import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, X, ScanLine, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useUser } from '../context/UserContext.jsx';
import AccountSelect from './AccountSelect.jsx';
import AmountInput from './AmountInput.jsx';
import StatusPill from './StatusPill.jsx';

const CURRENCY_OPTS = ['PHP', 'USD', 'SGD', 'EUR', 'AUD', 'JPY', 'GBP', 'CAD'];

// ── Read a file into a compact base64 payload ─────────────────────────────────
// Images are re-encoded to JPEG at ≤1600px (shrinks phone photos, and converts
// HEIC/PNG to an API-supported format). PDFs are sent as-is.
function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result).split(',')[1] || '';
        resolve({ data, media_type: 'application/pdf', filename: file.name, previewUrl: null, isPdf: true });
      };
      reader.onerror = () => reject(new Error('Could not read that file.'));
      reader.readAsDataURL(file);
      return;
    }

    // Image → canvas → JPEG
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const MAX = 1600;
        let { width: w, height: h } = img;
        if (Math.max(w, h) > MAX) {
          const s = MAX / Math.max(w, h);
          w = Math.round(w * s); h = Math.round(h * s);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        URL.revokeObjectURL(url);
        resolve({
          data: dataUrl.split(',')[1] || '',
          media_type: 'image/jpeg',
          filename: (file.name || 'receipt').replace(/\.[^.]+$/, '') + '.jpg',
          previewUrl: dataUrl,
          isPdf: false,
        });
      } catch (e) { URL.revokeObjectURL(url); reject(new Error('Could not process that image.')); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be opened. Try a JPG or PNG.')); };
    img.src = url;
  });
}

const money = (sym, n) =>
  `${sym}${Math.abs(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Modal ─────────────────────────────────────────────────────────────────────
function SnapModal({ onClose, onPosted }) {
  const { settings } = useSettings();
  const baseCurrency = settings.currency || 'PHP';
  const symbol       = settings.currency_symbol || '₱';

  const [phase,    setPhase]    = useState('pick');   // pick | scanning | review | done
  const [error,    setError]    = useState('');
  const [accounts, setAccounts] = useState([]);
  const [usage,    setUsage]    = useState(null);

  const [file,       setFile]       = useState(null);   // { data, media_type, filename, previewUrl, isPdf }
  const [extraction, setExtraction] = useState(null);
  const [result,     setResult]     = useState(null);   // { reference, status }
  const [committing, setCommitting] = useState(false);

  // Editable review fields
  const [form, setForm] = useState({
    vendor: '', date: '', amount: '', currency: baseCurrency, exchange_rate: '1',
    expenseId: '', paidFromId: '',
  });

  const cameraRef = useRef(null);
  const fileRef   = useRef(null);

  useEffect(() => {
    fetch('/api/accounts', { credentials: 'include' }).then(r => r.json()).then(rows => {
      setAccounts(Array.isArray(rows) ? rows : []);
    }).catch(() => {});
    fetch('/api/chatbot/usage', { credentials: 'include' }).then(r => r.json()).then(setUsage).catch(() => {});
  }, []);

  const expenseAccounts  = accounts.filter(a => a.type === 'Expense' || a.type === 'COGS');
  const paidFromAccounts = accounts.filter(a => a.type === 'Asset');
  const codeById = (id) => accounts.find(a => String(a.id) === String(id))?.code;
  const nameById = (id) => accounts.find(a => String(a.id) === String(id))?.name;

  const limitReached = usage && usage.limit != null && usage.limitReached;

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!f) return;
    setError('');
    try {
      const payload = await fileToPayload(f);
      const approxBytes = Math.floor(payload.data.length * 3 / 4);
      if (approxBytes > 8 * 1024 * 1024) { setError('That file is too large. Please use a photo under 8 MB.'); return; }
      setFile(payload);
    } catch (err) { setError(err.message || 'Could not read that file.'); }
  };

  const runScan = async () => {
    if (!file) return;
    setPhase('scanning'); setError('');
    try {
      const res = await fetch('/api/receipts/scan', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_type: file.media_type, data: file.data, filename: file.filename }),
      });
      const data = await res.json();
      if (data.usage) setUsage(data.usage);
      if (!res.ok) { setError(data.error || 'Scan failed.'); setPhase('pick'); return; }

      const ex = data.extraction || {};
      setExtraction(ex);

      if (ex.readable === false) {
        setPhase('review'); // still let them fill manually
      } else {
        setPhase('review');
      }

      // Pre-fill review fields with confidently-read values only
      const low = new Set(ex.low_confidence_fields || []);
      const expMatch  = ex.suggested_expense_code   && accounts.find(a => a.code === ex.suggested_expense_code   && (a.type === 'Expense' || a.type === 'COGS'));
      const paidMatch = ex.suggested_paid_from_code && accounts.find(a => a.code === ex.suggested_paid_from_code && a.type === 'Asset');
      const cur = CURRENCY_OPTS.includes(ex.currency) ? ex.currency : baseCurrency;
      setForm({
        vendor:        low.has('vendor')       ? '' : (ex.vendor || ''),
        date:          low.has('date')         ? '' : (ex.date   || ''),
        amount:        low.has('total_amount') || ex.total_amount == null ? '' : String(ex.total_amount),
        currency:      cur,
        exchange_rate: cur === baseCurrency ? '1' : '',
        expenseId:     expMatch  ? String(expMatch.id)  : '',
        paidFromId:    paidMatch ? String(paidMatch.id) : '',
      });
    } catch (err) {
      setError('The assistant is temporarily unavailable. Please try again.');
      setPhase('pick');
    }
  };

  const amt = parseFloat(form.amount) || 0;
  const isForeign = form.currency && form.currency !== baseCurrency;
  const rate = parseFloat(form.exchange_rate) || 0;
  const canSubmit =
    !!form.date && amt > 0 && !!form.expenseId && !!form.paidFromId &&
    form.expenseId !== form.paidFromId && (!isForeign || rate > 0) && !committing;

  const submit = async () => {
    if (!canSubmit) return;
    setCommitting(true); setError('');
    try {
      const res = await fetch('/api/receipts/commit', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:                   form.date,
          vendor:                 form.vendor || null,
          description:            form.vendor ? `${form.vendor} — receipt ${form.date}` : `Receipt ${form.date}`,
          currency:               form.currency,
          exchange_rate:          isForeign ? rate : 1,
          amount:                 amt,
          expense_account_code:   codeById(form.expenseId),
          paid_from_account_code: codeById(form.paidFromId),
          filename:               file?.filename,
          media_type:             file?.media_type,
          image_base64:           file?.data,
          extracted_json:         extraction || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save the entry.'); setCommitting(false); return; }
      setResult(data);
      setPhase('done');
      onPosted?.(`Receipt entry ${data.reference} ${data.status === 'posted' ? 'posted' : 'submitted for approval'}.`);
    } catch (err) { setError('Network error. Please try again.'); }
    finally { setCommitting(false); }
  };

  const lowSet  = new Set(extraction?.low_confidence_fields || []);
  const flagBox = (on) => on ? { borderColor: 'var(--color-accent, #D4A017)', background: '#FBF7E9' } : {};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ScanLine size={18} color="var(--color-primary, #2D6A4F)" /> Snap to Record
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error mb-16">{error}</div>}

          {/* ── PICK ─────────────────────────────────────────── */}
          {phase === 'pick' && (
            <>
              <div style={{ fontSize: 13, color: 'var(--color-ink-mid, #4A5E52)', marginBottom: 14, lineHeight: 1.6 }}>
                Take a photo of a receipt (or upload a scan/PDF) and the assistant will draft a
                journal entry for you to review. Nothing is posted until you submit it for approval.
              </div>

              {limitReached ? (
                <div className="alert alert-error mb-16">
                  Monthly AI limit reached ({usage.count}/{usage.limit}). Top up $10 for 15 more —{' '}
                  <a href="mailto:hello@cuentaiq.com" style={{ fontWeight: 600 }}>hello@cuentaiq.com</a>
                </div>
              ) : (
                <>
                  {!file ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <button className="btn btn-primary" style={{ justifyContent: 'center', padding: '18px 12px', flexDirection: 'column', gap: 6 }}
                        onClick={() => cameraRef.current?.click()}>
                        <Camera size={22} /> Take Photo
                      </button>
                      <button className="btn btn-ghost" style={{ justifyContent: 'center', padding: '18px 12px', flexDirection: 'column', gap: 6, border: '1px solid var(--color-border, #E2DDD4)' }}
                        onClick={() => fileRef.current?.click()}>
                        <Upload size={22} /> Choose File
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ border: '1px solid var(--color-border, #E2DDD4)', borderRadius: 10, padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                        {file.isPdf ? (
                          <div style={{ width: 64, height: 64, borderRadius: 8, background: 'var(--color-primary-light, #EAF2EE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--color-primary, #2D6A4F)', fontSize: 12 }}>PDF</div>
                        ) : (
                          <img src={file.previewUrl} alt="Receipt preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-border, #E2DDD4)' }} />
                        )}
                        <div style={{ flex: 1, fontSize: 13, color: 'var(--color-ink, #1B2E24)', overflow: 'hidden' }}>
                          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.filename}</div>
                          <button className="btn btn-ghost btn-sm" style={{ padding: '2px 0', color: 'var(--color-primary, #2D6A4F)' }} onClick={() => setFile(null)}>Replace</button>
                        </div>
                      </div>
                    </div>
                  )}

                  <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
                  <input ref={fileRef}   type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleFile} />

                  <div style={{ fontSize: 12, color: 'var(--color-ink-light, #8A9E92)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ScanLine size={13} /> Reading a receipt uses <strong>1 AI message</strong>
                    {usage && usage.limit != null && <span> · {usage.count}/{usage.limit} used this month</span>}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── SCANNING ─────────────────────────────────────── */}
          {phase === 'scanning' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 14px', width: 34, height: 34, border: '3px solid var(--color-primary-light, #EAF2EE)', borderTopColor: 'var(--color-primary, #2D6A4F)', borderRadius: '50%', animation: 'snapSpin 0.8s linear infinite' }} />
              <div style={{ fontSize: 14, color: 'var(--color-ink-mid, #4A5E52)' }}>Reading your receipt…</div>
              <style>{`@keyframes snapSpin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── REVIEW ───────────────────────────────────────── */}
          {phase === 'review' && (
            <>
              {extraction?.note && (
                <div className="alert mb-16" style={{ background: '#FBF7E9', border: '1px solid var(--color-accent, #D4A017)', color: '#7A5C0A', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{extraction.note}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Vendor</label>
                  <input className="form-input" style={flagBox(lowSet.has('vendor') && !form.vendor)} value={form.vendor}
                    placeholder="Merchant name" maxLength={120}
                    onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input" style={flagBox(lowSet.has('date') && !form.date)} value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isForeign ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <div style={flagBox(lowSet.has('total_amount') && !form.amount)}>
                    <AmountInput value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select className="form-select" value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value, exchange_rate: e.target.value === baseCurrency ? '1' : f.exchange_rate }))}>
                    {[...new Set([baseCurrency, ...CURRENCY_OPTS])].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {isForeign && (
                  <div className="form-group">
                    <label className="form-label">Rate → {baseCurrency}</label>
                    <input className="form-input" inputMode="decimal" value={form.exchange_rate} placeholder="0.00"
                      onChange={e => setForm(f => ({ ...f, exchange_rate: e.target.value.replace(/[^\d.]/g, '') }))} />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Expense account *</label>
                <AccountSelect value={form.expenseId} accounts={expenseAccounts}
                  onChange={v => setForm(f => ({ ...f, expenseId: v }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Paid from *</label>
                <AccountSelect value={form.paidFromId} accounts={paidFromAccounts}
                  onChange={v => setForm(f => ({ ...f, paidFromId: v }))} />
              </div>

              {/* Live entry preview */}
              {amt > 0 && form.expenseId && form.paidFromId && (
                <div style={{ marginTop: 6, border: '1px solid var(--color-primary-light, #EAF2EE)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: 'var(--color-primary-light, #EAF2EE)', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--color-primary, #2D6A4F)' }}>
                    Draft entry preview
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--color-primary-light, #EAF2EE)' }}>
                        <td style={{ padding: '6px 10px' }}>{codeById(form.expenseId)} — {nameById(form.expenseId)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-primary, #2D6A4F)' }}>{money(symbol, amt)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--color-border, #ccc)' }}>—</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px 10px' }}>{codeById(form.paidFromId)} — {nameById(form.paidFromId)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--color-border, #ccc)' }}>—</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-ink, #1B2E24)' }}>{money(symbol, amt)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── DONE ─────────────────────────────────────────── */}
          {phase === 'done' && result && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle2 size={40} color="var(--color-primary, #2D6A4F)" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-ink, #1B2E24)', marginBottom: 6 }}>
                Receipt recorded
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-ink-mid, #4A5E52)', marginBottom: 12 }}>
                Entry <strong>{result.reference}</strong> was created with the image attached.
              </div>
              <StatusPill status={result.status === 'posted' ? 'posted' : 'pending'} label={result.status === 'posted' ? 'Posted' : 'Pending Approval'} />
            </div>
          )}
        </div>

        <div className="modal-footer">
          {phase === 'pick' && (
            <>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={!file || limitReached} onClick={runScan}>
                <ScanLine size={15} style={{ marginRight: 6 }} /> Extract details
              </button>
            </>
          )}
          {phase === 'review' && (
            <>
              <button className="btn btn-ghost" onClick={() => { setPhase('pick'); }}>← Back</button>
              <button className="btn btn-primary" disabled={!canSubmit} onClick={submit}>
                {committing ? 'Submitting…' : 'Submit for Approval'}
              </button>
            </>
          )}
          {phase === 'done' && <button className="btn btn-primary" onClick={onClose}>Done</button>}
        </div>
      </div>
    </div>
  );
}

// ── Public button ─────────────────────────────────────────────────────────────
export default function SnapToRecord({ onPosted, variant = 'ghost', size }) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);

  // Admin is view-only for entries — hide, mirroring the manual "+ New Entry".
  if (user?.role === 'admin') return null;

  const cls = `btn btn-${variant === 'primary' ? 'primary' : 'ghost'}${size === 'sm' ? ' btn-sm' : ''}`;
  const style = variant === 'primary' ? {} : { border: '1px solid var(--color-primary, #2D6A4F)', color: 'var(--color-primary, #2D6A4F)' };

  return (
    <>
      <button className={cls} style={style} onClick={() => setOpen(true)}>
        <Camera size={15} style={{ marginRight: 6 }} /> Snap to Record
      </button>
      {open && <SnapModal onClose={() => setOpen(false)} onPosted={onPosted} />}
    </>
  );
}
