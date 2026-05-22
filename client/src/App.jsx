import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import JournalEntries from './pages/JournalEntries.jsx';
import Inventory from './pages/Inventory.jsx';
import Payments from './pages/Payments.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import FiscalYear from './pages/FiscalYear.jsx';
import PaymentSchedule from './pages/PaymentSchedule.jsx';

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => {
        setLoggedIn(r.ok);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  // Blank screen while checking session — avoids flash of login page
  if (!authChecked) return null;

  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <SettingsProvider>
      <BrowserRouter>
        <Layout onLogout={() => setLoggedIn(false)}>
          <Routes>
            <Route path="/"                         element={<Dashboard />} />
            <Route path="/journal"                  element={<JournalEntries />} />
            <Route path="/inventory"                element={<Inventory />} />
            <Route path="/payments/incoming"        element={<Payments tab="incoming" />} />
            <Route path="/payments/pending"         element={<Payments tab="pending" />} />
            <Route path="/payments/schedule"        element={<PaymentSchedule />} />
            <Route path="/reports/balance-sheet"    element={<Reports type="balance-sheet" />} />
            <Route path="/reports/income-statement" element={<Reports type="income-statement" />} />
            <Route path="/reports/trial-balance"    element={<Reports type="trial-balance" />} />
            <Route path="/reports/ledger"           element={<Reports type="ledger" />} />
            <Route path="/fiscal"                   element={<FiscalYear />} />
            <Route path="/settings"                 element={<Settings />} />
            <Route path="*"                         element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </SettingsProvider>
  );
}
