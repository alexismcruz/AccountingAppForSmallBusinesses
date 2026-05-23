import { useState, useEffect, useCallback } from 'react';

const TYPE_LABELS = {
  create_entry:       '📝 New Journal Entry',
  delete_entry:       '🗑 Delete Journal Entry',
  create_receivable:  '📥 New Invoice (AR)',
  delete_receivable:  '🗑 Delete Receivable (AR)',
  create_payable:     '📤 New Bill (AP)',
  delete_payable:     '🗑 Delete Payable (AP)',
  create_inventory:   '📦 New Inventory Item',
  delete_inventory:   '🗑 Delete Inventory Item',
};

const ROLE_LABELS = {
  staff: 'Staff', manager: 'Manager', finance: 'Finance / Accounting',
  admin: 'Admin', super_admin: 'Super Admin',
};

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str + (str.includes('T') ? '' : 'Z')).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// ── Review modal ──────────────────────────────────────────────────────────────
function ReviewModal({ request, onClose, onDone }) {
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const snapshot = (() => {
    try { return request.entity_snapshot ? JSON.parse(request.entity_snapshot) : null; }
    catch { return null; }
  })();

  const act = async (action) => {
    if (!note.trim()) { setError(`Please enter a ${action === 'approve' ? 'approval' : 'rejection'} note first.`); return; }
    setSaving(true); setError('');
    try {
      const res  = await fetch(`/api/approvals/${request.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onDone();
      onClose();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{TYPE_LABELS[request.type] || request.type}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Request details */}
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: 13 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Reference:</span> <strong>{request.entity_ref || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Submitted:</span> {fmtDate(request.created_at)}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Submitted by:</span> {request.submitted_by_name || request.submitted_by_email}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Role:</span> {ROLE_LABELS[request.submitted_by_role] || request.submitted_by_role}</div>
              <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--text-muted)' }}>Email:</span> {request.submitted_by_email}</div>
            </div>
            {request.submitter_note && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'white', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block', marginBottom: 4 }}>SUBMITTER NOTE</span>
                {request.submitter_note}
              </div>
            )}
          </div>

          {/* Snapshot for create requests */}
          {snapshot && (request.type === 'create_receivable' || request.type === 'create_payable') && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 8 }}>📋 Record to be created</div>
              {snapshot.customer_name && <div><strong>Customer:</strong> {snapshot.customer_name}</div>}
              {snapshot.supplier_name && <div><strong>Supplier:</strong> {snapshot.supplier_name}</div>}
              {snapshot.invoice_number && <div><strong>Invoice #:</strong> {snapshot.invoice_number}</div>}
              {snapshot.reference_number && <div><strong>Reference #:</strong> {snapshot.reference_number}</div>}
              {snapshot.description && <div><strong>Description:</strong> {snapshot.description}</div>}
              {snapshot.amount != null && <div><strong>Amount:</strong> {parseFloat(snapshot.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {snapshot.currency || ''}</div>}
              {snapshot.due_date && <div><strong>Due Date:</strong> {snapshot.due_date}</div>}
            </div>
          )}
          {snapshot && request.type === 'create_inventory' && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 8 }}>📋 Item to be added</div>
              {snapshot.sku && <div><strong>SKU:</strong> {snapshot.sku}</div>}
              {snapshot.name && <div><strong>Name:</strong> {snapshot.name}</div>}
              {snapshot.category && <div><strong>Category:</strong> {snapshot.category}</div>}
              {snapshot.unit && <div><strong>Unit:</strong> {snapshot.unit}</div>}
              {snapshot.quantity != null && <div><strong>Opening Qty:</strong> {snapshot.quantity}</div>}
              {snapshot.unit_cost != null && <div><strong>Unit Cost:</strong> {parseFloat(snapshot.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>}
            </div>
          )}
          {/* Snapshot for delete requests */}
          {snapshot && (request.type === 'delete_entry' || request.type === 'delete_receivable' || request.type === 'delete_payable' || request.type === 'delete_inventory') && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>⚠ Record to be deleted</div>
              {snapshot.description && <div><strong>Description:</strong> {snapshot.description}</div>}
              {snapshot.customer_name && <div><strong>Customer:</strong> {snapshot.customer_name}</div>}
              {snapshot.supplier_name && <div><strong>Supplier:</strong> {snapshot.supplier_name}</div>}
              {snapshot.name && <div><strong>Item:</strong> {snapshot.name}</div>}
              {snapshot.sku && <div><strong>SKU:</strong> {snapshot.sku}</div>}
              {snapshot.amount != null && <div><strong>Amount:</strong> {parseFloat(snapshot.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>}
              {snapshot.date && <div><strong>Date:</strong> {snapshot.date}</div>}
            </div>
          )}

          {/* Already reviewed */}
          {request.status !== 'pending' && (
            <div className={`alert ${request.status === 'approved' ? 'alert-success' : 'alert-error'} mb-16`}>
              {request.status === 'approved' ? '✓ Approved' : '✕ Rejected'} by {request.reviewed_by_name || request.reviewed_by_email} on {fmtDate(request.reviewed_at)}
              {request.reviewer_note && <div style={{ marginTop: 4, fontSize: 12 }}>Note: {request.reviewer_note}</div>}
            </div>
          )}

          {/* Action area — only show for pending + eligible approver */}
          {request.status === 'pending' && request.can_approve && (
            <>
              {error && <div className="alert alert-error mb-12">⚠ {error}</div>}
              <div className="form-group">
                <label className="form-label">Note * <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(required before approving or rejecting)</span></label>
                <textarea className="form-textarea" rows={3} value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add your review notes here…" />
              </div>
            </>
          )}

          {/* Read-only note for non-approvers on pending requests */}
          {request.status === 'pending' && !request.can_approve && (
            <div className="alert alert-info">
              This request is pending approval. You do not have permission to approve or reject it based on your role.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            {request.status === 'pending' && request.can_approve ? 'Cancel' : 'Close'}
          </button>
          {request.status === 'pending' && request.can_approve && (
            <>
              <button className="btn btn-danger" onClick={() => act('reject')} disabled={saving || !note.trim()}>
                {saving ? 'Saving…' : '✕ Reject'}
              </button>
              <button className="btn btn-success" onClick={() => act('approve')} disabled={saving || !note.trim()}>
                {saving ? 'Saving…' : '✓ Approve'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Approvals page ───────────────────────────────────────────────────────
export default function Approvals() {
  const [tab,      setTab]      = useState('pending');
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/approvals?status=${tab}`).then(r => r.json());
    setRequests(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const statusBadge = (r) => {
    if (r.status === 'approved') return <span className="badge badge-success">Approved</span>;
    if (r.status === 'rejected') return <span className="badge badge-danger">Rejected</span>;
    if (r.can_approve)           return <span className="badge badge-warning">Action Required</span>;
    return <span className="badge badge-info">Pending</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Approvals</div>
          <div className="page-subtitle">Review and approve submitted requests</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card mb-16" style={{ padding: '10px 16px', display: 'flex', gap: 8 }}>
        {[['pending','⏳ Pending'],['approved','✓ Approved'],['rejected','✕ Rejected'],['all','All']].map(([val, label]) => (
          <button key={val}
            className={`btn btn-sm ${tab === val ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(val)}>
            {label}
            {val === 'pending' && requests.filter(r => r.can_approve).length > 0 && tab !== 'pending' &&
              <span style={{ marginLeft: 6, background: 'var(--danger)', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
                {requests.filter(r => r.can_approve).length}
              </span>
            }
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading…</div>
      ) : requests.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <p>{tab === 'pending' ? 'No pending requests.' : 'No records found.'}</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Submitted By</th>
                  <th>Submitted At</th>
                  {tab !== 'pending' && <th>Reviewed By</th>}
                  {tab !== 'pending' && <th>Reviewed At</th>}
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(r)}>
                    <td style={{ fontSize: 13 }}>{TYPE_LABELS[r.type] || r.type}</td>
                    <td><span className="td-mono">{r.entity_ref || '—'}</span></td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.submitted_by_name || r.submitted_by_email}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ROLE_LABELS[r.submitted_by_role]}</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(r.created_at)}</td>
                    {tab !== 'pending' && <td style={{ fontSize: 12 }}>{r.reviewed_by_name || r.reviewed_by_email || '—'}</td>}
                    {tab !== 'pending' && <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(r.reviewed_at)}</td>}
                    <td>{statusBadge(r)}</td>
                    <td>
                      <button className={`btn btn-sm ${r.can_approve ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={e => { e.stopPropagation(); setSelected(r); }}>
                        {r.can_approve ? 'Review' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <ReviewModal
          request={selected}
          onClose={() => setSelected(null)}
          onDone={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
