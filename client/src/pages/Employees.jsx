import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useUser }     from '../context/UserContext.jsx';

const EMP_TYPES  = { regular: 'Regular', probationary: 'Probationary', contractual: 'Contractual', part_time: 'Part-time' };
const PAY_FREQ   = { semi_monthly: 'Semi-monthly', monthly: 'Monthly' };
const TYPE_COLORS = {
  regular: '#15803d', probationary: '#d97706', contractual: '#2563eb', part_time: '#64748b',
};

const EMPTY = {
  employee_number: '', first_name: '', last_name: '', email: '', phone: '',
  position: '', department: '', employment_type: 'regular', pay_frequency: 'semi_monthly',
  basic_salary: '', sss_number: '', philhealth_number: '', pagibig_number: '',
  tin: '', bank_name: '', bank_account: '', hire_date: '', notes: '',
};

function EmployeeModal({ employee, onClose, onSaved }) {
  const [form, setForm] = useState(employee
    ? { ...employee, basic_salary: String(employee.basic_salary || '') }
    : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const isEdit = !!employee;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.employee_number || !form.first_name || !form.last_name)
      return setError('Employee number, first name, and last name are required.');
    if (!form.basic_salary || isNaN(parseFloat(form.basic_salary)))
      return setError('Basic salary must be a valid number.');

    setSaving(true); setError('');
    try {
      const res = await fetch(isEdit ? `/api/employees/${employee.id}` : '/api/employees', {
        method: isEdit ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, basic_salary: parseFloat(form.basic_salary) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onSaved(data);
    } catch { setError('Network error.'); }
    finally   { setSaving(false); }
  };

  const Field = ({ label, k, type = 'text', placeholder, half }) => (
    <div className="form-group" style={half ? { gridColumn: 'span 1' } : { gridColumn: 'span 2' }}>
      <label className="form-label">{label}</label>
      <input className="form-input" type={type} placeholder={placeholder}
        value={form[k]} onChange={e => set(k, e.target.value)} />
    </div>
  );

  const Select = ({ label, k, options, half }) => (
    <div className="form-group" style={half ? { gridColumn: 'span 1' } : { gridColumn: 'span 2' }}>
      <label className="form-label">{label}</label>
      <select className="form-input" value={form[k]} onChange={e => set(k, e.target.value)}>
        {Object.entries(options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Employee' : 'Add Employee'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {error && <div className="alert alert-error mb-12">⚠ {error}</div>}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Basic Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Field label="Employee Number *" k="employee_number" placeholder="EMP-001" half />
            <Field label="Hire Date" k="hire_date" type="date" half />
            <Field label="First Name *" k="first_name" placeholder="Juan" half />
            <Field label="Last Name *" k="last_name" placeholder="Dela Cruz" half />
            <Field label="Email" k="email" type="email" placeholder="juan@company.com" half />
            <Field label="Phone" k="phone" placeholder="+63 9XX XXX XXXX" half />
            <Field label="Position / Job Title" k="position" placeholder="Bookkeeper" half />
            <Field label="Department" k="department" placeholder="Finance" half />
            <Select label="Employment Type" k="employment_type" options={EMP_TYPES} half />
            <Select label="Pay Frequency" k="pay_frequency" options={PAY_FREQ} half />
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>Compensation</div>
          <div className="form-group">
            <label className="form-label">Basic Monthly Salary *</label>
            <input className="form-input" type="number" min="0" step="0.01"
              placeholder="0.00" value={form.basic_salary}
              onChange={e => set('basic_salary', e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Enter the full monthly rate. For semi-monthly pay, each payslip will use half of this amount.
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>Government Numbers</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Field label="SSS Number" k="sss_number" placeholder="00-0000000-0" half />
            <Field label="TIN" k="tin" placeholder="000-000-000-000" half />
            <Field label="PhilHealth Number" k="philhealth_number" placeholder="00-000000000-0" half />
            <Field label="Pag-IBIG (HDMF) Number" k="pagibig_number" placeholder="0000-0000-0000" half />
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>Bank Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Field label="Bank Name" k="bank_name" placeholder="BDO / BPI / GCash" half />
            <Field label="Account Number" k="bank_account" placeholder="0000-0000-00" half />
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={form.notes}
              onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Employee'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Employees() {
  const { settings } = useSettings();
  const { can }      = useUser();
  const sym = settings.currency_symbol || '₱';

  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null); // null | 'add' | employee object
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('active'); // 'active' | 'inactive' | 'all'
  const [error,     setError]     = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/employees', { credentials: 'include' });
      const data = await res.json();
      setEmployees(data);
    } catch { setError('Failed to load employees.'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSaved = (emp) => { setModal(null); load(); };

  const handleToggleActive = async (emp) => {
    try {
      await fetch(`/api/employees/${emp.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...emp, is_active: emp.is_active ? 0 : 1 }),
      });
      load();
    } catch { setError('Failed to update employee.'); }
  };

  const fmt = (v) => `${sym}${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const filtered = employees.filter(e => {
    const matchFilter = filter === 'all' || (filter === 'active' ? e.is_active : !e.is_active);
    const q = search.toLowerCase();
    const matchSearch = !q || `${e.first_name} ${e.last_name} ${e.employee_number} ${e.position || ''} ${e.department || ''}`.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const activeCount = employees.filter(e => e.is_active).length;

  return (
    <div>
      {error && <div className="alert alert-error mb-16">⚠ {error}</div>}

      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Active Employees', value: activeCount, color: '#15803d' },
          { label: 'Total Headcount',  value: employees.length, color: '#2563eb' },
          { label: 'Est. Monthly Payroll', value: fmt(employees.filter(e => e.is_active).reduce((s, e) => s + (parseFloat(e.basic_salary) || 0), 0)), color: '#7c3aed' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ flex: 1, minWidth: 160, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" style={{ flex: 1, minWidth: 200 }}
          placeholder="Search by name, number, position…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-input" style={{ width: 140 }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
          <option value="all">All Employees</option>
        </select>
        {can('finance') && (
          <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Employee</button>
        )}
      </div>

      {/* Table */}
      {loading ? <div className="page-loading">Loading employees…</div> : filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          {employees.length === 0 ? 'No employees yet. Add your first employee to get started.' : 'No employees match your search.'}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Position / Dept</th>
                  <th>Type</th>
                  <th>Pay Frequency</th>
                  <th style={{ textAlign: 'right' }}>Monthly Salary</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.first_name} {emp.last_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.employee_number}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{emp.position || '—'}</div>
                      {emp.department && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.department}</div>}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                        background: `${TYPE_COLORS[emp.employment_type]}18`,
                        color: TYPE_COLORS[emp.employment_type],
                      }}>
                        {EMP_TYPES[emp.employment_type] || emp.employment_type}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{PAY_FREQ[emp.pay_frequency] || emp.pay_frequency}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>{fmt(emp.basic_salary)}</td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                        background: emp.is_active ? '#d1fae5' : '#f1f5f9',
                        color: emp.is_active ? '#15803d' : '#64748b',
                      }}>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {can('finance') && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal(emp)}>Edit</button>
                        )}
                        {can('finance') && (
                          <button className="btn btn-ghost btn-sm"
                            style={{ color: emp.is_active ? 'var(--danger)' : 'var(--success)' }}
                            onClick={() => handleToggleActive(emp)}>
                            {emp.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <EmployeeModal
          employee={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
