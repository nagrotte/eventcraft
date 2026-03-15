/**
 * Spinner — loading indicator
 */

import React from 'react';

export interface SpinnerProps {
  size?:      'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 16, md: 24, lg: 40 };

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const s = sizes[size];
  return (
    <svg
      width={s} height={s}
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin text-[var(--ec-brand)] ${className}`}
      aria-label="Loading"
      role="status"
    >
      <circle
        cx="12" cy="12" r="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.25"
      />
      <path
        d="M12 3a9 9 0 0 1 9 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:       string;
  error?:       string;
  hint?:        string;
  icon?:        React.ReactNode;
  iconRight?:   React.ReactNode;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  hint,
  icon,
  iconRight,
  containerClassName = '',
  className          = '',
  id,
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-[var(--ec-text-secondary)] uppercase tracking-wide"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ec-text-hint)]">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={[
            'w-full h-10 px-3 text-sm',
            'bg-[var(--ec-card)] text-[var(--ec-text-primary)]',
            'border rounded-[var(--ec-radius-md)]',
            'outline-none transition-colors duration-150',
            'placeholder:text-[var(--ec-text-hint)]',
            error
              ? 'border-[var(--ec-danger)] focus:border-[var(--ec-danger)]'
              : 'border-[var(--ec-border)] focus:border-[var(--ec-brand)]',
            icon      ? 'pl-9'  : '',
            iconRight ? 'pr-9'  : '',
            className,
          ].filter(Boolean).join(' ')}
          {...props}
        />
        {iconRight && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ec-text-hint)]">
            {iconRight}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-[var(--ec-danger)]">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-[var(--ec-text-hint)]">{hint}</p>
      )}
    </div>
  );
}
