// Single source of truth for the pioneer-intake footer line.
//
// To CLOSE intake on a date: set VITE_PIONEER_INTAKE_CLOSE to a YYYY-MM-DD
//   (e.g. 2026-09-30) and rebuild — the line switches to a real deadline.
// To KEEP intake OPEN: leave it empty (default). Slot scarcity ("Max 5
//   pioneers") is retained either way.

const RAW = (import.meta.env.VITE_PIONEER_INTAKE_CLOSE || '').trim();

function closeLabel() {
  if (!RAW) return '';
  const d = new Date(RAW + 'T00:00:00');
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function pioneerIntakeLine() {
  const label = closeLabel();
  return label
    ? `Intake closes ${label} · Max 5 pioneers`
    : 'Now accepting applications · Max 5 pioneers';
}
