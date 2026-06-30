import { useState } from 'react';
import LandingLayout from './LandingLayout.jsx';
import { CheckCircle2, ArrowRight } from 'lucide-react';

// Required unless marked optional
const CHECKLIST = [
  { id: 'fee',      label: 'Paid the $150 one-time setup fee' },
  { id: 'business', label: 'Prepared our business registration details (legal name, TIN, registration / SEC number, registered address)' },
  { id: 'users',    label: 'Prepared our list of users — full name, email, and role for each person who needs access' },
  { id: 'coa',      label: "Decided on our chart of accounts — use CuentaIQ's default Philippine COA, or send our own" },
  { id: 'balances', label: 'Prepared our opening balances as of our start date (or confirmed we are starting fresh)' },
  { id: 'modules',  label: 'Selected the modules we need (HR & Payroll, Inventory, Payments, Tax)' },
  { id: 'email',    label: 'Provided the business email to use for invoices and customer notifications' },
  { id: 'logo',     label: 'Prepared our company logo for invoices', optional: true },
  { id: 'terms',    label: 'Read and agree to the Terms of Service and Privacy Policy' },
];

const EMPTY = { business_name: '', contact_person: '', contact_email: '', subdomain: '', plan: '' };

export default function OnboardingPage() {
  const [form, setForm]           = useState(EMPTY);
  const [checked, setChecked]     = useState({});
  const [notes, setNotes]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]       = useState(null);

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const toggle   = id => setChecked(c => ({ ...c, [id]: !c[id] }));

  const requiredChecked = CHECKLIST.filter(i => !i.optional).every(i => checked[i.id]);
  const detailsFilled   = form.business_name.trim() && form.contact_person.trim() && form.contact_email.trim();
  const canSubmit       = requiredChecked && detailsFilled && !submitting;

  const onSubmit = async e => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          notes,
          items: CHECKLIST.map(i => ({ label: i.label, checked: !!checked[i.id], optional: !!i.optional })),
        }),
      });
      const data = await res.json();
      if (res.ok) { setResult('success'); }
      else setResult(data.error || 'error');
    } catch {
      setResult('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LandingLayout>
      {/* HERO */}
      <section className="l-section l-section-cream">
        <div className="l-container l-center">
          <div className="l-section-label">Client Onboarding</div>
          <h1 className="l-section-title" style={{ marginTop: 8 }}>
            Let's get your books set up
          </h1>
          <p className="l-section-sub" style={{ margin: '16px auto 0' }}>
            Work through the checklist below. Once everything's ready, submit it and our team will
            provision your environment — typically within 3 to 5 business days.
          </p>
        </div>
      </section>

      {/* CHECKLIST */}
      <section className="l-section">
        <div className="l-container" style={{ maxWidth: 720 }}>
          {result === 'success' ? (
            <div className="l-card l-center" style={{ padding: 40 }}>
              <CheckCircle2 size={44} color="var(--l-green)" style={{ marginBottom: 12 }} />
              <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 26, color: 'var(--l-ink)', marginBottom: 10 }}>
                Checklist received!
              </h2>
              <p style={{ fontSize: 15, color: 'var(--l-ink-mid)', lineHeight: 1.7, maxWidth: 480, margin: '0 auto' }}>
                Thanks, {form.contact_person.split(' ')[0] || 'there'}. We've got your onboarding checklist and
                will be in touch at <strong>{form.contact_email}</strong> as we set up your environment.
                Questions in the meantime? Email{' '}
                <a href="mailto:support@cuentaiq.com" style={{ color: 'var(--l-green)', fontWeight: 600 }}>support@cuentaiq.com</a>.
              </p>
            </div>
          ) : (
            <form className="l-form" onSubmit={onSubmit}>
              {/* Your details */}
              <div className="l-card" style={{ padding: 28, marginBottom: 20 }}>
                <h3 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, color: 'var(--l-ink)', marginBottom: 18 }}>
                  Your details
                </h3>
                <div className="l-form-row">
                  <div className="l-form-group">
                    <label className="l-label">Business Name <span className="req">*</span></label>
                    <input className="l-input" name="business_name" value={form.business_name} onChange={onChange} required placeholder="Your Business, Inc." />
                  </div>
                  <div className="l-form-group">
                    <label className="l-label">Contact Person <span className="req">*</span></label>
                    <input className="l-input" name="contact_person" value={form.contact_person} onChange={onChange} required placeholder="Juan dela Cruz" />
                  </div>
                </div>
                <div className="l-form-row">
                  <div className="l-form-group">
                    <label className="l-label">Email Address <span className="req">*</span></label>
                    <input className="l-input" type="email" name="contact_email" value={form.contact_email} onChange={onChange} required placeholder="juan@company.com" />
                  </div>
                  <div className="l-form-group">
                    <label className="l-label">Preferred Subdomain</label>
                    <input className="l-input" name="subdomain" value={form.subdomain} onChange={onChange} placeholder="acme" />
                    <div style={{ fontSize: 12, color: 'var(--l-ink-mid)', marginTop: 4 }}>
                      {form.subdomain ? `${form.subdomain}.cuentaiq.com` : 'yourname.cuentaiq.com'}
                    </div>
                  </div>
                </div>
                <div className="l-form-group">
                  <label className="l-label">Plan</label>
                  <select className="l-input" name="plan" value={form.plan} onChange={onChange}>
                    <option value="">Select a plan…</option>
                    <option value="Starter">Starter</option>
                    <option value="Pro">Pro</option>
                    <option value="Pioneer">Pioneer Program</option>
                    <option value="Not sure yet">Not sure yet</option>
                  </select>
                </div>
              </div>

              {/* Checklist */}
              <div className="l-card" style={{ padding: 28, marginBottom: 20 }}>
                <h3 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, color: 'var(--l-ink)', marginBottom: 6 }}>
                  Onboarding checklist
                </h3>
                <p style={{ fontSize: 13, color: 'var(--l-ink-mid)', marginBottom: 18 }}>
                  Check each item once it's ready. All items are required except those marked optional.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {CHECKLIST.map(it => (
                    <label key={it.id}
                      style={{
                        display: 'flex', gap: 12, padding: '14px 16px', cursor: 'pointer', alignItems: 'flex-start',
                        borderRadius: 10, background: 'var(--l-cream)',
                        border: `1px solid ${checked[it.id] ? 'var(--l-green)' : 'var(--l-border)'}`,
                        transition: 'border-color 0.15s',
                      }}>
                      <input type="checkbox" checked={!!checked[it.id]} onChange={() => toggle(it.id)}
                        style={{ marginTop: 2, width: 18, height: 18, accentColor: 'var(--l-green)', flexShrink: 0, cursor: 'pointer' }} />
                      <span style={{ fontSize: 14, color: 'var(--l-ink)', lineHeight: 1.5 }}>
                        {it.label}
                        {it.optional && <span style={{ color: 'var(--l-ink-mid)', fontWeight: 400 }}> (optional)</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="l-card" style={{ padding: 28, marginBottom: 20 }}>
                <label className="l-label">Anything else we should know?</label>
                <textarea className="l-textarea" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Special requests, migration details, questions… (optional)" />
              </div>

              {result && result !== 'success' && (
                <div className="l-alert-error" style={{ marginBottom: 16 }}>
                  {typeof result === 'string' && result.length > 5
                    ? result
                    : 'Something went wrong. Please email support@cuentaiq.com directly.'}
                </div>
              )}

              {!requiredChecked && (
                <p style={{ fontSize: 13, color: 'var(--l-ink-mid)', marginBottom: 12, textAlign: 'center' }}>
                  Check all required items above to submit.
                </p>
              )}

              <button className="l-btn l-btn-primary" type="submit" disabled={!canSubmit}
                style={{ width: '100%', justifyContent: 'center', opacity: canSubmit ? 1 : 0.55 }}>
                {submitting ? 'Submitting…' : <>Submit Checklist <ArrowRight size={16} /></>}
              </button>
            </form>
          )}
        </div>
      </section>
    </LandingLayout>
  );
}
