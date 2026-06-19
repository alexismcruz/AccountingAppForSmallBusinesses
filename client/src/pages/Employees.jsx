import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useUser }     from '../context/UserContext.jsx';
import StatusPill      from '../components/StatusPill.jsx';
import { X }          from 'lucide-react';

const EMP_TYPES  = { regular: 'Regular', probationary: 'Probationary', contractual: 'Contractual', part_time: 'Part-time' };
const PAY_FREQ   = { semi_monthly: 'Semi-monthly', monthly: 'Monthly' };

const TYPE_PILL = {
  regular:      'pill pill-success',
  probationary: 'pill pill-warning',
  contractual:  'pill pill-primary',
  part_time:    'pill pill-neutral',
};

const EMPTY = {
  employee_number: '', first_name: '', last_name: '', email: '', phone: '',
  position: '', department: '', employment_type: 'regular', pay_frequency: 'semi_monthly',
  basic_salary: '', sss_number: '', philhealth_number: '', pagibig_number: '',
  tin: '', bank_name: '', bank_account: '', hire_date: '', notes: '',
};

function Field({ label, k, type = 'text', placeholder, half, form, onChange }) {
  return (
    <div className="form-group" style={half ? { gridColumn: 'span 1' } : { gridColumn: 'span 2' }}>
      <label className="form-label">{label}</label>
      <input className="form-input" type={type} placeholder={placeholder}
        value={form[k]} onChange={e => onChange(k, e.target.value)} />
    </div>
  );
}

function SelectField({ label, k, options, half, form, onChange }) {
  return (
    <div className="form-group" style={half ? { gridColumn: 'span 1' } : { gridColumn: 'span 2' }}>
      <label className="form-label">{label}</label>
      <select className="form-input" value={form[k]} onChange={e => onChange(k, e.target.value)}>
        {Object.entries(options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function EmployeeModal({ employee, onClose, onSaved }) {
  const [form,        setForm]        = useState(employee
    ? { ...employee, basic_salary: String(employee.basic_salary || '') }
    : { ...EMPTY });
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [leaveTypes,   setLeaveTypes]   = useState([]);
  const [entitlements, setEntitlements] = useState(null);
  const isEdit = !!employee;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch('/api/leaves/types', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const active = Array.isArray(data) ? data.filter(lt => lt.is_active) : [];
        setLeaveTypes(active);
        if (employee?.id) {
          fetch(`/api/leaves/entitlements/${employee.id}`, { credentials: 'include' })
            .then(r => r.json())
            .then(rows => {
              const map = new Map(
                Array.isArray(rows) ? rows.map(r => [r.leave_type_id, r.days_override ?? null]) : []
              );
              setEntitlements(map);
            });
        } else {
          setEntitlements(new Map(active.map(lt => [lt.id, null])));
        }
      })
      .catch(() => setEntitlements(new Map()));
  }, [employee?.id]);

  const toggleEntitlement = (ltId) => {
    setEntitlements(prev => {
      const next = new Map(prev);
      if (next.has(ltId)) next.delete(ltId);
      else next.set(ltId, null);
      return next;
    });
  };

  const setDaysOverride = (ltId, raw) => {
    setEntitlements(prev => {
      const next = new Map(prev);
      next.set(ltId, raw === '' ? null : raw);
      return next;
    });
  };

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
      if (entitlements !== null) {
        await fetch(`/api/leaves/entitlements/${data.id}`, {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entitlements: [...entitlements.entries()].map(([leave_type_id, days_override]) => ({
              leave_type_id,
              days_override: days_override !== null && days_override !== '' ? parseFloat(days_override) : null,
            })),
          }),
        });
      }
      onSaved(data);
    } catch { setError('Network error.'); }
    finally   { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Employee' : 'Add Employee'}</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {error && <div className="alert alert-error mb-12">{error}</div>}

          <div className="section-title">Basic Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Field label="Employee Number *" k="employee_number" placeholder="EMP-001" half form={form} onChange={set} />
            <Field label="Hire Date" k="hire_date" type="date" half form={form} onChange={set} />
            <Field label="First Name *" k="first_name" placeholder="Juan" half form={form} onChange={set} />
            <Field label="Last Name *" k="last_name" placeholder="Dela Cruz" half form={form} onChange={set} />
            <Field label="Email" k="email" type="email" placeholder="juan@company.com" half form={form} onChange={set} />
            <Field label="Phone" k="phone" placeholder="+63 9XX XXX XXXX" half form={form} onChange={set} />
            <Field label="Position / Job Title" k="position" placeholder="Bookkeeper" half form={form} onChange={set} />
            <Field label="Department" k="department" placeholder="Finance" half form={form} onChange={set} />
            <SelectField label="Employment Type" k="employment_type" options={EMP_TYPES} half form={form} onChange={set} />
            <SelectField label="Pay Frequency" k="pay_frequency" options={PAY_FREQ} half form={form} onChange={set} />
          </div>

          <div className="section-title mt-16">Compensation</div>
          <div className="form-group">
            <label className="form-label">Basic Monthly Salary *</label>
            <input className="form-input" type="number" min="0" step="0.01"
              placeholder="0.00" value={form.basic_salary}
              onChange={e => set('basic_salary', e.target.value)} />
            <div className="form-hint">
              Enter the full monthly rate. For semi-monthly pay, each payslip will use half of this amount.
            </div>
          </div>

          <div className="section-title mt-16">Government Numbers</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Field label="SSS Number" k="sss_number" placeholder="00-0000000-0" half form={form} onChange={set} />
            <Field label="TIN" k="tin" placeholder="000-000-000-000" half form={form} onChange={set} />
            <Field label="PhilHealth Number" k="philhealth_number" placeholder="00-000000000-0" half form={form} onChange={set} />
            <Field label="Pag-IBIG (HDMF) Number" k="pagibig_number" placeholder="0000-0000-0000" half form={form} onChange={set} />
          </div>

          <div className="section-title mt-16">Bank Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Field label="Bank Name" k="bank_name" placeholder="BDO / BPI / GCash" half form={form} onChange={set} />
            <Field label="Account Number" k="bank_account" placeholder="0000-0000-00" half form={form} onChange={set} />
          </div>

          <div className="form-group mt-12">
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={form.notes}
              onChange={e => set('notes', e.target.value)} />
          </div>

          {leaveTypes.length > 0 && (
            <>
              <div className="section-title mt-16">Leave Entitlements</div>
              <div className="form-hint mb-8">
                Check the leave types this employee is entitled to. Leave the days blank to use the default for that leave type, or enter a custom amount for pro-rated entitlements.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {leaveTypes.map(lt => {
                  const checked  = entitlements?.has(lt.id) ?? false;
                  const override = entitlements?.get(lt.id);
                  return (
                    <div key={lt.id} style={{
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
                      background: checked ? 'var(--color-primary-light)' : 'transparent',
                      padding: '8px 12px',
                    }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleEntitlement(lt.id)} />
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{lt.code}</span>
                          <span style={{ color: 'var(--color-ink-mid)', marginLeft: 6, fontSize: 13 }}>{lt.name}</span>
                        </div>
                      </label>
                      {checked && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 24 }}>
                          <input
                            type="number" min="0" step="0.5"
                            className="form-input"
                            style={{ width: 80, padding: '4px 8px', fontSize: 12 }}
                            placeholder={String(lt.days_per_year)}
                            value={override ?? ''}
                            onChange={e => setDaysOverride(lt.id, e.target.value)}
                          />
                          <span style={{ fontSize: 12, color: 'var(--color-ink-mid)' }}>
                            days
                            {override == null || override === ''
                              ? <span style={{ marginLeft: 4, color: 'var(--success)' }}>— using default ({lt.days_per_year})</span>
                              : <span style={{ marginLeft: 4, color: 'var(--warning)' }}>— custom (default is {lt.days_per_year})</span>
                            }
                          </span>
                        </div>
                      )}
                      {!checked && (
                        <div style={{ fontSize: 11, color: 'var(--color-ink-light)', paddingLeft: 24, marginTop: 2 }}>
                          Not entitled · {lt.days_per_year} days/yr default
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
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
  const [modal,     setModal]     = useState(null);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('active');
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

  const handleSaved = () => { setModal(null); load(); };

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
      {error && <div className="alert alert-error mb-16">{error}</div>}

      {/* Summary */}
      <div className="grid-3 mb-20">
        {[
          { label: 'Active Employees',     value: activeCount,       color: 'var(--success)' },
          { label: 'Total Headcount',      value: employees.length,  color: 'var(--color-primary)' },
          { label: 'Est. Monthly Payroll', value: fmt(employees.filter(e => e.is_active).reduce((s, e) => s + (parseFloat(e.basic_salary) || 0), 0)), color: 'var(--color-accent)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
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
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-ink-mid)' }}>
          {employees.length === 0 ? 'No employees yet. Add your first employee to get started.' : 'No employees match your search.'}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
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
                      <div style={{ fontSize: 11, color: 'var(--color-ink-mid)' }}>{emp.employee_number}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{emp.position || '—'}</div>
                      {emp.department && <div style={{ fontSize: 11, color: 'var(--color-ink-mid)' }}>{emp.department}</div>}
                    </td>
                    <td>
                      <span className={TYPE_PILL[emp.employment_type] || 'pill pill-neutral'}>
                        {EMP_TYPES[emp.employment_type] || emp.employment_type}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{PAY_FREQ[emp.pay_frequency] || emp.pay_frequency}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>{fmt(emp.basic_salary)}</td>
                    <td><StatusPill status={emp.is_active ? 'active' : 'inactive'} /></td>
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
