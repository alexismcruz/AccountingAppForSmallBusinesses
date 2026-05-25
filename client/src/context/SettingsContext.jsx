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

  return (
    <SettingsContext.Provider value={{ settings, setSettings, fmt }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
