import { useState, useEffect } from 'react';
import AccountSelect from '../components/AccountSelect.jsx';
import CurrencySelect from '../components/CurrencySelect.jsx';
import AmountInput from '../components/AmountInput.jsx';
import CharCount from '../components/CharCount.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useUser } from '../context/UserContext.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { X, Download, Trash2, FileText } from 'lucide-react';

const TEMPLATES = [
  { name: 'Owner Investment',       desc: 'Owner puts money into the business',           lines: [{ code: '1010', side: 'debit' }, { code: '3000', side: 'credit' }] },
  { name: 'Business Registration',  desc: 'Pay government fees to register business',      lines: [{ code: '6500', side: 'debit' }, { code: '1000', side: 'credit' }] },
  { name: 'Buy Inventory (Cash)',   desc: 'Purchase stock with cash',                      lines: [{ code: '1200', side: 'debit' }, { code: '1000', side: 'credit' }] },
  { name: 'Buy Inventory (Credit)', desc: 'Purchase stock on credit from supplier',        lines: [{ code: '1200', side: 'debit' }, { code: '2000', side: 'credit' }] },
  { name: 'Cash Sale',              desc: 'Sell products and receive cash immediately',    lines: [{ code: '1000', side: 'debit' }, { code: '4000', side: 'credit' }] },
  { name: 'Sale on Credit',         desc: 'Sell on credit — customer pays later',          lines: [{ code: '1100', side: 'debit' }, { code: '4000', side: 'credit' }] },
  { name: 'Record COGS',            desc: 'Record cost of goods that were sold',           lines: [{ code: '5000', side: 'debit' }, { code: '1200', side: 'credit' }] },
  { name: 'Collect from Customer',  desc: 'Receive cash from credit customer',             lines: [{ code: '1010', side: 'debit' }, { code: '1100', side: 'credit' }] },
  { name: 'Pay Supplier',           desc: 'Pay a supplier you owed money to',              lines: [{ code: '2000', side: 'debit' }, { code: '1010', side: 'credit' }] },
  { name: 'Pay Rent',               desc: 'Pay monthly rent for business space',           lines: [{ code: '6100', side: 'debit' }, { code: '1010', side: 'credit' }] },
  { name: 'Pay Utilities',          desc: 'Pay electricity, water, internet bills',        lines: [{ code: '6200', side: 'debit' }, { code: '1010', side: 'credit' }] },
  { name: 'Pay Salaries',           desc: 'Pay employees their wages',                     lines: [{ code: '6000', side: 'debit' }, { code: '1010', side: 'credit' }] },
  { name: 'Owner Withdrawal',       desc: "Owner takes money out for personal use",        lines: [{ code: '3100', side: 'debit' }, { code: '1010', side: 'credit' }] },
];

const emptyLine = () => ({ accountId: '', debit: '', credit: '', notes: '' });

// ── CSV download helper ───────────────────────────────────────────────────────
function triggerDownload(url, filename) {
  fetch(url, { credentials: 'include' })
    .then(r => r.text())
    .then(text => {
      const blob = new Blob([text], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    });
}

// ── Entry status badge ────────────────────────────────────────────────────────
function EntryStatusBadge({ entry }) {
  switch (entry.status) {
    case 'draft':             return <StatusPill status="draft" />;
    case 'pending_approval':  return <StatusPill status="pending" label="Pending Approval" />;
    case 'pending_deletion':  return <StatusPill status="pending" label="Pending Deletion" />;
    case 'posted':
      return entry.entry_type === 'closing'
        ? <StatusPill status="pending" label="Closing" />
        : <StatusPill status="posted" />;
    default: return <StatusPill status={entry.status} />;
  }
}

// ── Import modal ──────────────────────────────────────────────────────────────
function ImportModal({ onClose, onImported }) {
  const [phase,   setPhase]   = useState('pick');
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState(null);
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target.result;
      setCsvText(text); setError(''); setLoading(true);
      try {
        const res  = await fetch('/api/entries/import/csv', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: text, dryRun: true }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.details ? data.details.join('\n') : data.error); }
        else { setPreview(data); setPhase('preview'); }
      } catch { setError('Network error.'); }
      finally { setLoading(false); }
    };
    reader.readAsText(file);
  };

  const handleConfirm = async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/entries/import/csv', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.details ? data.details.join('\n') : data.error); }
      else { setResult(data); setPhase('result'); onImported(); }
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Import Journal Entries</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {phase === 'pick' && (
            <>
              <div className="alert alert-info mb-16">
                Upload a CSV file with your journal entries. Each row is one debit or credit line. Rows with the same <strong>reference</strong> are grouped into one entry.
              </div>
              {error && <div className="alert alert-error mb-16" style={{ whiteSpace: 'pre-line' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => triggerDownload('/api/entries/import/template', 'journal-entries-template.csv')}>
                  <Download size={14} style={{ marginRight: 4 }} />Download Template
                </button>
              </div>
              <label style={{ display: 'block', border: '2px dashed var(--color-border)', borderRadius: 'var(--radius)',
                padding: 32, textAlign: 'center', cursor: 'pointer', color: 'var(--color-ink-mid)' }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile({ target: { files: [f] } }); }}>
                {loading ? 'Validating…' : 'Click to choose CSV file or drag & drop here'}
                <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFile} />
              </label>
            </>
          )}
          {phase === 'preview' && preview && (
            <>
              <div className="alert alert-success mb-16">
                File is valid — <strong>{preview.count} journal entr{preview.count !== 1 ? 'ies' : 'y'}</strong> ready to import.
              </div>
              <div className="text-muted text-sm">Existing entries with the same reference number will be skipped.</div>
            </>
          )}
          {phase === 'result' && result && (
            <>
              <div className="alert alert-success mb-16">
                Import complete — <strong>{result.imported}</strong> entr{result.imported !== 1 ? 'ies' : 'y'} imported.
                {result.skipped > 0 && ` ${result.skipped} skipped (already exist).`}
              </div>
              {result.skippedRefs?.length > 0 && (
                <div className="text-muted text-sm">Skipped: {result.skippedRefs.join(', ')}</div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          {phase === 'pick'    && <button className="btn btn-ghost" onClick={onClose}>Cancel</button>}
          {phase === 'preview' && <>
            <button className="btn btn-ghost" onClick={() => setPhase('pick')}>← Back</button>
            <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
              {loading ? 'Importing…' : `Import ${preview?.count} Entr${preview?.count !== 1 ? 'ies' : 'y'}`}
            </button>
          </>}
          {phase === 'result'  && <button className="btn btn-primary" onClick={onClose}>Done</button>}
        </div>
      </div>
    </div>
  );
}

// ── Submit-draft modal ────────────────────────────────────────────────────────
function SubmitModal({ entry, onClose, onDone }) {
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSubmit = async () => {
    setSaving(true); setError('');
    try {
      const res  = await fetch(`/api/entries/${entry.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submitter_note: note || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onDone(`Entry "${entry.reference}" submitted for approval.`);
      onClose();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Submit for Approval</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Submit <strong>{entry.reference}</strong> to the approval queue.
          </div>
          {error && <div className="alert alert-error mb-12">{error}</div>}
          <div className="form-group">
            <label className="form-label">Note for Approver <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
            <textarea className="form-textarea" rows={3} value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add context for the person reviewing this entry…" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Submitting…' : 'Submit for Approval'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Request-deletion modal ────────────────────────────────────────────────────
function DeletionModal({ entry, onClose, onDone }) {
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleRequest = async () => {
    setSaving(true); setError('');
    try {
      const res  = await fetch(`/api/entries/${entry.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletion_note: note || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onDone(`Deletion request submitted for "${entry.reference}".`);
      onClose();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Request Entry Deletion</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="alert alert-warning mb-16">
            You are requesting deletion of <strong>{entry.reference}</strong>.
            An approver must review and approve before it is permanently removed.
          </div>
          {error && <div className="alert alert-error mb-12">{error}</div>}
          <div className="form-group">
            <label className="form-label">Reason for Deletion <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
            <textarea className="form-textarea" rows={3} value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Why should this entry be deleted?" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={handleRequest} disabled={saving}>
            {saving ? 'Submitting…' : 'Submit Deletion Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function JournalEntries() {
  const { fmt, settings } = useSettings();
  const { can, user }     = useUser();
  const baseCurrency      = settings.currency || 'PHP';

  const [entries,      setEntries]      = useState([]);
  const [accounts,     setAccounts]     = useState([]);
  const [showForm,     setShowForm]     = useState(false);
  const [showTemplates,setShowTemplates]= useState(false);
  const [showImport,   setShowImport]   = useState(false);
  const [expandedId,   setExpandedId]   = useState(null);
  const [expandedData, setExpandedData] = useState({});
  const [loading,      setLoading]      = useState(false);
  const [msg,          setMsg]          = useState(null);
  const [filters,      setFilters]      = useState({ from: '', to: '', search: '' });
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  // action modals
  const [submitModal,   setSubmitModal]   = useState(null);
  const [deletionModal, setDeletionModal] = useState(null);

  const [form, setForm] = useState({
    date:           new Date().toISOString().split('T')[0],
    reference:      '',
    description:    '',
    currency:       baseCurrency,
    exchange_rate:  '1',
    submitter_note: '',
    lines:          [emptyLine(), emptyLine()],
  });

  useEffect(() => { loadAccounts(); loadEntries(); }, []);
  useEffect(() => { if (showForm) loadNextRef(); }, [showForm]);

  const loadEntries = (pg = 1) => {
    const q = new URLSearchParams();
    if (filters.from)   q.set('from',   filters.from);
    if (filters.to)     q.set('to',     filters.to);
    if (filters.search) q.set('search', filters.search);
    q.set('page', pg);
    fetch(`/api/entries?${q}`)
      .then(r => r.json())
      .then(data => {
        setEntries(data.rows || []);
        setTotalPages(data.totalPages || 1);
        setTotalEntries(data.total || 0);
        setPage(pg);
      })
      .catch(() => {});
  };

  const loadAccounts = () =>
    fetch('/api/accounts').then(r => r.json()).then(setAccounts).catch(() => {});

  const loadNextRef = () =>
    fetch('/api/reports/next-reference').then(r => r.json())
      .then(d => setForm(f => ({ ...f, reference: d.reference })));

  const updateLine = (i, field, val) => {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [field]: val };
      if (field === 'debit'  && val !== '') lines[i].credit = '';
      if (field === 'credit' && val !== '') lines[i].debit  = '';
      return { ...f, lines };
    });
  };

  const removeLine = (i) => {
    if (form.lines.length <= 2) return;
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  };

  const totalDebit  = form.lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;
  const rate        = parseFloat(form.exchange_rate) || 1;
  const isForeignCurrency = form.currency && form.currency !== baseCurrency;

  const applyTemplate = (tpl) => {
    const byCode = {};
    for (const a of accounts) byCode[a.code] = a.id;
    const lines = tpl.lines.map(l => ({ ...emptyLine(), accountId: String(byCode[l.code] || '') }));
    while (lines.length < 2) lines.push(emptyLine());
    setForm(f => ({ ...f, lines, description: tpl.name }));
    setShowTemplates(false);
  };

  const resetForm = () => setForm({
    date: new Date().toISOString().split('T')[0],
    reference: '', description: '',
    currency: baseCurrency, exchange_rate: '1',
    submitter_note: '',
    lines: [emptyLine(), emptyLine()],
  });

  // ── Submit new entry ────────────────────────────────────────────────────────
  const handleSubmit = async (submitForApproval = false) => {
    if (!form.date || !form.reference || !form.description.trim()) {
      setMsg({ type: 'error', text: 'Please fill in date, reference number, and description.' }); return;
    }
    const validLines = form.lines.filter(l => l.accountId);
    if (validLines.length < 2) {
      setMsg({ type: 'error', text: 'At least 2 line items with accounts are required.' }); return;
    }
    if (!isBalanced) {
      setMsg({ type: 'error', text: `Entry is not balanced. Debits: ${fmt(totalDebit)} / Credits: ${fmt(totalCredit)}.` }); return;
    }
    setLoading(true); setMsg(null);
    try {
      const res  = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:           form.date,
          reference:      form.reference,
          description:    form.description,
          currency:       form.currency || baseCurrency,
          exchange_rate:  parseFloat(form.exchange_rate) || 1,
          submit:         submitForApproval,
          submitter_note: form.submitter_note || null,
          lines: validLines.map(l => ({
            account_id: l.accountId,
            debit:  parseFloat(l.debit)  || 0,
            credit: parseFloat(l.credit) || 0,
            notes:  l.notes || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.error }); return; }
      const successText = user?.role === 'super_admin'
        ? `Entry ${data.reference} posted successfully.`
        : submitForApproval
          ? `Entry ${data.reference} submitted for approval.`
          : `Entry ${data.reference} saved as draft.`;
      setMsg({ type: 'success', text: successText });
      resetForm();
      setShowForm(false);
      loadEntries(1);
    } catch { setMsg({ type: 'error', text: 'Network error. Is the server running?' }); }
    finally { setLoading(false); }
  };

  // ── Delete draft / cancel pending ───────────────────────────────────────────
  const handleDelete = async (entry) => {
    const msg = entry.status === 'draft'
      ? `Delete draft "${entry.reference}"? This cannot be undone.`
      : entry.status === 'posted'
        ? `Delete posted entry "${entry.reference}"? This cannot be undone.`
        : `Cancel submission for "${entry.reference}"? The entry will be removed.`;
    if (!window.confirm(msg)) return;
    const res  = await fetch(`/api/entries/${entry.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { setMsg({ type: 'error', text: data.error }); return; }
    const okText = entry.status === 'draft'
      ? `Draft "${entry.reference}" deleted.`
      : entry.status === 'posted'
        ? `Entry "${entry.reference}" deleted.`
        : `Entry "${entry.reference}" cancelled.`;
    setMsg({ type: 'success', text: okText });
    loadEntries(page);
    if (expandedId === entry.id) setExpandedId(null);
  };

  // ── Recall pending entry back to draft ──────────────────────────────────────
  const handleRecall = async (entry) => {
    if (!window.confirm(`Recall "${entry.reference}" back to draft?`)) return;
    const res  = await fetch(`/api/entries/${entry.id}/recall`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setMsg({ type: 'success', text: `Entry "${entry.reference}" recalled to draft.` });
      loadEntries(page);
    } else {
      setMsg({ type: 'error', text: data.error });
    }
  };

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!expandedData[id]) {
      const data = await fetch(`/api/entries/${id}`).then(r => r.json());
      setExpandedData(d => ({ ...d, [id]: data }));
    }
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin      = user?.role === 'admin';
  const canCreate    = !isAdmin; // staff, manager, finance, super_admin can all create

  return (
    <div>
      {/* ── Action modals ─────────────────────────────────────────────────── */}
      {submitModal && (
        <SubmitModal
          entry={submitModal}
          onClose={() => setSubmitModal(null)}
          onDone={text => { setMsg({ type: 'success', text }); loadEntries(page); }}
        />
      )}
      {deletionModal && (
        <DeletionModal
          entry={deletionModal}
          onClose={() => setDeletionModal(null)}
          onDone={text => { setMsg({ type: 'success', text }); loadEntries(page); }}
        />
      )}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={() => loadEntries(1)} />}

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="page-title">Journal Entries</div>
          <div className="page-subtitle">Double-entry accounting records</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {can('manager') && (
            <button className="btn btn-ghost btn-sm"
              onClick={() => triggerDownload(
                `/api/entries/export/csv${filters.from || filters.to ? `?from=${filters.from}&to=${filters.to}` : ''}`,
                `journal-entries-${new Date().toISOString().split('T')[0]}.csv`
              )}>
              ⬇ Export CSV
            </button>
          )}
          {can('finance') && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(true)}>
              ⬆ Import CSV
            </button>
          )}
          {canCreate && !showForm && (
            <button className="btn btn-primary" onClick={() => { setShowForm(true); setMsg(null); }}>
              + New Entry
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'} mb-16`}>
          {msg.text}
        </div>
      )}

      {/* ── Entry Form ────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="card mb-20">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>New Journal Entry</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowTemplates(t => !t)}>
              <FileText size={14} style={{ marginRight: 4 }} />Use Template
            </button>
          </div>

          {showTemplates && (
            <div className="mb-16" style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 16 }}>
              <div className="section-title mb-8">Select a Template</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {TEMPLATES.map(tpl => (
                  <button key={tpl.name} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                    title={tpl.desc} onClick={() => applyTemplate(tpl)}>
                    {tpl.name}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                Hover over a template to see what it does. You can edit amounts after applying.
              </div>
            </div>
          )}

          {/* Header fields */}
          <div className="grid-3 mb-16">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Reference No. *</label>
              <input type="text" className="form-input" value={form.reference} placeholder="JE-0001"
                maxLength={50}
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
              <CharCount value={form.reference} max={50} />
            </div>
            <div className="form-group">
              <label className="form-label">Description *</label>
              <input type="text" className="form-input" value={form.description} placeholder="What is this entry for?"
                maxLength={255}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <CharCount value={form.description} max={255} />
            </div>
          </div>

          {/* Currency */}
          <div className="mb-16">
            <CurrencySelect
              value={form.currency}
              onChange={val => setForm(f => ({ ...f, currency: val, exchange_rate: val === baseCurrency ? '1' : f.exchange_rate }))}
              rate={form.exchange_rate}
              onRateChange={val => setForm(f => ({ ...f, exchange_rate: val }))}
              label="Transaction Currency"
            />
            {isForeignCurrency && rate > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                Amounts above are in <strong>{form.currency}</strong>.
                Base totals: Debit {fmt(totalDebit / rate)} · Credit {fmt(totalCredit / rate)} ({baseCurrency})
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="table-wrap">
            <table style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: 30 }}>#</th>
                  <th style={{ width: '36%' }}>Account <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(hover ⓘ for info)</span></th>
                  <th>Notes (optional)</th>
                  <th style={{ width: 130 }} className="td-right">Debit</th>
                  <th style={{ width: 130 }} className="td-right">Credit</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-light)', fontSize: 12 }}>{i + 1}</td>
                    <td>
                      <AccountSelect value={line.accountId}
                        onChange={val => updateLine(i, 'accountId', val)} accounts={accounts} />
                    </td>
                    <td>
                      <div>
                        <input type="text" className="form-input" style={{ fontSize: 12 }}
                          value={line.notes} placeholder="Add a note…" maxLength={150}
                          onChange={e => updateLine(i, 'notes', e.target.value)} />
                        <CharCount value={line.notes} max={150} />
                      </div>
                    </td>
                    <td>
                      <AmountInput value={line.debit} onChange={val => updateLine(i, 'debit', val)} placeholder="0.00" />
                    </td>
                    <td>
                      <AmountInput value={line.credit} onChange={val => updateLine(i, 'credit', val)} placeholder="0.00" />
                    </td>
                    <td>
                      <button className="btn btn-icon"
                        style={{ color: 'var(--text-light)', background: 'none', border: 'none', fontSize: 16 }}
                        title="Remove row" onClick={() => removeLine(i)} disabled={form.lines.length <= 2}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => setForm(f => ({ ...f, lines: [...f.lines, emptyLine()] }))}>
                      + Add Row
                    </button>
                  </td>
                  <td className="td-right" style={{ fontWeight: 700, fontSize: 14, paddingRight: 14 }}>
                    {fmt(totalDebit)}
                  </td>
                  <td className="td-right" style={{ fontWeight: 700, fontSize: 14, paddingRight: 14 }}>
                    {fmt(totalCredit)}
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={6} style={{ paddingTop: 8 }}>
                    {totalDebit === 0 && totalCredit === 0
                      ? <span className="text-muted text-sm">Enter debit and credit amounts above.</span>
                      : isBalanced
                        ? <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>Entry is balanced</span>
                        : <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 13 }}>
                            Not balanced — difference: {fmt(Math.abs(totalDebit - totalCredit))}
                          </span>
                    }
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Submitter note (not shown for super_admin who posts directly) */}
          {!isSuperAdmin && (
            <div className="form-group mt-12">
              <label className="form-label">
                Note for Approver <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <input type="text" className="form-input" value={form.submitter_note}
                maxLength={255}
                placeholder="Add context for the person reviewing this entry…"
                onChange={e => setForm(f => ({ ...f, submitter_note: e.target.value }))} />
            </div>
          )}

          <div className="divider" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => { setShowForm(false); setMsg(null); }}>Cancel</button>
            {isSuperAdmin ? (
              <button className="btn btn-success" onClick={() => handleSubmit(false)} disabled={loading || !isBalanced}>
                {loading ? 'Posting…' : 'Post Entry'}
              </button>
            ) : (
              <>
                <button className="btn btn-ghost" style={{ border: '1px solid var(--border)' }}
                  onClick={() => handleSubmit(false)} disabled={loading || !isBalanced}>
                  {loading ? 'Saving…' : 'Save as Draft'}
                </button>
                <button className="btn btn-primary" onClick={() => handleSubmit(true)} disabled={loading || !isBalanced}>
                  {loading ? 'Submitting…' : 'Submit for Approval'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="card mb-16" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
            <label className="form-label">Search</label>
            <input type="text" className="form-input" placeholder="Description or reference…"
              value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">From</label>
            <input type="date" className="form-input" value={filters.from}
              onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">To</label>
            <input type="date" className="form-input" value={filters.to}
              onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          </div>
          <button className="btn btn-primary" onClick={() => loadEntries(1)}>Filter</button>
          <button className="btn btn-ghost" onClick={() => {
            setFilters({ from: '', to: '', search: '' });
            setTimeout(() => loadEntries(1), 50);
          }}>Clear</button>
        </div>
      </div>

      {/* ── Entries List ──────────────────────────────────────────────────── */}
      <div className="card">
        {totalEntries > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'} found
            {totalPages > 1 && ` — page ${page} of ${totalPages}`}
          </div>
        )}
        {entries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <p>No journal entries found.{canCreate && <> Click <strong>+ New Entry</strong> to get started.</>}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th className="td-right">Amount</th>
                  <th>Currency</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const isOwner  = entry.created_by_email === user?.email;
                  const canAct   = isOwner || isSuperAdmin;

                  return (
                    <>
                      <tr key={entry.id} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(entry.id)}>
                        <td>{new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td><span className="td-mono">{entry.reference}</span></td>
                        <td>{entry.description}</td>
                        <td className="td-right tabular">{fmt(entry.total_amount)}</td>
                        <td>
                          {entry.currency && entry.currency !== baseCurrency
                            ? <span className="pill pill-primary">{entry.currency}</span>
                            : <span style={{ color: 'var(--text-light)', fontSize: 12 }}>{entry.currency || baseCurrency}</span>}
                        </td>
                        <td><EntryStatusBadge entry={entry} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>

                            {/* Draft: Submit + Delete (owner or super_admin) */}
                            {entry.status === 'draft' && canAct && (
                              <>
                                {!isSuperAdmin && (
                                  <button className="btn btn-primary btn-sm"
                                    onClick={e => { e.stopPropagation(); setSubmitModal(entry); }}>
                                    ↑ Submit
                                  </button>
                                )}
                                <button className="btn btn-ghost btn-sm"
                                  title="Delete draft"
                                  style={{ color: 'var(--danger)', borderColor: 'transparent' }}
                                  onClick={e => { e.stopPropagation(); handleDelete(entry); }}><Trash2 size={14} /></button>
                              </>
                            )}

                            {/* Pending Approval: Recall (owner or super_admin) */}
                            {entry.status === 'pending_approval' && canAct && (
                              <button className="btn btn-ghost btn-sm"
                                style={{ fontSize: 12 }}
                                onClick={e => { e.stopPropagation(); handleRecall(entry); }}>
                                ↩ Recall
                              </button>
                            )}

                            {/* Posted: Delete (super_admin direct) or Request Deletion (others) */}
                            {entry.status === 'posted' && !isAdmin && (
                              isSuperAdmin
                                ? <button className="btn btn-ghost btn-sm" title="Delete entry"
                                    style={{ color: 'var(--danger)', borderColor: 'transparent' }}
                                    onClick={e => { e.stopPropagation(); handleDelete(entry); }}><Trash2 size={14} /></button>
                                : <button className="btn btn-ghost btn-sm" title="Request deletion"
                                    style={{ color: 'var(--danger)', borderColor: 'transparent' }}
                                    onClick={e => { e.stopPropagation(); setDeletionModal(entry); }}><Trash2 size={14} /></button>
                            )}

                            {/* Pending Deletion: informational */}
                            {entry.status === 'pending_deletion' && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                Awaiting
                              </span>
                            )}

                            <span style={{ color: 'var(--text-light)', fontSize: 12, padding: '6px 4px' }}>
                              {expandedId === entry.id ? '▲' : '▼'}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded detail ──────────────────────────────── */}
                      {expandedId === entry.id && expandedData[entry.id] && (
                        <tr key={`${entry.id}-detail`}>
                          <td colSpan={7} style={{ background: '#f8fafc', padding: 0 }}>
                            <div style={{ padding: '12px 24px' }}>
                              {/* Submitter info */}
                              {expandedData[entry.id].created_by_name && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                                  Created by: <strong>{expandedData[entry.id].created_by_name}</strong>
                                  {' '}({expandedData[entry.id].created_by_role})
                                </div>
                              )}
                              <table style={{ width: '100%', fontSize: 12 }}>
                                <thead>
                                  <tr>
                                    <th style={{ background: 'transparent', fontSize: 10 }}>Account</th>
                                    <th style={{ background: 'transparent', fontSize: 10 }}>Notes</th>
                                    <th className="td-right" style={{ background: 'transparent', fontSize: 10 }}>Debit</th>
                                    <th className="td-right" style={{ background: 'transparent', fontSize: 10 }}>Credit</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {expandedData[entry.id].lines.map(line => (
                                    <tr key={line.id}>
                                      <td><span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{line.code}</span> {line.account_name}</td>
                                      <td style={{ color: 'var(--text-muted)' }}>{line.notes || '—'}</td>
                                      <td className="td-right tabular">{line.debit  > 0 ? fmt(line.debit)  : '—'}</td>
                                      <td className="td-right tabular">{line.credit > 0 ? fmt(line.credit) : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination controls ───────────────────────────────────────── */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, marginTop: 8, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, totalEntries)} of {totalEntries}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => loadEntries(page - 1)}>
                ← Prev
              </button>
              <span style={{ fontSize: 13 }}>Page {page} of {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => loadEntries(page + 1)}>
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
