import { useState } from 'react';
import { CURRENCIES } from '../data/currencies.js';
import { useSettings } from '../context/SettingsContext.jsx';

export default function CurrencySelect({ value, onChange, rate, onRateChange, label = 'Currency' }) {
  const { settings } = useSettings();
  const baseCurrency = settings.currency || 'USD';
  const isForeign = value && value !== baseCurrency;
  const [fetching, setFetching] = useState(false);
  const [rateInfo, setRateInfo] = useState(null); // { date, source } or { error }

  const fetchLiveRate = async () => {
    setFetching(true);
    setRateInfo(null);
    try {
      const res = await fetch(`/api/exchange-rate?from=${encodeURIComponent(baseCurrency)}&to=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setRateInfo({ error: data.error || 'Could not fetch rate.' });
      } else {
        onRateChange(String(data.rate));
        setRateInfo({ date: data.date, source: data.source });
      }
    } catch {
      setRateInfo({ error: 'Network error. Please enter rate manually.' });
    } finally {
      setFetching(false);
    }
  };

  const handleCurrencyChange = (newCurrency) => {
    setRateInfo(null);
    onChange(newCurrency);
    if (newCurrency === baseCurrency) {
      onRateChange('1');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {/* Currency selector */}
        <div className="form-group" style={{ minWidth: 220, marginBottom: 0 }}>
          <label className="form-label">{label}</label>
          <select className="form-select" value={value || baseCurrency} onChange={e => handleCurrencyChange(e.target.value)}>
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Exchange rate — only shown for foreign currencies */}
        {isForeign && (
          <div className="form-group" style={{ minWidth: 200, marginBottom: 0 }}>
            <label className="form-label">
              Exchange Rate
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>
                1 {baseCurrency} =
              </span>
            </label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="number"
                className="form-input"
                value={rate || ''}
                min="0.000001"
                step="0.0001"
                placeholder="e.g. 56.50"
                style={{ flex: 1 }}
                onChange={e => { setRateInfo(null); onRateChange(e.target.value); }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{value}</span>
            </div>
          </div>
        )}

        {/* Fetch live rate button */}
        {isForeign && (
          <div style={{ marginBottom: 0, paddingBottom: 1 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={fetchLiveRate}
              disabled={fetching}
              title="Fetch today's live exchange rate"
              style={{ whiteSpace: 'nowrap', height: 38 }}
            >
              {fetching ? '⏳ Fetching…' : '🔄 Live Rate'}
            </button>
          </div>
        )}
      </div>

      {/* Rate info / error feedback */}
      {isForeign && rateInfo && (
        <div style={{ marginTop: 6, fontSize: 12 }}>
          {rateInfo.error ? (
            <span style={{ color: 'var(--danger)' }}>⚠ {rateInfo.error}</span>
          ) : (
            <span style={{ color: 'var(--success)' }}>
              ✓ Rate updated · as of {rateInfo.date} · {rateInfo.source}
            </span>
          )}
        </div>
      )}

      {/* Context hint */}
      {isForeign && !rateInfo && rate && parseFloat(rate) > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          Amounts will be converted to {baseCurrency} for reports. Click <strong>Live Rate</strong> to auto-fill today's rate.
        </div>
      )}
    </div>
  );
}
