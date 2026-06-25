import { useState } from 'react';
import { X } from 'lucide-react';

const EMPTY_FORM = { name: '', company: '', email: '', phone: '', message: '' };

export default function DemoModal({ onClose }) {
  const [form, setForm]             = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState(null);

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res  = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) { setResult('success'); setForm(EMPTY_FORM); }
      else setResult(data.error || 'error');
    } catch {
      setResult('error');
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => { onClose(); setResult(null); };

  return (
    <div className="l-modal-overlay" onClick={e => e.target === e.currentTarget && close()}>
      <div className="l-modal">
        <button className="l-modal-close" onClick={close}><X size={16} /></button>
        <div className="l-modal-title">Request a Demo</div>
        <p className="l-modal-sub">Fill in the form and we'll get back to you within 24 hours.</p>

        {result === 'success' ? (
          <div className="l-alert-success">
            Thank you! We received your request and will be in touch within 24 hours.
          </div>
        ) : (
          <form className="l-form" onSubmit={onSubmit}>
            <div className="l-form-row">
              <div className="l-form-group">
                <label className="l-label">Full Name <span className="req">*</span></label>
                <input className="l-input" name="name" value={form.name} onChange={onChange} required placeholder="Juan dela Cruz" />
              </div>
              <div className="l-form-group">
                <label className="l-label">Company Name <span className="req">*</span></label>
                <input className="l-input" name="company" value={form.company} onChange={onChange} required placeholder="Your Business" />
              </div>
            </div>
            <div className="l-form-row">
              <div className="l-form-group">
                <label className="l-label">Email Address <span className="req">*</span></label>
                <input className="l-input" type="email" name="email" value={form.email} onChange={onChange} required placeholder="juan@company.com" />
              </div>
              <div className="l-form-group">
                <label className="l-label">Phone Number</label>
                <input className="l-input" name="phone" value={form.phone} onChange={onChange} placeholder="+63 9XX XXX XXXX" />
              </div>
            </div>
            <div className="l-form-group">
              <label className="l-label">What are you looking for? <span className="req">*</span></label>
              <textarea className="l-textarea" name="message" value={form.message} onChange={onChange} required
                placeholder="Tell us about your business and what you'd like to see in the demo…" />
            </div>
            {result && result !== 'success' && (
              <div className="l-alert-error">
                {typeof result === 'string' && result.length > 5
                  ? result
                  : 'Something went wrong. Please email hello@cuentaiq.com directly.'}
              </div>
            )}
            <button className="l-btn l-btn-primary" type="submit" disabled={submitting}
              style={{ width: '100%', justifyContent: 'center' }}>
              {submitting ? 'Sending…' : 'Send Request'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
