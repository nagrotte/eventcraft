import { InputHTMLAttributes } from 'react';

interface EcInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:    string;
  error?:    string;
  hint?:     string;
}

export function EcInput({ label, error, hint, className = '', id, ...props }: EcInputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label className="ec-label" htmlFor={inputId}>{label}</label>
      )}
      <input
        id={inputId}
        className={['ec-input', error ? 'ec-input-error' : '', className].filter(Boolean).join(' ')}
        {...props}
      />
      {error && <span style={{ fontSize: 11, color: 'var(--ec-danger)' }}>{error}</span>}
      {hint && !error && <span style={{ fontSize: 11, color: 'var(--ec-text-3)' }}>{hint}</span>}
    </div>
  );
}
