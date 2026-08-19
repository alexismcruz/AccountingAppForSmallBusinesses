const MAP = {
  // Positive / active
  active:    'pill pill-success',
  approved:  'pill pill-success',
  paid:      'pill pill-success',
  posted:    'pill pill-success',
  confirmed: 'pill pill-success',
  completed: 'pill pill-success',
  settled:   'pill pill-success',
  on_leave:  'pill pill-primary',

  // Warning / pending
  pending:   'pill pill-warning',
  partial:   'pill pill-warning',
  draft:     'pill pill-warning',
  overdue:   'pill pill-warning',
  low:       'pill pill-warning',

  // Neutral / inactive
  inactive:  'pill pill-neutral',
  cancelled: 'pill pill-neutral',
  void:      'pill pill-neutral',
  n_a:       'pill pill-neutral',

  // Rejected — distinct red so it can't be mistaken for Posted/Approved
  rejected:  'pill pill-danger',

  // Danger
  danger:    'pill pill-danger',
  failed:    'pill pill-danger',
  error:     'pill pill-danger',

  // Accent
  processing: 'pill pill-accent',
  scheduled:  'pill pill-accent',
};

// Turn a raw status ("posted", "pending_approval") into a display label
// ("Posted", "Pending Approval"). Display only — the underlying status value
// passed in is untouched, so filtering/logic keyed on it still works.
function prettify(status) {
  return (status || '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function StatusPill({ status, label }) {
  const key = (status || '').toLowerCase().replace(/[- ]/g, '_');
  const cls = MAP[key] || 'pill pill-neutral';
  return (
    <span className={cls}>
      {label ?? prettify(status)}
    </span>
  );
}
