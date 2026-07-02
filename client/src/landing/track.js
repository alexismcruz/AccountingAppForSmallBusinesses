// Google Ads conversion tracking (marketing site only).
//
// window.gtag is defined ONLY on cuentaiq.com / www.cuentaiq.com (the gtag
// loader in index.html is gated to those hosts), so these calls safely no-op
// everywhere else — including inside client accounting-app instances.

const LEAD_CONVERSION = 'AW-18292422299/_WgZCO_cr8kcEJvtwJJE';

// Fire the "Submit lead form" conversion (demo request, pioneer application).
export function trackLeadConversion() {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'conversion', {
      send_to: LEAD_CONVERSION,
      value: 1.0,
      currency: 'PHP',
    });
  }
}
