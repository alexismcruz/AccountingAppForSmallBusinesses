import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import AmountInput from '../components/AmountInput.jsx';

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function PayModal({ item, onClose, onSaved }) {
  const { fmt } = useSettings();
  const isIncoming = item.direction === 'incoming';
  const remaining = item.balance;
  const [form, setForm] = useState({
    amount: remaining.toFixed(2),
    date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
  });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const handlePay = async () => {
    if (!form.reference) { setMsg('Please enter a journal entry reference number.'); return; }
    setSaving(true); setMsg(null);
    const endpoint = isIncoming
      ? `/api/payments/receivables/${item.id}/pay`
      : `/api/payments/payables/${item.id}/pay`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error); return; }
      onSaved(); onClose();
    } catch { setMsg('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Record Payment</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-info mb-16">
            {isIncoming
              ? `Recording payment FROM ${item.party_name} — will Dr. Bank / Cr. Accounts Receivable.`
              : `Recording payment TO ${item.party_name} — will Dr. Accounts Payable / Cr. Bank.`}
          </div>
          {msg && <div className="alert alert-error mb-16">{msg}</div>}
          <div className="grid-2 gap-16">
            <div className="form-group">
              <label className="form-label">Amount to Record</label>
              <AmountInput
                value={form.amount}
                onChange={val => setForm(f => ({ ...f, amount: val }))}
                placeholder="0.00"
              />
              <div className="text-muted text-sm mt-8">Balance: {fmt(remaining)}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Date</label>
              <input type="date" className="form-input" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Journal Entry Reference *</label>
              <input className="form-input" value={form.reference} placeholder="e.g. JE-0010"
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Notes</label>
              <input className="form-input" value={form.notes} placeholder="Optional notes…"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" onClick={handlePay} disabled={saving}>
            {saving ? 'Saving…' : '✓ Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSchedule() {
  const { fmt, settings } = useSettings();
  const baseCurrency = settings.currency || 'USD';
  const [schedule, setSchedule] = useState([]);
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState(null); // "incoming-5" or "outgoing-3"
  const [editDate, setEditDate] = useState('');
  const [payItem, setPayItem] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'incoming' | 'outgoing'
  const [error, setError] = useState('');

  const loadSchedule = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await fetch('/api/payments/schedule').then(r => r.json());
      setSchedule(data.schedule || []);
      setToday(data.today || new Date().toISOString().split('T')[0]);
    } catch {
      setError('Failed to load payment schedule. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  const handleScheduleUpdate = async (id, direction) => {
    const endpoint = direction === 'incoming'
      ? `/api/payments/receivables/${id}/schedule`
      : `/api/payments/payables/${id}/schedule`;
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_date: editDate || null }),
      });
      if (!res.ok) { setError('Failed to update scheduled date.'); return; }
      setEditingKey(null);
      loadSchedule();
    } catch {
      setError('Network error. Failed to update scheduled date.');
    }
  };

  const visible = filter === 'all' ? schedule : schedule.filter(i => i.direction === filter);

  // Summary totals (all, not filtered)
  const totalIn  = schedule.filter(i => i.direction === 'incoming').reduce((s, i) => s + i.balance, 0);
  const totalOut = schedule.filter(i => i.direction === 'outgoing').reduce((s, i) => s + i.balance, 0);
  const overdueIn  = schedule.filter(i => i.direction === 'incoming' && i.effective_date && i.effective_date < today).reduce((s, i) => s + i.balance, 0);
  const overdueOut = schedule.filter(i => i.direction === 'outgoing' && i.effective_date && i.effective_date < today).reduce((s, i) => s + i.balance, 0);

  // Group items
  const groups = { overdue: [], today_: [], week: [], month: [], later: [], none: [] };
  for (const item of visible) {
    if (!item.effective_date) {
      groups.none.push(item);
    } else if (item.effective_date < today) {
      groups.overdue.push(item);
    } else if (item.effective_date === today) {
      groups.today_.push(item);
    } else if (item.effective_date <= addDays(today, 7)) {
      groups.week.push(item);
    } else if (item.effective_date <= addDays(today, 30)) {
      groups.month.push(item);
    } else {
      groups.later.push(item);
    }
  }

  const ScheduleItem = ({ item }) => {
    const isIncoming = item.direction === 'incoming';
    const key = `${item.direction}-${item.id}`;
    const isEditing = editingKey === key;
    const isOverdue = item.effective_date && item.effective_date < today;

    return (
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12,
        padding: '14px 18px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${isIncoming ? '#0369a1' : '#dc2626'}`,
        borderRadius: 'var(--radius-sm)',
      }}>
        {/* Direction icon */}
        <div style={{ fontSize: 22, flexShrink: 0 }}>{isIncoming ? '📥' : '📤'}</div>

        {/* Party + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{item.party_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.ref_number && <span style={{ marginRight: 6, fontFamily: 'monospace' }}>{item.ref_number}</span>}
            {item.description || (isIncoming ? 'Incoming payment' : 'Outgoing payment')}
          </div>
          <div style={{ marginTop: 4 }}>
            <span className={`badge ${item.status === 'partial' ? 'badge-blue' : 'badge-warning'}`} style={{ fontSize: 10 }}>
              {item.status === 'partial' ? 'Partial' : 'Pending'}
            </span>
            {item.currency && item.currency !== baseCurrency && (
              <span className="badge badge-info" style={{ fontSize: 10, marginLeft: 4 }}>{item.currency}</span>
            )}
          </div>
        </div>

        {/* Amount */}
        <div style={{ textAlign: 'right', minWidth: 110, flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: isIncoming ? '#0369a1' : '#dc2626' }}>
            {isIncoming ? '+' : '−'}{fmt(item.balance)}
          </div>
          {item.amount !== item.balance && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              of {fmt(item.amount)} total
            </div>
          )}
        </div>

        {/* Date — click to edit */}
        <div style={{ minWidth: 140, flexShrink: 0 }}>
          {isEditing ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="date" className="form-input" style={{ fontSize: 12, padding: '4px 8px', width: 135 }}
                value={editDate} onChange={e => setEditDate(e.target.value)} />
              <button className="btn btn-success btn-sm" style={{ padding: '4px 8px' }}
                onClick={() => handleScheduleUpdate(item.id, item.direction)}>✓</button>
              <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}
                onClick={() => setEditingKey(null)}>✕</button>
            </div>
          ) : (
            <div
              style={{ cursor: 'pointer', padding: '6px 8px', borderRadius: 'var(--radius-sm)', transition: 'background 0.15s' }}
              title="Click to set or change scheduled date"
              onClick={() => {
                setEditingKey(key);
                setEditDate(item.scheduled_date || item.due_date || '');
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {item.scheduled_date ? '📅 Scheduled' : item.due_date ? '📋 Due date' : '+ Set date'}
              </div>
              {item.effective_date ? (
                <div style={{ fontWeight: 600, fontSize: 13, color: isOverdue ? 'var(--danger)' : 'inherit', marginTop: 2 }}>
                  {isOverdue && '⚠ '}{formatDate(item.effective_date)}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>No date set</div>
              )}
              {item.scheduled_date && item.due_date && item.scheduled_date !== item.due_date && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Due: {formatDate(item.due_date)}</div>
              )}
            </div>
          )}
        </div>

        {/* Pay button */}
        <div style={{ flexShrink: 0 }}>
          <button className="btn btn-success btn-sm" onClick={() => setPayItem(item)}>
            ✓ Pay
          </button>
        </div>
      </div>
    );
  };

  const GroupSection = ({ title, items, color, emptyHide }) => {
    if (items.length === 0) return emptyHide ? null : null;
    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
            {title}
          </div>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {items.length} item{items.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(item => <ScheduleItem key={`${item.direction}-${item.id}`} item={item} />)}
        </div>
      </div>
    );
  };

  const hasAny = visible.length > 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Payment Schedule</div>
          <div className="page-subtitle">Upcoming payments to receive and to pay out</div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid-3 mb-20" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #0369a1' }}>
          <div className="stat-label">Total to Receive</div>
          <div className="stat-value" style={{ color: '#0369a1' }}>{fmt(totalIn)}</div>
          <div className="stat-sub">
            {schedule.filter(i => i.direction === 'incoming').length} pending invoice{schedule.filter(i => i.direction === 'incoming').length !== 1 ? 's' : ''}
            {overdueIn > 0 && <span style={{ color: 'var(--danger)', marginLeft: 6 }}>· {fmt(overdueIn)} overdue</span>}
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="stat-label">Total to Pay Out</div>
          <div className="stat-value" style={{ color: '#dc2626' }}>{fmt(totalOut)}</div>
          <div className="stat-sub">
            {schedule.filter(i => i.direction === 'outgoing').length} pending bill{schedule.filter(i => i.direction === 'outgoing').length !== 1 ? 's' : ''}
            {overdueOut > 0 && <span style={{ color: 'var(--danger)', marginLeft: 6 }}>· {fmt(overdueOut)} overdue</span>}
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: `4px solid ${totalIn - totalOut >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
          <div className="stat-label">Net Cash Position</div>
          <div className="stat-value" style={{ color: totalIn - totalOut >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {totalIn - totalOut >= 0 ? '+' : ''}{fmt(totalIn - totalOut)}
          </div>
          <div className="stat-sub">Incoming minus outgoing</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="card mb-16" style={{ padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>Show:</span>
        {[['all', 'All Payments'], ['incoming', '📥 Incoming Only'], ['outgoing', '📤 Outgoing Only']].map(([val, label]) => (
          <button key={val}
            className={`btn btn-sm ${filter === val ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(val)}>
            {label}
          </button>
        ))}
        <div className="schedule-hint">
          Click any date to reschedule · Click <strong>✓ Pay</strong> to record payment
        </div>
      </div>

      {error && <div className="alert alert-error mb-16">⚠ {error}</div>}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading schedule…</div>
      ) : !hasAny ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <p>No pending payments found. Add invoices in <strong>Incoming Payments</strong> or bills in <strong>Pending Payments</strong>.</p>
          </div>
        </div>
      ) : (
        <div>
          <GroupSection title="Overdue" items={groups.overdue} color="var(--danger)" />
          <GroupSection title="Today" items={groups.today_} color="var(--warning)" />
          <GroupSection title="This Week" items={groups.week} color="#0369a1" />
          <GroupSection title="Next 30 Days" items={groups.month} color="var(--success)" />
          <GroupSection title="Later" items={groups.later} color="var(--text-muted)" />
          <GroupSection title="No Date Set" items={groups.none} color="var(--text-light)" />
        </div>
      )}

      {payItem && (
        <PayModal
          item={payItem}
          onClose={() => setPayItem(null)}
          onSaved={loadSchedule}
        />
      )}
    </div>
  );
}
