import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider, useSettings } from './context/SettingsContext.jsx';
import { UserContext, makeUserContext } from './context/UserContext.jsx';
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
import Approvals from './pages/Approvals.jsx';
import Logs from './pages/Logs.jsx';
import Tax             from './pages/Tax.jsx';
import OpeningBalance  from './pages/OpeningBalance.jsx';
import Employees       from './pages/Employees.jsx';
import Payroll         from './pages/Payroll.jsx';
import Leaves          from './pages/Leaves.jsx';
import BIRForms        from './pages/BIRForms.jsx';
import ChartOfAccounts from './pages/ChartOfAccounts.jsx';
import Integrations        from './pages/Integrations.jsx';
import RecurringInvoices   from './pages/RecurringInvoices.jsx';
import HomePage      from './landing/HomePage.jsx';
import AboutPage     from './landing/AboutPage.jsx';
import FeaturesPage  from './landing/FeaturesPage.jsx';
import SubscribePage from './landing/SubscribePage.jsx';

const IS_LANDING =
  import.meta.env.VITE_LANDING_SITE === 'true' ||
  (typeof window !== 'undefined' &&
    ['cuentaiq.com', 'www.cuentaiq.com'].includes(window.location.hostname));

// Redirects to / if the required module is disabled for this tenant
function ModuleGuard({ moduleKey, element }) {
  const { hasModule } = useSettings();
  return hasModule(moduleKey) ? element : <Navigate to="/" replace />;
}

export default function App() {
  return IS_LANDING ? <LandingSite /> : <AccountingApp />;
}

// ── Public marketing site (cuentaiq.com) ──────────────────────────────────────
function LandingSite() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<HomePage />} />
        <Route path="/about-us"  element={<AboutPage />} />
        <Route path="/features"  element={<FeaturesPage />} />
        <Route path="/subscribe" element={<SubscribePage />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// ── Client accounting app (client.cuentaiq.com) ───────────────────────────────
function AccountingApp() {
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn]       = useState(false);
  const [user, setUser]               = useState(null);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.authenticated) { window.history.replaceState({}, '', '/'); setLoggedIn(true); setUser(data.user || null); }
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  if (!authChecked) return null;

  if (!loggedIn) {
    return <Login onLogin={(u) => { window.history.replaceState({}, '', '/'); setLoggedIn(true); setUser(u); }} />;
  }

  return (
    <UserContext.Provider value={makeUserContext(user)}>
    <SettingsProvider>
      <BrowserRouter>
        <Layout onLogout={() => { setLoggedIn(false); setUser(null); }}>
          <Routes>
            <Route path="/"                         element={<Dashboard />} />
            <Route path="/journal"                  element={<JournalEntries />} />
            <Route path="/inventory"                element={<ModuleGuard moduleKey="inventory" element={<Inventory />} />} />
            <Route path="/payments/incoming"        element={<ModuleGuard moduleKey="payments"  element={<Payments tab="incoming" />} />} />
            <Route path="/payments/pending"         element={<ModuleGuard moduleKey="payments"  element={<Payments tab="pending" />} />} />
            <Route path="/payments/schedule"        element={<ModuleGuard moduleKey="payments"  element={<PaymentSchedule />} />} />
            <Route path="/payments/recurring"       element={<ModuleGuard moduleKey="payments"  element={<RecurringInvoices />} />} />
            <Route path="/reports/balance-sheet"    element={<Reports type="balance-sheet" />} />
            <Route path="/reports/income-statement" element={<Reports type="income-statement" />} />
            <Route path="/reports/trial-balance"    element={<Reports type="trial-balance" />} />
            <Route path="/reports/ledger"           element={<Reports type="ledger" />} />
            <Route path="/fiscal"                   element={<FiscalYear />} />
            <Route path="/settings"                 element={<Settings />} />
            <Route path="/approvals"                element={<Approvals />} />
            <Route path="/logs"                     element={<Logs />} />
            <Route path="/tax/rates"                element={<ModuleGuard moduleKey="tax" element={<Tax tab="rates" />} />} />
            <Route path="/tax/applications"         element={<ModuleGuard moduleKey="tax" element={<Tax tab="applications" />} />} />
            <Route path="/tax/projections"          element={<ModuleGuard moduleKey="tax" element={<Tax tab="projections" />} />} />
            <Route path="/tax/filings"              element={<ModuleGuard moduleKey="tax" element={<Tax tab="filings" />} />} />
            <Route path="/opening-balance"          element={<OpeningBalance />} />
            <Route path="/hr/employees"             element={<ModuleGuard moduleKey="hr" element={<Employees />} />} />
            <Route path="/hr/payroll"               element={<ModuleGuard moduleKey="hr" element={<Payroll />} />} />
            <Route path="/hr/leaves"                element={<ModuleGuard moduleKey="hr" element={<Leaves />} />} />
            <Route path="/hr/bir"                   element={<ModuleGuard moduleKey="hr" element={<BIRForms />} />} />
            <Route path="/accounts"                 element={<ChartOfAccounts />} />
            <Route path="/integrations"             element={<Integrations />} />
            <Route path="*"                         element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </SettingsProvider>
    </UserContext.Provider>
  );
}
