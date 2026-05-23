/**
 * CharCount
 * Shows a character counter only when the user is approaching or at the limit.
 * - Hidden below 80% of max
 * - Orange warning color at 80–99%
 * - Red danger color at 100%
 */
export default function CharCount({ value, max }) {
  const len = (value || '').length;
  if (len / max < 0.8) return null;
  const atLimit = len >= max;
  return (
    <div style={{
      fontSize: 11,
      color: atLimit ? 'var(--danger)' : '#d97706',
      marginTop: 2,
      textAlign: 'right',
    }}>
      {len}/{max}{atLimit ? ' — limit reached' : ''}
    </div>
  );
}
