import Tooltip from './Tooltip.jsx';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense'];

const TYPE_COLORS = {
  Asset: '#15803d', Liability: '#b91c1c', Equity: '#7c3aed',
  Revenue: '#0369a1', COGS: '#b45309', Expense: '#b45309',
};

export default function AccountSelect({ value, onChange, accounts, style }) {
  const selected = accounts.find(a => String(a.id) === String(value));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      <select
        className="form-select"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1 }}
      >
        <option value="">— Select Account —</option>
        {ACCOUNT_TYPES.map(type => {
          const group = accounts.filter(a => a.type === type);
          if (!group.length) return null;
          return (
            <optgroup label={type} key={type}>
              {group.map(a => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>

      {selected ? (
        <Tooltip maxWidth={320} content={
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{selected.code} — {selected.name}</div>
            <div style={{ marginBottom: 6 }}>
              <span style={{
                display: 'inline-block', padding: '1px 7px', borderRadius: 100,
                background: 'rgba(255,255,255,0.12)', fontSize: 11, marginRight: 6,
              }}>
                {selected.type}
              </span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                Normal balance: <strong style={{ color: selected.normal_balance === 'Debit' ? '#7dd3fc' : '#86efac' }}>
                  {selected.normal_balance}
                </strong>
              </span>
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 12 }}>{selected.description}</div>
          </div>
        }>
          <span style={{
            cursor: 'help',
            color: TYPE_COLORS[selected.type] || '#64748b',
            fontSize: 16,
            lineHeight: 1,
            userSelect: 'none',
          }}>ⓘ</span>
        </Tooltip>
      ) : (
        <span style={{ width: 22, flexShrink: 0 }} />
      )}
    </div>
  );
}
