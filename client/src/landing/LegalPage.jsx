import LandingLayout from './LandingLayout.jsx';

const DATE = 'June 26, 2026';

function Hero({ title }) {
  return (
    <section className="l-legal-hero">
      <div className="l-container">
        <div className="l-legal-eyebrow">CuentaIQ Starter &amp; Pro Plans</div>
        <h1 className="l-legal-title">{title}</h1>
        <div className="l-legal-meta">
          <span>Effective date: {DATE}</span>
          <span>Governing law: Republic of the Philippines</span>
        </div>
      </div>
    </section>
  );
}

function Section({ num, heading, children }) {
  return (
    <div className="l-legal-section">
      <div className="l-legal-section-num">{num}</div>
      <h2 className="l-legal-h2">{heading}</h2>
      {children}
    </div>
  );
}

function H3({ children }) {
  return <h3 className="l-legal-h3">{children}</h3>;
}

function Highlight({ children }) {
  return <div className="l-legal-highlight"><p>{children}</p></div>;
}

function Notice({ children }) {
  return <div className="l-legal-notice">{children}</div>;
}

// ── Privacy Policy ────────────────────────────────────────────────────────────

function PrivacyPage() {
  return (
    <>
      <Hero title="Privacy Policy" />
      <div className="l-section">
        <div className="l-legal-wrap">

          <Section num="Section 1" heading="Who We Are">
            <p>CuentaIQ is a product of <strong>Application Alley Information Technology Solutions</strong>, a sole proprietorship registered in the Republic of the Philippines ("Application Alley," "we," "us," or "our"). CuentaIQ is an accounting and financial management software platform designed for Philippine micro, small, and medium enterprises (MSMEs).</p>
            <p>Application Alley acts as a <strong>Personal Information Controller (PIC)</strong> under the Data Privacy Act of 2012 (RA 10173) with respect to the personal data of its subscribers and their authorized personnel.</p>
            <table className="l-legal-table">
              <thead><tr><th>Detail</th><th>Information</th></tr></thead>
              <tbody>
                <tr><td className="l-col-label">Business name</td><td>Application Alley Information Technology Solutions</td></tr>
                <tr><td className="l-col-label">Product</td><td>CuentaIQ</td></tr>
                <tr><td className="l-col-label">Data Privacy Officer</td><td>Alexis Mae Cruz — alexis@cuentaiq.com</td></tr>
                <tr><td className="l-col-label">Contact email</td><td>hello@cuentaiq.com</td></tr>
                <tr><td className="l-col-label">Address</td><td>Legazpi Village, Makati City, Philippines</td></tr>
              </tbody>
            </table>
          </Section>

          <Section num="Section 2" heading="What Data We Collect">
            <p>Data collected varies by plan. The Pro plan collects additional categories due to the HR &amp; Payroll module.</p>

            <H3>2.1 Account &amp; Identity Data — Both Plans</H3>
            <ul>
              <li>Full name of the business owner or authorized representative</li>
              <li>Email address and contact number</li>
              <li>Business name, business type, and DTI/SEC registration number (if provided)</li>
              <li>Business TIN as registered with the BIR</li>
            </ul>

            <H3>2.2 Billing &amp; Payment Data — Both Plans</H3>
            <ul>
              <li>Subscription plan (Starter or Pro) and billing cycle (monthly or annual)</li>
              <li>One-time setup fee payment record and Year 2+ annual fee payment records</li>
              <li>Payment confirmation records and transaction IDs</li>
              <li>Billing currency (USD) and payment date history</li>
              <li>CuentaIQ does not store full card numbers or banking credentials. Payment processing is handled by PayPal.</li>
            </ul>

            <H3>2.3 Subdomain &amp; Infrastructure Data — Both Plans</H3>
            <ul>
              <li>Subscriber's assigned dedicated subdomain (e.g. <em>[clientname].cuentaiq.com</em>)</li>
              <li>Each Subscriber's business data is stored in a dedicated, isolated database, separate from other Subscribers' data, as part of the infrastructure covered by the setup and annual fees described in the Terms and Conditions</li>
            </ul>

            <H3>2.4 Financial &amp; Business Data — Both Plans</H3>
            <ul>
              <li>Business income, expense, and journal entry records</li>
              <li>E-commerce order and sales data (BigCommerce; Shopify when available) synced via official platform APIs</li>
              <li>Inventory records and product data</li>
              <li>BIR tax form data and tax-related records (2550-M, 2551-Q, 1702-Q, 1701-Q)</li>
              <li>Accounts receivable and accounts payable records</li>
              <li>Recurring invoice templates and generated invoice records</li>
            </ul>

            <H3>2.5 Employee &amp; Payroll Data — Pro Plan Only</H3>
            <p>The following categories are processed only when the HR &amp; Payroll module is active (Pro plan):</p>
            <ul>
              <li>Employee full names, positions, departments, and employment dates</li>
              <li>Monthly basic pay, compensation structure, and deduction records</li>
              <li>Tax Identification Numbers (TIN) of employees</li>
              <li>SSS, PhilHealth, and Pag-IBIG numbers and contribution data</li>
              <li>Leave records (vacation leave, sick leave, other leave types)</li>
              <li>BIR payroll form data (1601-C, 2316, 1604-C)</li>
            </ul>
            <Notice>
              <strong>Note on sensitive personal information:</strong> Employee TIN, SSS, PhilHealth, and Pag-IBIG numbers constitute sensitive personal information under RA 10173 Section 3(l). Application Alley applies heightened security and access controls to this data category. This data is processed solely for payroll computation and BIR compliance reporting on behalf of the Pro plan subscriber.
            </Notice>

            <H3>2.6 Technical &amp; Usage Data — Both Plans</H3>
            <ul>
              <li>Platform usage patterns and feature interaction logs</li>
              <li>IP address, browser type, and device information</li>
              <li>Session and log data</li>
              <li>Audit log records (Pro plan only — records all user actions for compliance oversight)</li>
            </ul>
          </Section>

          <Section num="Section 3" heading="Why We Collect Your Data">
            <table className="l-legal-table">
              <thead><tr><th>Purpose</th><th>Legal Basis (RA 10173)</th></tr></thead>
              <tbody>
                <tr><td className="l-col-label">To provide and operate the CuentaIQ platform</td><td>Contractual necessity</td></tr>
                <tr><td className="l-col-label">To process subscription payments</td><td>Contractual necessity</td></tr>
                <tr><td className="l-col-label">To manage subscription renewals, plan upgrades, cancellations, and refunds</td><td>Contractual necessity</td></tr>
                <tr><td className="l-col-label">To process payroll and generate BIR forms (Pro plan)</td><td>Contractual necessity / Legal obligation</td></tr>
                <tr><td className="l-col-label">To provide customer support</td><td>Contractual necessity / Legitimate interest</td></tr>
                <tr><td className="l-col-label">To improve the platform and develop new features</td><td>Legitimate interest</td></tr>
                <tr><td className="l-col-label">To send transactional communications (receipts, renewal notices)</td><td>Contractual necessity</td></tr>
                <tr><td className="l-col-label">To send product updates and announcements</td><td>Consent — unsubscribe available at any time</td></tr>
                <tr><td className="l-col-label">To maintain audit logs for compliance oversight (Pro plan)</td><td>Legitimate interest / Legal obligation</td></tr>
                <tr><td className="l-col-label">To comply with applicable Philippine laws and BIR regulations</td><td>Legal obligation</td></tr>
              </tbody>
            </table>
          </Section>

          <Section num="Section 4" heading="Data Retention">
            <table className="l-legal-table">
              <thead><tr><th>Data Type</th><th>Retention Period</th><th>Action at End</th></tr></thead>
              <tbody>
                <tr><td className="l-col-label">All business and financial data</td><td>Duration of active subscription</td><td>15-day migration window after end of billing period, then permanently deleted</td></tr>
                <tr><td className="l-col-label">Employee and payroll data (Pro plan)</td><td>Duration of active subscription</td><td>15-day migration window after end of billing period, then permanently deleted</td></tr>
                <tr><td className="l-col-label">Account and identity data</td><td>Duration of subscription + 90 days</td><td>Permanently deleted after 90-day post-cancellation window</td></tr>
                <tr><td className="l-col-label">Billing and payment records</td><td>7 years from transaction date</td><td>Retained for legal and tax compliance, then deleted</td></tr>
                <tr><td className="l-col-label">Audit log records (Pro plan)</td><td>Duration of active subscription + 90 days</td><td>Permanently deleted</td></tr>
                <tr><td className="l-col-label">Technical and session log data</td><td>90 days from collection</td><td>Automatically purged</td></tr>
              </tbody>
            </table>
            <Notice>
              <strong>Data migration window:</strong> After cancellation, your subscription access continues until the end of your current billing period. A 15-day migration window then opens during which you retain full read access to export and migrate your own data. After 15 days, all business and financial data is permanently and irreversibly deleted and cannot be recovered.
            </Notice>
          </Section>

          <Section num="Section 5" heading="Your Rights Under RA 10173">
            <p>You have the right to be informed, access your data, request rectification, request erasure or blocking, object to processing, and data portability — including the right to request a complete CSV extract of all your data at any time by emailing support@cuentaiq.com (delivered within 5 business days at no charge). You also have the right to file a complaint with the National Privacy Commission at <em>complaints@privacy.gov.ph</em>.</p>
            <p>To exercise any of these rights, contact our Data Privacy Officer at alexis@cuentaiq.com. We will respond within 15 business days.</p>
          </Section>

          <Section num="Section 6" heading="Third-Party Services and Sub-Processors">
            <p>Application Alley does not sell personal data. Data may be shared with:</p>
            <ul>
              <li><strong>Payment gateway:</strong> PayPal — payment transactions only. PCI-DSS compliant. Full card data is not received or stored by Application Alley.</li>
              <li><strong>Cloud infrastructure:</strong> Vercel (application layer) and Railway — Singapore region (database infrastructure) — hosts the CuentaIQ platform and all user data.</li>
              <li><strong>E-commerce platforms:</strong> BigCommerce (and Shopify when available) — data retrieved through official APIs only, under their respective terms.</li>
              <li><strong>Legal obligation:</strong> Government authorities, where required by Philippine law or valid legal process.</li>
            </ul>
          </Section>

          <Section num="Section 7" heading="Changes to This Policy">
            <p>For material changes, paid subscribers will be notified by email at least 14 days before changes take effect. Continued use after the effective date constitutes acceptance. If you do not agree with material changes, you may cancel before the effective date and request a data export.</p>
          </Section>

        </div>
      </div>
    </>
  );
}

// ── Terms & Conditions ────────────────────────────────────────────────────────

function TermsPage() {
  return (
    <>
      <Hero title="Terms & Conditions" />
      <div className="l-section">
        <div className="l-legal-wrap">

          <Section num="Section 1" heading="Acceptance of Terms">
            <p>By subscribing to a CuentaIQ paid plan, you ("Subscriber," "you," or "your") agree to be bound by these Terms and Conditions ("Terms") between yourself and <strong>Application Alley Information Technology Solutions</strong> ("Application Alley," "we," "us," or "our"), constituting a legally binding agreement under the Electronic Commerce Act of the Philippines (RA 8792).</p>
          </Section>

          <Section num="Section 2" heading="Plan Descriptions and Feature Access">
            <H3>2.1 Available Plans</H3>
            <p>CuentaIQ offers two paid subscription plans:</p>

            <div className="l-legal-plan-grid">
              <div className="l-legal-plan-card starter">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <span className="l-legal-plan-name starter">Starter</span>
                  <span className="l-legal-plan-tag starter">Online sellers</span>
                </div>
                <div className="l-legal-plan-for">For solo business owners and small online sellers — Shopee, Lazada, TikTok Shop, or BigCommerce — who need clean bookkeeping, BIR tax forms, and inventory tracking without the complexity of a full accounting suite. No employees to manage, no payroll needed. Just clear visibility into where your money is going.</div>
                <div>
                  <span className="l-legal-plan-price">$39</span>
                  <span className="l-legal-plan-price-unit"> USD / month</span>
                </div>
                <div className="l-legal-plan-annual">or $390 USD / year (2 months free)</div>
                <hr className="l-legal-divider" />
                <div style={{ fontSize: 13, color: 'var(--l-ink-mid)' }}>Up to <strong>10 users</strong> per instance &nbsp;·&nbsp; 50 AI messages/month</div>
              </div>
              <div className="l-legal-plan-card pro">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <span className="l-legal-plan-name pro">Pro</span>
                  <span className="l-legal-plan-tag pro">Businesses with staff</span>
                </div>
                <div className="l-legal-plan-for">For growing businesses with employees — salons, clinics, retail shops, service businesses, and restaurants — that need full payroll computation, SSS/PhilHealth/Pag-IBIG, leave management, and BIR payroll forms on top of complete accounting. Built for owners who need both their books and their people managed in one place.</div>
                <div>
                  <span className="l-legal-plan-price">$59</span>
                  <span className="l-legal-plan-price-unit"> USD / month</span>
                </div>
                <div className="l-legal-plan-annual">or $590 USD / year (2 months free)</div>
                <hr className="l-legal-divider" />
                <div style={{ fontSize: 13, color: 'var(--l-ink-mid)' }}>Up to <strong>25 users</strong> per instance &nbsp;·&nbsp; 100 AI messages/month</div>
              </div>
            </div>

            <H3>2.2 Feature Comparison</H3>
            <table className="l-legal-table l-legal-plan-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="th-starter">Starter</th>
                  <th className="th-pro">Pro</th>
                </tr>
              </thead>
              <tbody>
                <tr className="l-legal-section-row"><td colSpan={3}>Core Accounting</td></tr>
                <tr><td>Chart of Accounts</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr><td>Journal Entries (double-entry bookkeeping)</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr><td>Financial Reports (Balance Sheet, Income Statement, Trial Balance, General Ledger)</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr><td>Multi-currency support</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr><td>Opening balances</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr className="l-legal-section-row"><td colSpan={3}>Tax &amp; BIR</td></tr>
                <tr><td>Tax rates and applications (VAT / percentage tax)</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr><td>Tax projections</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr><td>BIR forms: 2550-M, 2551-Q, 1702-Q, 1701-Q</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr className="l-legal-section-row"><td colSpan={3}>Payments &amp; Inventory</td></tr>
                <tr><td>Accounts Receivable (Incoming)</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr><td>Accounts Payable (Pending)</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr><td>Payment schedule</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr><td>Recurring invoices</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr><td>Inventory management (SKU, stock, cost tracking)</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr className="l-legal-section-row"><td colSpan={3}>Integrations &amp; AI Assistant</td></tr>
                <tr><td>BigCommerce integration (orders &amp; inventory sync)</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr><td>AI Assistant (powered by Claude) — scoped to CuentaIQ FAQ, financial data, and accounting entry guidance</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr><td>AI Assistant monthly message cap (per instance, resets on billing date)</td><td>50 messages</td><td>100 messages</td></tr>
                <tr><td>Usage warning notification</td><td>At 80% (40 messages used)</td><td>At 80% (80 messages used)</td></tr>
                <tr><td>CSV import (journal entries, payments, inventory)</td><td className="l-check">✓</td><td className="l-check">✓</td></tr>
                <tr className="l-legal-section-row"><td colSpan={3}>HR, Payroll &amp; Compliance — Pro Only</td></tr>
                <tr><td>Employee records management</td><td className="l-cross">—</td><td className="l-check">✓</td></tr>
                <tr><td>Payroll computation (gross, deductions, net pay)</td><td className="l-cross">—</td><td className="l-check">✓</td></tr>
                <tr><td>SSS, PhilHealth, Pag-IBIG deduction computation</td><td className="l-cross">—</td><td className="l-check">✓</td></tr>
                <tr><td>Leave management</td><td className="l-cross">—</td><td className="l-check">✓</td></tr>
                <tr><td>BIR payroll forms: 1601-C, 2316, 1604-C</td><td className="l-cross">—</td><td className="l-check">✓</td></tr>
                <tr><td>Approvals workflow (multi-user journal entry approval)</td><td className="l-cross">—</td><td className="l-check">✓</td></tr>
                <tr><td>Audit logs (tamper-evident action records)</td><td className="l-cross">—</td><td className="l-check">✓</td></tr>
                <tr className="l-legal-section-row"><td colSpan={3}>User Access</td></tr>
                <tr><td>User accounts per instance</td><td>Up to 10 users</td><td>Up to 25 users</td></tr>
                <tr><td>Role-based access control (Staff, Manager, Finance, Admin)</td><td className="l-cross">—</td><td className="l-check">✓</td></tr>
              </tbody>
            </table>

            <H3>2.3 AI Assistant Message Cap — How It Works</H3>
            <p>The CuentaIQ AI Assistant is available to all paid subscribers, scoped to CuentaIQ platform guidance, the Subscriber's own financial data, and accounting entry questions. The following rules apply to message cap counting and enforcement:</p>
            <ul>
              <li><strong>What counts as 1 message:</strong> one complete exchange — the Subscriber's question plus the AI Assistant's reply — counts as 1 message toward the monthly cap</li>
              <li><strong>Warning threshold:</strong> Subscribers receive an in-app and email notification when they have used 80% of their monthly cap (40 messages for Starter, 80 messages for Pro)</li>
              <li><strong>Cap enforcement:</strong> When the monthly cap is reached, AI Assistant access is suspended for the remainder of the billing period. All other CuentaIQ features remain fully accessible</li>
              <li><strong>Cap reset:</strong> The message count resets to zero on the Subscriber's billing date each month</li>
              <li><strong>Failed messages:</strong> A message exchange that fails due to a technical error on Application Alley's side does not count toward the monthly cap</li>
              <li><strong>Per instance:</strong> The message cap applies per subscription instance. Multi-branch subscribers with separate instances each receive their own independent monthly cap</li>
            </ul>

            <H3>2.4 Multi-Branch and Additional Instances</H3>
            <p>For businesses operating multiple branches or locations, each branch is treated as a separate, independent CuentaIQ instance with its own dedicated database, subdomain, and subscription:</p>
            <table className="l-legal-table">
              <thead><tr><th>Item</th><th>Per additional branch instance</th></tr></thead>
              <tbody>
                <tr><td className="l-col-label">Monthly subscription</td><td>$39 USD/month (Starter plan, regardless of main instance plan)</td></tr>
                <tr><td className="l-col-label">Annual subscription option</td><td>$390 USD/year</td></tr>
                <tr><td className="l-col-label">One-time setup fee</td><td>$150 USD, charged at activation of each branch instance</td></tr>
                <tr><td className="l-col-label">Annual fee (Year 2+)</td><td>$150 USD per branch instance per year</td></tr>
                <tr><td className="l-col-label">AI Assistant message cap</td><td>50 messages/month (Starter plan cap applies)</td></tr>
                <tr><td className="l-col-label">User seats per branch</td><td>Up to 10 users (Starter plan limit applies)</td></tr>
                <tr><td className="l-col-label">Data isolation</td><td>Each branch instance has its own dedicated, isolated database — branch data is not shared with or accessible from other instances</td></tr>
              </tbody>
            </table>
            <p>Each branch instance is governed by these Terms and Conditions as a separate subscription. The main business entity remains responsible for all fees across all instances registered under their account.</p>

            <H3>2.5 Module Visibility</H3>
            <p>Features not included in a Subscriber's plan are hidden from the application interface. Starter plan subscribers will not see the HR &amp; Payroll module, Approvals, or Audit Logs in their sidebar. This is by design — not a technical error.</p>

            <H3>2.6 Plan Upgrades</H3>
            <p>Starter subscribers may upgrade to the Pro plan at any time. Upon upgrade, the HR &amp; Payroll module, Approvals, Audit Logs, multi-user access, and a 100-message monthly AI Assistant cap are immediately enabled. Billing adjustments for mid-cycle upgrades will be handled as follows: pro-rated via PayPal subscription adjustment — the Subscriber will be notified of the exact amount before the upgrade is confirmed. Application Alley will notify subscribers of the exact billing treatment before confirming an upgrade. No second setup fee is charged on upgrade.</p>
          </Section>

          <Section num="Section 3" heading="Billing, Payment, and Currency">
            <H3>3.1 Currency</H3>
            <p>All CuentaIQ subscription fees are charged in <strong>United States Dollars (USD)</strong>. Your bank or payment provider may apply foreign exchange conversion fees — these are your responsibility and are outside Application Alley's control.</p>

            <H3>3.2 Billing Cycles</H3>
            <p>Both the Starter and Pro plans are available on monthly or annual billing:</p>
            <table className="l-legal-table">
              <thead><tr><th>Plan</th><th>Monthly</th><th>Annual</th><th>Annual saving</th></tr></thead>
              <tbody>
                <tr><td className="l-col-label">Starter</td><td>$39 USD / month</td><td>$390 USD / year</td><td>$78 USD (2 months free)</td></tr>
                <tr><td className="l-col-label">Pro</td><td>$59 USD / month</td><td>$590 USD / year</td><td>$118 USD (2 months free)</td></tr>
              </tbody>
            </table>

            <H3>3.3 One-Time Setup Fee</H3>
            <Highlight>A <strong>one-time setup fee of $150 USD</strong> applies to every new Starter or Pro subscription, charged at the time of initial signup, in addition to the first subscription payment.</Highlight>
            <p>The setup fee covers:</p>
            <ul>
              <li>Provisioning of a dedicated, isolated database for the Subscriber's business data</li>
              <li>Configuration of the Subscriber's dedicated subdomain (e.g. <em>[clientname].cuentaiq.com</em>)</li>
              <li>Initial account setup and onboarding</li>
            </ul>
            <p>The setup fee is <strong>non-recurring</strong> and is not charged again for the remainder of the Subscriber's first 12 months on the platform. It is separate from, and in addition to, the recurring subscription fee described in Section 3.2. <strong>The setup fee is non-refundable under all circumstances</strong>, including where a subscription refund is approved under Section 4.</p>

            <H3>3.4 Annual Fee (Year 2 Onward)</H3>
            <Highlight>Beginning on the Subscriber's <strong>first annual anniversary</strong> of their initial signup date, an <strong>annual fee of $150 USD</strong> applies, billed once per year alongside the Subscriber's regular subscription renewal.</Highlight>
            <p>The annual fee covers ongoing maintenance of the Subscriber's dedicated subdomain and database infrastructure. This fee does not apply during the Subscriber's first 12 months, since those costs are covered by the one-time setup fee described in Section 3.3.</p>
            <table className="l-legal-table">
              <thead><tr><th>Period</th><th>Fee charged</th></tr></thead>
              <tbody>
                <tr><td className="l-col-label">Signup (Year 1)</td><td>$150 USD one-time setup fee + first subscription payment</td></tr>
                <tr><td className="l-col-label">Year 1 renewals (monthly or annual)</td><td>Subscription fee only — no setup or annual fee</td></tr>
                <tr><td className="l-col-label">Year 2 anniversary onward</td><td>$150 USD annual fee + subscription renewal fee</td></tr>
              </tbody>
            </table>

            <H3>3.5 Payment Processing</H3>
            <p>Payments are processed through PayPal. By subscribing, you authorize PayPal to charge your selected payment method on each billing date, including the one-time setup fee at signup and the annual fee from Year 2 onward. Application Alley does not store your full card or banking credentials.</p>

            <H3>3.6 Automatic Renewal</H3>
            <p>Subscriptions renew automatically at the end of each billing period unless cancelled before the renewal date. You will receive a renewal reminder email at least 7 days before each billing date, and at least 14 days before any Year 2+ annual fee charge. It is your responsibility to cancel before the renewal date if you do not wish to be charged for the next period.</p>

            <H3>3.7 Failed Payments</H3>
            <p>If a payment fails — including the setup fee, a subscription renewal, or the annual fee — Application Alley will notify you by email and attempt to retry the payment within 3 business days. If payment remains unsuccessful after the retry, your account enters a 7-day payment grace period during which full access is maintained. After the 7-day grace period without successful payment, your account is suspended and enters the 15-day data migration window described in Section 5.</p>

            <H3>3.8 Price Changes</H3>
            <p>Application Alley reserves the right to change subscription, setup, or annual fee pricing with at least 30 days' email notice to existing subscribers. Price changes apply at your next renewal date following the notice period. You may cancel before the change takes effect if you do not agree. Changes to the annual fee will not affect Subscribers already within their first 12 months at the time of the change.</p>
          </Section>

          <Section num="Section 4" heading="Refund Policy">
            <Highlight><strong>New subscribers only — conditional 7-day refund.</strong> If you subscribe to CuentaIQ for the first time and have not used the platform within 7 calendar days of your initial subscription payment, you may request a full refund of your subscription fee. The one-time setup fee of $150 USD is non-refundable under all circumstances.</Highlight>

            <H3>4.1 What counts as "not used"</H3>
            <p>A Subscriber is considered to have not used the platform if, within the 7-day window, they have either:</p>
            <ul>
              <li>Never logged into their CuentaIQ account after activation, <strong>or</strong></li>
              <li>Logged in but have not entered any data (no journal entries, no inventory items, no invoices, no employee records, no transactions of any kind)</li>
            </ul>
            <p>If either of these conditions is met and the request is made within 7 calendar days of the subscription start date, the subscription fee will be refunded in full. Application Alley reserves the right to verify usage via platform logs before approving the refund.</p>

            <H3>4.2 What is not refundable</H3>
            <ul>
              <li>The one-time $150 USD setup fee — non-refundable under all circumstances, including where a subscription refund is approved</li>
              <li>The Year 2+ $150 USD annual fee — non-refundable once charged</li>
              <li>Any subscription renewal charge — monthly or annual — regardless of reason or timing</li>
              <li>Any subscription fee where the platform was used within the 7-day window</li>
              <li>Any subscription fee requested after 7 calendar days from the subscription start date</li>
              <li>Unused days remaining in a billing period following cancellation — no partial or pro-rated refunds are issued</li>
            </ul>

            <H3>4.3 How to request a refund</H3>
            <p>Email hello@cuentaiq.com with subject line: <strong>Refund Request — CuentaIQ</strong>, within 7 calendar days of your subscription start date. Include your registered email address and subscription start date. Application Alley will confirm receipt within 1 business day, verify usage via platform logs, and notify you of the outcome within 3 business days. Approved refunds are processed via PayPal to the original payment method within 7–14 business days.</p>

            <H3>4.4 Exceptions</H3>
            <p>Application Alley may issue refunds outside these terms at its sole discretion in cases of documented technical failure that prevented any meaningful access to the platform. Such exceptions are evaluated case by case and are not guaranteed.</p>
          </Section>

          <Section num="Section 5" heading="Cancellation and Data Handling">
            <H3>5.1 How to Cancel</H3>
            <p>You may cancel your subscription at any time by emailing hello@cuentaiq.com with subject line: <strong>Cancel Subscription — CuentaIQ</strong>. Cancellation takes effect at the end of the current paid billing period — access is not terminated immediately upon cancellation request. You will continue to have full platform access until your billing period ends.</p>

            <H3>5.2 Data Migration Window</H3>
            <p>Following the end of your final paid billing period, Application Alley will notify you by email that your subscription has ended and your data migration window has opened. The following process applies:</p>
            <ol>
              <li>Your account enters a <strong>15-day data migration window</strong> starting from the end of your final billing period. During this window, you retain full read access to your data and may export or migrate it at your own pace.</li>
              <li>Application Alley will send a migration reminder email at the start of the window and again at Day 10.</li>
              <li>After 15 days from the start of the migration window, <strong>all data associated with your account — including business records, financial data, and employee and payroll data for Pro subscribers — is permanently and irreversibly deleted</strong> from Application Alley's systems.</li>
              <li>Application Alley will send a written deletion confirmation email once deletion is complete.</li>
            </ol>
            <p>Application Alley is not responsible for data loss resulting from failure to export or migrate data within the 15-day window. It is the Subscriber's sole responsibility to ensure their data is retrieved before the window closes.</p>

            <H3>5.3 Migration Window Extension</H3>
            <p>If you require additional time beyond the 15-day migration window, you may submit an extension request to <strong>support@cuentaiq.com</strong> with subject line: <strong>Migration Extension Request — CuentaIQ</strong>. Extension requests are evaluated on a case-by-case basis and are subject to Application Alley's approval at its sole discretion. Submission of a request does not guarantee an extension, and data deletion will proceed as scheduled if no approval is granted before the window closes.</p>

            <H3>5.4 Full Data Extract on Request</H3>
            <p>At any point during the cancellation process — including before cancellation is confirmed, during the migration window, or as part of an extension request — Subscribers may request a complete extract of all their data from Application Alley. To request a full data extract, email <strong>support@cuentaiq.com</strong> with subject line: <strong>Data Extract Request — CuentaIQ</strong>.</p>
            <p>Application Alley will prepare and deliver a complete export of the Subscriber's data in <strong>CSV format</strong> within 5 business days of the request. The extract will include all business records, financial data, journal entries, inventory, payment records, and — for Pro plan subscribers — employee and payroll data, in a structured, machine-readable format the Subscriber can use to migrate to another platform.</p>
            <p>There is no charge for a data extract request made during the cancellation or migration process.</p>
          </Section>

          <Section num="Section 6" heading="Acceptable Use">
            <p>You agree to use CuentaIQ only for lawful business purposes in compliance with all applicable Philippine laws, including BIR requirements. You must not use the platform to facilitate tax evasion, falsification of financial records, or any activity that violates Philippine law. Violation of acceptable use terms may result in immediate account suspension without refund.</p>
          </Section>

          <Section num="Section 7" heading="Intellectual Property">
            <p>CuentaIQ and all underlying technology, design, and features are the exclusive property of Application Alley Information Technology Solutions. Your data — all financial records, business data, and employee data you enter — remains your property at all times. Application Alley does not claim ownership of subscriber-entered data.</p>
          </Section>

          <Section num="Section 8" heading="Disclaimer of Warranties">
            <p><strong>CuentaIQ is a financial management tool and does not constitute professional accounting, tax, or legal advice.</strong> Subscribers are solely responsible for verifying the accuracy of any calculations, BIR forms, or reports generated by the platform before relying on them for tax filings, regulatory compliance, or financial decisions. Application Alley makes reasonable efforts to ensure platform uptime and accuracy but does not warrant uninterrupted or error-free service.</p>
          </Section>

          <Section num="Section 9" heading="Limitation of Liability">
            <p>To the fullest extent permitted by Philippine law, Application Alley's total liability to any subscriber for any claim arising from use of the CuentaIQ platform shall not exceed the total subscription fees paid by that subscriber in the 3 months immediately preceding the claim. Application Alley shall not be liable for any indirect, incidental, or consequential damages including loss of revenue, loss of data, or business interruption.</p>
          </Section>

          <Section num="Section 10" heading="Service Level and Support">
            <table className="l-legal-table">
              <thead><tr><th>Support type</th><th>Starter</th><th>Pro</th></tr></thead>
              <tbody>
                <tr><td className="l-col-label">Email support response time</td><td>2 business days</td><td>2 business days</td></tr>
                <tr><td className="l-col-label">Platform uptime target</td><td colSpan={2}>99% monthly, excluding scheduled maintenance</td></tr>
                <tr><td className="l-col-label">Scheduled maintenance notice</td><td colSpan={2}>At least 24 hours advance email notice</td></tr>
              </tbody>
            </table>
          </Section>

          <Section num="Section 11" heading="Governing Law and Dispute Resolution">
            <p>These Terms are governed by the laws of the Republic of the Philippines. Disputes shall first be addressed through good-faith negotiation. If unresolved within 30 days, disputes shall be submitted to the appropriate courts of Makati City, Philippines.</p>
          </Section>

          <Section num="Section 12" heading="Contact">
            <p>For questions, billing inquiries, or support: hello@cuentaiq.com or cuentaiq.com.</p>
          </Section>

        </div>
      </div>
    </>
  );
}

// ── Refund Policy ─────────────────────────────────────────────────────────────

function RefundPage() {
  return (
    <>
      <Hero title="Refund Policy" />
      <div className="l-section">
        <div className="l-legal-wrap">

          <Section num="Our commitment" heading="Conditional 7-Day Refund — New Subscribers Only">
            <Highlight>If you subscribe to CuentaIQ for the first time and have <strong>not used the platform</strong> within 7 calendar days of your initial subscription payment, you may request a full refund of your subscription fee. The $150 USD one-time setup fee is non-refundable under all circumstances.</Highlight>
            <p><strong>Not used</strong> means: zero logins after account activation, or logged in but no data of any kind entered into the platform.</p>
          </Section>

          <Section num="Details" heading="Full Refund Table">
            <table className="l-legal-table">
              <thead><tr><th>Scenario</th><th>Plan</th><th>Refund outcome</th></tr></thead>
              <tbody>
                <tr><td className="l-col-label">Request within 7 days, platform not used (zero logins or no data entered)</td><td>Starter or Pro — first subscription only</td><td>Subscription fee refunded ✓ — setup fee not refunded</td></tr>
                <tr><td className="l-col-label">Request within 7 days, platform was used</td><td>Any</td><td>No refund</td></tr>
                <tr><td className="l-col-label">Request after 7 days</td><td>Any</td><td>No refund</td></tr>
                <tr><td className="l-col-label">One-time setup fee ($150)</td><td>Any</td><td>Non-refundable under all circumstances</td></tr>
                <tr><td className="l-col-label">Year 2+ annual fee ($150)</td><td>Any</td><td>Non-refundable once charged</td></tr>
                <tr><td className="l-col-label">Monthly renewal charge</td><td>Any</td><td>No refund — cancel before renewal date to avoid next charge</td></tr>
                <tr><td className="l-col-label">Annual renewal charge</td><td>Any</td><td>No refund — cancel before annual renewal date</td></tr>
                <tr><td className="l-col-label">Mid-cycle cancellation (monthly)</td><td>Any</td><td>No partial refund — access continues to end of paid period</td></tr>
                <tr><td className="l-col-label">Mid-year cancellation (annual)</td><td>Any</td><td>No partial refund — access continues to end of paid year</td></tr>
                <tr><td className="l-col-label">Upgrade from Starter to Pro</td><td>—</td><td>Subject to PayPal proration — not covered by 7-day window. No second setup fee charged on upgrade.</td></tr>
                <tr><td className="l-col-label">Platform technical failure preventing any meaningful access</td><td>Any</td><td>Evaluated case by case at Application Alley's discretion</td></tr>
              </tbody>
            </table>
          </Section>

          <Section num="Process" heading="How to Request a Refund">
            <ol>
              <li>Email hello@cuentaiq.com with subject: <strong>Refund Request — CuentaIQ</strong></li>
              <li>Include your registered email address and subscription start date</li>
              <li>Application Alley will confirm receipt within 1 business day</li>
              <li>Approved refunds processed to original payment method within 7–14 business days</li>
            </ol>
          </Section>

        </div>
      </div>
    </>
  );
}

// ── Data Processing Agreement ─────────────────────────────────────────────────

function DPAPage() {
  return (
    <>
      <Hero title="Data Processing Agreement" />
      <div className="l-section">
        <div className="l-legal-wrap">

          <Section num="Preamble" heading="Purpose and Parties">
            <p>This Data Processing Agreement ("DPA") governs the processing of personal data that Subscribers enter into the CuentaIQ platform. It supplements and is incorporated into the CuentaIQ Terms and Conditions (Paid Tiers).</p>
            <table className="l-legal-table">
              <thead><tr><th>Role</th><th>Party</th><th>Defined as</th></tr></thead>
              <tbody>
                <tr><td className="l-col-label">Personal Information Controller (PIC)</td><td>The Subscriber — the business owner using CuentaIQ</td><td>"Controller"</td></tr>
                <tr><td className="l-col-label">Personal Information Processor (PIP)</td><td>Application Alley Information Technology Solutions</td><td>"Processor"</td></tr>
                <tr><td className="l-col-label">Data Subjects (Starter)</td><td>The Subscriber's customers and counterparties whose data appears in financial records</td><td>"Data Subjects"</td></tr>
                <tr><td className="l-col-label">Data Subjects (Pro — additional)</td><td>The Subscriber's employees whose payroll and personal data is entered into the HR module</td><td>"Employee Data Subjects"</td></tr>
              </tbody>
            </table>
          </Section>

          <Section num="Section 1" heading="Scope of Processing — Both Plans">
            <p>For all paid subscribers, the Processor processes the following categories of data on behalf of the Controller:</p>
            <ul>
              <li>Business financial records, journal entries, and accounting data entered by the Subscriber</li>
              <li>Accounts receivable and payable records, including counterparty names and transaction details</li>
              <li>Inventory and product records</li>
              <li>BIR tax form data derived from the Subscriber's posted transactions</li>
              <li>E-commerce order data synced from connected platforms (BigCommerce; Shopify when available)</li>
            </ul>
          </Section>

          <Section num="Section 2" heading="Scope of Processing — Pro Plan Additional (HR & Payroll)">
            <p>For Pro plan subscribers using the HR &amp; Payroll module, the Processor additionally processes the following Employee Data Subject personal data on behalf of the Controller:</p>
            <ul>
              <li>Employee full names, positions, departments, and employment dates</li>
              <li>Monthly basic pay, compensation structure, and statutory deduction records</li>
              <li>Tax Identification Numbers (TIN) — sensitive personal information under RA 10173 Sec. 3(l)</li>
              <li>SSS, PhilHealth, and Pag-IBIG numbers and contribution data — sensitive personal information</li>
              <li>Leave records (types, balances, approvals)</li>
              <li>BIR payroll form data (1601-C, 2316, 1604-C)</li>
            </ul>
            <p>Processing activities for this data include storage, organization, computation, retrieval, and display within CuentaIQ for the sole purpose of payroll computation and BIR compliance reporting on behalf of the Controller.</p>
          </Section>

          <Section num="Section 3" heading="Processor Obligations">
            <p>Application Alley, as Processor, agrees to:</p>
            <ul>
              <li>Process personal data only on documented instructions from the Controller and only for the purposes described in Sections 1 and 2</li>
              <li>Ensure all personnel with access to personal data are bound by confidentiality obligations</li>
              <li>Implement appropriate technical and organizational security measures, with heightened controls applied to sensitive personal information (employee TIN, SSS, PhilHealth, Pag-IBIG data)</li>
              <li>Not engage any new sub-processor without informing the Controller at least 14 days in advance</li>
              <li>Assist the Controller in responding to Data Subject rights requests under RA 10173 within 15 business days</li>
              <li>Notify the Controller within 48 hours of becoming aware of any personal data breach</li>
              <li>Retain personal data for the 15-day post-cancellation migration window, then permanently delete it</li>
              <li>Provide a written deletion confirmation to the Controller upon completion of permanent deletion</li>
            </ul>
          </Section>

          <Section num="Section 4" heading="Controller Obligations">
            <p>The Subscriber, as Controller, agrees to:</p>
            <ul>
              <li>Ensure a lawful basis exists for processing personal data before entering it into CuentaIQ</li>
              <li>For Pro plan subscribers: ensure employees have been informed that their personal data is processed through a third-party software platform, where required by law or their employment contract</li>
              <li>Enter only personal data that is necessary for the purposes described in this DPA</li>
              <li>Promptly inform Application Alley of any Data Subject rights requests related to data held in CuentaIQ</li>
              <li>Export and secure all data before cancelling their subscription, given the 15-day migration window after the final billing period ends</li>
            </ul>
          </Section>

          <Section num="Section 5" heading="Security Measures">
            <p>Application Alley implements the following security measures:</p>
            <ul>
              <li><strong>Dedicated, isolated database per Subscriber</strong> — each Subscriber's business and personal data is stored in a separate database instance, not a shared multi-tenant table, eliminating the risk of cross-client data exposure</li>
              <li>Encryption in transit (TLS 1.2 or higher) and at rest for all data</li>
              <li>Heightened access controls for sensitive personal information (employee government IDs)</li>
              <li>Role-based access controls within the platform (Pro plan)</li>
              <li>Tamper-evident audit logs for all user actions (Pro plan)</li>
              <li>No sharing of personal data with third parties except sub-processors listed in the Privacy Policy</li>
              <li>Secure deletion procedures at end of 15-day post-cancellation migration window — deletion of a Subscriber's dedicated database does not affect any other Subscriber's data</li>
            </ul>
          </Section>

          <Section num="Section 6" heading="Sub-Processors">
            <table className="l-legal-table">
              <thead><tr><th>Sub-processor</th><th>Role</th><th>Data processed</th></tr></thead>
              <tbody>
                <tr><td className="l-col-label">Vercel (application layer) and Railway — Singapore region (database infrastructure)</td><td>Cloud infrastructure and storage</td><td>All platform data including employee records (Pro)</td></tr>
                <tr><td className="l-col-label">PayPal</td><td>Payment processing</td><td>Billing data only — no personal or employee data</td></tr>
              </tbody>
            </table>
            <p>Application Alley will notify the Controller of any sub-processor changes at least 14 days before the new sub-processor begins processing personal data.</p>
          </Section>

          <Section num="Section 7" heading="Term and Termination">
            <p>This DPA remains in effect for the duration of the active subscription and the 15-day post-cancellation data migration period. It terminates automatically upon permanent deletion of all personal data. Confidentiality obligations survive termination indefinitely.</p>
          </Section>

          <Section num="Section 8" heading="Governing Law">
            <p>This DPA is governed by the Data Privacy Act of 2012 (RA 10173), its Implementing Rules and Regulations, and applicable NPC issuances. Disputes are resolved in accordance with the governing law and dispute resolution provisions of the CuentaIQ Terms and Conditions (Paid Tiers).</p>
          </Section>

        </div>
      </div>
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function LegalPage({ type }) {
  const pages = { terms: TermsPage, privacy: PrivacyPage, refund: RefundPage, dpa: DPAPage };
  const Page = pages[type];
  if (!Page) return null;
  return (
    <LandingLayout>
      <Page />
    </LandingLayout>
  );
}
