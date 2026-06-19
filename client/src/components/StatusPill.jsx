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
  rejected:  'pill pill-neutral',
  void:      'pill pill-neutral',
  n_a:       'pill pill-neutral',

  // Danger
  danger:    'pill pill-danger',
  failed:    'pill pill-danger',
  error:     'pill pill-danger',

  // Accent
  processing: 'pill pill-accent',
  scheduled:  'pill pill-accent',
};

export default function StatusPill({ status, label }) {
  const key = (status || '').toLowerCase().replace(/[- ]/g, '_');
  const cls = MAP[key] || 'pill pill-neutral';
  return (
    <span className={cls}>
      {label ?? status}
    </span>
  );
}
