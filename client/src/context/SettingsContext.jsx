import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext({});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    business_name: 'My Business',
    currency: 'PHP',
    currency_symbol: '₱',
  });

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => { if (data && data.business_name) setSettings(data); })
      .catch(() => {});
  }, []);

  const fmt = (amount) => {
    const sym = settings.currency_symbol || '$';
    const abs = Math.abs(amount || 0);
    return `${sym}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Returns true if the given module is enabled for this tenant.
  // Defaults to true when enabled_modules hasn't loaded yet (prevents flicker).
  const hasModule = (key) => {
    const mods = settings.enabled_modules;
    if (!mods || !Array.isArray(mods)) return true;
    return mods.includes(key);
  };

  return (
    <SettingsContext.Provider value={{ settings, setSettings, fmt, hasModule }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
