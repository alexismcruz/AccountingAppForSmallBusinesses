/**
 * AmountInput
 * - Formats numbers with commas as the user types  (e.g. 1,000,000.00)
 * - Max 18 digits to the left of the decimal point
 * - Max 2 decimal places; rounds up (ceiling) to 2dp on blur
 * - Shows "Incorrect value" error on invalid input
 * - Mobile-friendly: inputMode="decimal" triggers numeric keyboard
 */
import { useRef, useState } from 'react';

/** Add thousand-separator commas to a raw string like "1234567.89" */
function addCommas(raw) {
  if (raw === '' || raw === null || raw === undefined) return '';
  const s = String(raw);
  const dot = s.indexOf('.');
  const intPart = dot === -1 ? s : s.slice(0, dot);
  const rest    = dot === -1 ? '' : s.slice(dot); // keeps the '.' and decimals
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + rest;
}

export default function AmountInput({
  value,
  onChange,
  placeholder = '0.00',
  style,
  className,
  disabled,
}) {
  const inputRef = useRef(null);
  const [error, setError]   = useState('');

  /* ── derive display value from value prop ── */
  const display = addCommas(
    value !== '' && value !== null && value !== undefined ? String(value) : ''
  );

  /* ── handle every keystroke ── */
  const handleChange = (e) => {
    const input    = e.target;
    const raw      = input.value;
    const cursor   = input.selectionStart;

    /* count non-comma chars before cursor so we can restore it */
    const nonCommasBefore = raw.slice(0, cursor).replace(/,/g, '').length;

    /* strip commas for validation */
    const stripped = raw.replace(/,/g, '');

    /* allow clearing the field */
    if (stripped === '') { setError(''); onChange(''); return; }

    /* reject anything that isn't digits + at most one decimal point */
    if (!/^\d*\.?\d*$/.test(stripped)) { setError('Incorrect value'); return; }

    const dotPos  = stripped.indexOf('.');
    const intPart = dotPos === -1 ? stripped : stripped.slice(0, dotPos);
    const decPart = dotPos === -1 ? undefined : stripped.slice(dotPos + 1);

    /* max 18 integer digits */
    if (intPart.length > 18) { setError('Max 18 digits before decimal'); return; }

    /* silently cap decimal input at 2 places while typing */
    const cleanDec = decPart !== undefined ? decPart.slice(0, 2) : undefined;
    const clean    = cleanDec !== undefined ? `${intPart}.${cleanDec}` : intPart;

    setError('');
    onChange(clean);

    /* restore cursor position accounting for comma additions/removals */
    const formatted = addCommas(clean);
    let pos = formatted.length; // fallback: end of string
    let seen = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (seen === nonCommasBefore) { pos = i; break; }
      if (formatted[i] !== ',') seen++;
    }

    requestAnimationFrame(() => {
      if (inputRef.current && document.activeElement === inputRef.current) {
        inputRef.current.setSelectionRange(pos, pos);
      }
    });
  };

  /* ── apply ceiling rounding to 2dp on blur ── */
  const handleBlur = () => {
    if (value === '' || value === null || value === undefined) return;
    const num = parseFloat(String(value).replace(/,/g, ''));
    if (isNaN(num)) { setError('Incorrect value'); return; }
    const rounded = Math.ceil(num * 100) / 100;
    const result  = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
    onChange(result);
    setError('');
  };

  return (
    <div style={{ width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={className || 'form-input'}
        style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...style }}
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
      />
      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 11, marginTop: 2 }}>
          {error}
        </div>
      )}
    </div>
  );
}
