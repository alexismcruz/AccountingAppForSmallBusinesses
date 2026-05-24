import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useUser } from '../context/UserContext.jsx';
import CurrencySelect from '../components/CurrencySelect.jsx';
import AmountInput from '../components/AmountInput.jsx';

const emptyForm = { sku: '', name: '', category: '', unit: 'pcs', quantity: '', unit_cost: '', reorder_point: '10', notes: '', submitter_note: '' };
const makeEmptyReplenish = (baseCurrency) => ({ qty: '', unit_cost: '', payment_method: 'cash', notes: '', date: new Date().toISOString().split('T')[0], reference: '', currency: baseCurrency, exchange_rate: '1' });

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

// ── Import modal ──────────────────────────────────────────────────────────────
function ImportModal({ onClose, onImported, isSuperAdmin }) {
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
      setCsvText(text);
      setError('');
      setLoading(true);
      try {
        const res = await fetch('/api/inventory/import/csv', {
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
      const res = await fetch('/api/inventory/import/csv', {
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
          <div className="modal-title">📥 Import Inventory Items</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {phase === 'pick' && (
            <>
              <div className="alert alert-info mb-16">
                Upload a CSV file to bulk-import inventory items.
                {isSuperAdmin
                  ? ' Items will be added directly to inventory.'
                  : ' Each item will be submitted for approval — they will appear once a manager or finance user approves them.'}
              </div>
              {error && <div className="alert alert-error mb-16" style={{ whiteSpace: 'pre-line' }}>⚠ {error}</div>}
              <div style={{ marginBottom: 16 }}>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => triggerDownload('/api/inventory/import/template', 'inventory-template.csv')}>
                  📄 Download Template
                </button>
              </div>
              <label style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: 8,
                padding: 32, textAlign: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile({ target: { files: [f] } }); }}>
                {loading ? '⏳ Validating…' : '📂 Click to choose CSV file or drag & drop here'}
                <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFile} />
              </label>
            </>
          )}
          {phase === 'preview' && preview && (
            <div className="alert alert-success">
              ✓ File is valid — <strong>{preview.count} item{preview.count !== 1 ? 's' : ''}</strong> ready to{isSuperAdmin ? ' import' : ' submit for approval'}.
            </div>
          )}
          {phase === 'result' && result && (
            <>
              {result.pendingApproval ? (
                <div className="alert alert-warning mb-16">
                  ⏳ <strong>{result.imported}</strong> item{result.imported !== 1 ? 's' : ''} submitted for approval.
                  {result.skipped > 0 && ` ${result.skipped} skipped (duplicate SKU).`}
                  {' '}They will appear in inventory once approved.
                </div>
              ) : (
                <div className="alert alert-success mb-16">
                  ✓ Import complete — <strong>{result.imported}</strong> item{result.imported !== 1 ? 's' : ''} added to inventory.
                  {result.skipped > 0 && ` ${result.skipped} skipped.`}
                </div>
              )}
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
              {loading
                ? (isSuperAdmin ? 'Importing…' : 'Submitting…')
                : isSuperAdmin
                  ? `✓ Import ${preview?.count} Item${preview?.count !== 1 ? 's' : ''}`
                  : `✓ Submit ${preview?.count} Item${preview?.count !== 1 ? 's' : ''} for Approval`}
            </button>
          </>}
          {phase === 'result'  && <button className="btn btn-primary" onClick={onClose}>Done</button>}
        </div>
      </div>
    </div>
  );
}

// ── Deletion-request modal ────────────────────────────────────────────────────
function DeletionModal({ item, onClose, onDone }) {
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleRequest = async () => {
    setSaving(true); setError('');
    try {
      const res  = await fetch(`/api/inventory/${item.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletion_note: note || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onDone(data.action === 'deleted' ? 'Item deleted.' : 'Deletion request submitted — awaiting approval.');
      onClose();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">🗑 Request Item Deletion</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-warning mb-16">
            Requesting deletion of <strong>{item.sku}</strong> — {item.name}.
            An approver must review this before the item is permanently removed.
          </div>
          {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
          <div className="form-group">
            <label className="form-label">Reason for Deletion <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
            <textarea className="form-textarea" rows={3} value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Why should this item be removed?" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={handleRequest} disabled={saving}>
            {saving ? 'Submitting…' : '🗑 Submit Deletion Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status badge helper ───────────────────────────────────────────────────────
function itemStatusBadge(item) {
  if (item.pending_approval) return <span className="badge badge-info">Pending Approval</span>;
  if (item.pending_deletion) return <span className="badge badge-warning">Pending Deletion</span>;
  if (item.quantity === 0)   return <span className="badge badge-danger">Out of Stock</span>;
  if (item.quantity <= item.reorder_point) return <span className="badge badge-warning">Low Stock</span>;
  return <span className="badge badge-success">In Stock</span>;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Inventory() {
  const { fmt, settings } = useSettings();
  const { can, user }     = useUser();
  const baseCurrency = settings.currency || 'USD';
  const [items,         setItems]         = useState([]);
  const [search,        setSearch]        = useState('');
  const [showModal,     setShowModal]     = useState(false);
  const [showImport,    setShowImport]    = useState(false);
  const [replenishItem, setReplenishItem] = useState(null);
  const [editItem,      setEditItem]      = useState(null);
  const [deletionModal, setDeletionModal] = useState(null);
  const [form,          setForm]          = useState(emptyForm);
  const [repForm,       setRepForm]       = useState(makeEmptyReplenish(baseCurrency));
  const [msg,           setMsg]           = useState(null);
  const [saving,        setSaving]        = useState(false);

  useEffect(() => { loadItems(); }, []);

  const loadItems = () => {
    fetch('/api/inventory').then(r => r.json()).then(setItems).catch(() => {});
  };

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.sku.toLowerCase().includes(search.toLowerCase()) ||
    (i.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const approvedItems = items.filter(i => !i.pending_approval);
  const totalValue    = approvedItems.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
  const lowStockCount = approvedItems.filter(i => i.quantity <= i.reorder_point).length;
  const pendingCount  = items.filter(i => i.pending_approval).length;

  const openAdd = () => { setEditItem(null); setForm(emptyForm); setShowModal(true); setMsg(null); };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({ sku: item.sku, name: item.name, category: item.category || '', unit: item.unit,
      quantity: item.quantity, unit_cost: item.unit_cost, reorder_point: item.reorder_point,
      notes: item.notes || '', submitter_note: '' });
    setShowModal(true); setMsg(null);
  };
  const openReplenish = (item) => {
    setReplenishItem(item);
    setRepForm({ ...makeEmptyReplenish(baseCurrency), unit_cost: item.unit_cost, date: new Date().toISOString().split('T')[0] });
    setMsg(null);
  };

  const handleSave = async () => {
    if (!form.sku || !form.name) { setMsg({ type: 'error', text: 'SKU and name are required.' }); return; }
    setSaving(true); setMsg(null);
    try {
      const url    = editItem ? `/api/inventory/${editItem.id}` : '/api/inventory';
      const method = editItem ? 'PUT' : 'POST';
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.error }); return; }
      setShowModal(false);
      if (!editItem && data.pending_approval) {
        setMsg({ type: 'success', text: `"${data.name}" submitted for approval.` });
      }
      loadItems();
    } catch { setMsg({ type: 'error', text: 'Network error.' }); }
    finally { setSaving(false); }
  };

  const handleReplenish = async () => {
    if (!repForm.qty || parseFloat(repForm.qty) <= 0) { setMsg({ type: 'error', text: 'Quantity must be greater than 0.' }); return; }
    if (!repForm.reference) { setMsg({ type: 'error', text: 'Please enter a reference number for the journal entry.' }); return; }
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`/api/inventory/${replenishItem.id}/replenish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...repForm, exchange_rate: parseFloat(repForm.exchange_rate) || 1 }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.error }); return; }
      setReplenishItem(null); loadItems();
    } catch { setMsg({ type: 'error', text: 'Network error.' }); }
    finally { setSaving(false); }
  };

  const handleRecall = async (item) => {
    try {
      const res  = await fetch(`/api/inventory/${item.id}/recall`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.error }); return; }
      setMsg({ type: 'success', text: 'Submission recalled.' });
      loadItems();
    } catch { setMsg({ type: 'error', text: 'Network error.' }); }
  };

  const today = new Date().toISOString().split('T')[0];
  const exportFilename = `inventory-${today}.csv`;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Inventory</div>
          <div className="page-subtitle">Track your stock and reorder levels</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {user?.role !== 'admin' && (
            <button className="btn btn-ghost btn-sm"
              onClick={() => triggerDownload('/api/inventory/export/csv', exportFilename)}>
              ⬇ Export CSV
            </button>
          )}
          {user?.role !== 'admin' && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(true)}>
              ⬆ Import CSV
            </button>
          )}
          {user?.role !== 'admin' && (
            <button className="btn btn-primary" onClick={openAdd}>+ Add Item</button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid-3 mb-20">
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-label">Total Items</div>
          <div className="stat-value">{approvedItems.length}</div>
          {pendingCount > 0 && <div className="stat-sub">{pendingCount} pending approval</div>}
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-label">Inventory Value</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{fmt(totalValue)}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: `4px solid ${lowStockCount > 0 ? 'var(--danger)' : 'var(--border)'}` }}>
          <div className="stat-label">Low / Out of Stock</div>
          <div className="stat-value" style={{ color: lowStockCount > 0 ? 'var(--danger)' : 'var(--text)' }}>{lowStockCount}</div>
          <div className="stat-sub">At or below reorder point</div>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'} mb-16`}>{msg.text}</div>}

      {/* Search */}
      <div className="card mb-16" style={{ padding: '12px 20px' }}>
        <input type="text" className="form-input" placeholder="Search by name, SKU, or category…"
          value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 380 }} />
      </div>

      {/* Items table */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <p>No inventory items yet. Click <strong>+ Add Item</strong> to add your first product.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th className="td-right">Qty on Hand</th>
                  <th className="td-right">Unit Cost</th>
                  <th className="td-right">Total Value</th>
                  <th className="td-right">Reorder At</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const isLow    = item.quantity <= item.reorder_point;
                  const isPendingApproval = !!item.pending_approval;
                  const canRecall = isPendingApproval && (item.created_by_email === user?.email || user?.role === 'super_admin');
                  return (
                    <tr key={item.id} style={{ opacity: isPendingApproval ? 0.75 : 1 }}>
                      <td className="td-mono">{item.sku}</td>
                      <td style={{ fontWeight: 500 }}>{item.name}</td>
                      <td className="text-muted">{item.category || '—'}</td>
                      <td className="td-right tabular" style={{ fontWeight: 600, color: isPendingApproval ? 'var(--text-muted)' : isLow ? 'var(--danger)' : 'inherit' }}>
                        {item.quantity.toLocaleString()} {item.unit}
                      </td>
                      <td className="td-right tabular">{fmt(item.unit_cost)}</td>
                      <td className="td-right tabular">{isPendingApproval ? '—' : fmt(item.quantity * item.unit_cost)}</td>
                      <td className="td-right tabular text-muted">{item.reorder_point} {item.unit}</td>
                      <td>{itemStatusBadge(item)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {canRecall && (
                            <button className="btn btn-ghost btn-sm" onClick={() => handleRecall(item)} title="Recall submission">
                              ↩ Recall
                            </button>
                          )}
                          {!isPendingApproval && can('manager') && (
                            <button className="btn btn-ghost btn-sm" onClick={() => openReplenish(item)} title="Replenish stock">📥 Restock</button>
                          )}
                          {!isPendingApproval && can('manager') && (
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)} title="Edit item">✏️</button>
                          )}
                          {!isPendingApproval && !item.pending_deletion && user?.role !== 'admin' && (
                            <button className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--danger)', borderColor: 'transparent' }}
                              title="Request deletion"
                              onClick={() => setDeletionModal(item)}>🗑</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editItem ? 'Edit Item' : 'Add Inventory Item'}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'} mb-16`}>{msg.text}</div>}
              <div className="grid-2 gap-16">
                <div className="form-group">
                  <label className="form-label">SKU / Item Code *</label>
                  <input className="form-input" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="e.g. ITEM-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Product name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Electronics, Clothing" />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <input className="form-input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="pcs, kg, box…" />
                </div>
                {!editItem && (
                  <div className="form-group">
                    <label className="form-label">Opening Quantity</label>
                    <input type="number" className="form-input" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} min="0" placeholder="0" />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Unit Cost</label>
                  <AmountInput
                    value={form.unit_cost}
                    onChange={val => setForm(f => ({ ...f, unit_cost: val }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Reorder Point</label>
                  <input type="number" className="form-input" value={form.reorder_point} onChange={e => setForm(f => ({ ...f, reorder_point: e.target.value }))} min="0" placeholder="10" />
                </div>
              </div>
              <div className="form-group mt-12">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes about this item…" rows={2} />
              </div>
              {!editItem && user?.role !== 'super_admin' && (
                <div className="form-group mt-12">
                  <label className="form-label">Note to Approver <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                  <textarea className="form-textarea" rows={2} value={form.submitter_note}
                    onChange={e => setForm(f => ({ ...f, submitter_note: e.target.value }))}
                    placeholder="Any context for the reviewer…" />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editItem ? 'Save Changes' : (user?.role === 'super_admin' ? 'Add Item' : 'Submit for Approval')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={loadItems} isSuperAdmin={user?.role === 'super_admin'} />}

      {/* Deletion Modal */}
      {deletionModal && (
        <DeletionModal
          item={deletionModal}
          onClose={() => setDeletionModal(null)}
          onDone={text => { setMsg({ type: 'success', text }); loadItems(); }}
        />
      )}

      {/* Replenish Modal */}
      {replenishItem && (
        <div className="modal-overlay" onClick={() => setReplenishItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Restock: {replenishItem.name}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setReplenishItem(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info mb-16">
                This will update the stock quantity and automatically create a journal entry (Dr. Inventory / Cr. {repForm.payment_method === 'credit' ? 'Accounts Payable' : 'Bank Account'}).
              </div>
              {msg && <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'} mb-16`}>{msg.text}</div>}
              <div className="grid-2 gap-16">
                <div className="form-group">
                  <label className="form-label">Quantity to Add *</label>
                  <input type="number" className="form-input" value={repForm.qty}
                    onChange={e => setRepForm(f => ({ ...f, qty: e.target.value }))} min="1" placeholder="Enter quantity" />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Cost</label>
                  <AmountInput
                    value={repForm.unit_cost}
                    onChange={val => setRepForm(f => ({ ...f, unit_cost: val }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select className="form-select" value={repForm.payment_method}
                    onChange={e => setRepForm(f => ({ ...f, payment_method: e.target.value }))}>
                    <option value="cash">Paid by Bank (Checking)</option>
                    <option value="credit">On Credit (Accounts Payable)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={repForm.date}
                    onChange={e => setRepForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Journal Entry Reference *</label>
                  <input type="text" className="form-input" value={repForm.reference} placeholder="e.g. JE-0005"
                    onChange={e => setRepForm(f => ({ ...f, reference: e.target.value }))} />
                </div>
              </div>
              <div className="form-group mt-12">
                <label className="form-label">Notes</label>
                <input type="text" className="form-input" value={repForm.notes} placeholder="Optional supplier, PO number…"
                  onChange={e => setRepForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="mt-12">
                <CurrencySelect
                  value={repForm.currency}
                  onChange={val => setRepForm(f => ({ ...f, currency: val, exchange_rate: val === baseCurrency ? '1' : f.exchange_rate }))}
                  rate={repForm.exchange_rate}
                  onRateChange={val => setRepForm(f => ({ ...f, exchange_rate: val }))}
                  label="Purchase Currency"
                />
              </div>
              {repForm.qty && repForm.unit_cost && (
                <div className="alert alert-info mt-12">
                  Total cost: <strong>{repForm.currency !== baseCurrency
                    ? `${repForm.currency} ${(parseFloat(repForm.qty) * parseFloat(repForm.unit_cost)).toLocaleString('en-US', { minimumFractionDigits: 2 })} (≈ ${fmt((parseFloat(repForm.qty) * parseFloat(repForm.unit_cost)) / (parseFloat(repForm.exchange_rate) || 1))})`
                    : fmt(parseFloat(repForm.qty) * parseFloat(repForm.unit_cost))
                  }</strong>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setReplenishItem(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleReplenish} disabled={saving}>{saving ? 'Saving…' : '📥 Restock'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
