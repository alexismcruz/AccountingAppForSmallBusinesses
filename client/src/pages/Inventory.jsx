import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useUser } from '../context/UserContext.jsx';
import CurrencySelect from '../components/CurrencySelect.jsx';
import AmountInput from '../components/AmountInput.jsx';

const emptyForm = { sku: '', name: '', category: '', unit: 'pcs', quantity: '', unit_cost: '', reorder_point: '10', notes: '' };
const makeEmptyReplenish = (baseCurrency) => ({ qty: '', unit_cost: '', payment_method: 'cash', notes: '', date: new Date().toISOString().split('T')[0], reference: '', currency: baseCurrency, exchange_rate: '1' });

export default function Inventory() {
  const { fmt, settings } = useSettings();
  const { can } = useUser();
  const baseCurrency = settings.currency || 'USD';
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [replenishItem, setReplenishItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [repForm, setRepForm] = useState(makeEmptyReplenish(baseCurrency));
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadItems(); }, []);

  const loadItems = () => {
    fetch('/api/inventory').then(r => r.json()).then(setItems).catch(() => {});
  };

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.sku.toLowerCase().includes(search.toLowerCase()) ||
    (i.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
  const lowStockCount = items.filter(i => i.quantity <= i.reorder_point).length;

  const openAdd = () => { setEditItem(null); setForm(emptyForm); setShowModal(true); setMsg(null); };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({ sku: item.sku, name: item.name, category: item.category || '', unit: item.unit, quantity: item.quantity, unit_cost: item.unit_cost, reorder_point: item.reorder_point, notes: item.notes || '' });
    setShowModal(true); setMsg(null);
  };
  const openReplenish = (item) => {
    setReplenishItem(item);
    setRepForm({ ...makeEmptyReplenish(baseCurrency), unit_cost: item.unit_cost, date: new Date().toISOString().split('T')[0] });
    setMsg(null);
  };

  const handleSave = async () => {
    if (!form.sku || !form.name) { setMsg({ type: 'error', text: 'SKU and name are required.' }); return; }
    setSaving(true);
    setMsg(null);
    try {
      const url = editItem ? `/api/inventory/${editItem.id}` : '/api/inventory';
      const method = editItem ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.error }); return; }
      setShowModal(false); loadItems();
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

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this item from inventory?')) return;
    await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
    loadItems();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Inventory</div>
          <div className="page-subtitle">Track your stock and reorder levels</div>
        </div>
        {can('manager') && <button className="btn btn-primary" onClick={openAdd}>+ Add Item</button>}
      </div>

      {/* Stats */}
      <div className="grid-3 mb-20">
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-label">Total Items</div>
          <div className="stat-value">{items.length}</div>
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
                  const isLow = item.quantity <= item.reorder_point;
                  return (
                    <tr key={item.id}>
                      <td className="td-mono">{item.sku}</td>
                      <td style={{ fontWeight: 500 }}>{item.name}</td>
                      <td className="text-muted">{item.category || '—'}</td>
                      <td className="td-right tabular" style={{ fontWeight: 600, color: isLow ? 'var(--danger)' : 'inherit' }}>
                        {item.quantity.toLocaleString()} {item.unit}
                      </td>
                      <td className="td-right tabular">{fmt(item.unit_cost)}</td>
                      <td className="td-right tabular">{fmt(item.quantity * item.unit_cost)}</td>
                      <td className="td-right tabular text-muted">{item.reorder_point} {item.unit}</td>
                      <td>
                        {item.quantity === 0
                          ? <span className="badge badge-danger">Out of Stock</span>
                          : isLow
                            ? <span className="badge badge-warning">Low Stock</span>
                            : <span className="badge badge-success">In Stock</span>
                        }
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {can('manager') && <button className="btn btn-ghost btn-sm" onClick={() => openReplenish(item)} title="Replenish stock">📥 Restock</button>}
                          {can('manager') && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)} title="Edit item">✏️</button>}
                          {can('admin') && (
                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(item.id)} title="Remove item"
                              style={{ color: 'var(--danger)', borderColor: 'transparent' }}>🗑</button>
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
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Item'}</button>
            </div>
          </div>
        </div>
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
