/**
 * Button — shared component
 * Works on web (Next.js) and mobile (Expo via React Native Web)
 */

import React from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  children:    React.ReactNode;
  variant?:    ButtonVariant;
  size?:       ButtonSize;
  disabled?:   boolean;
  loading?:    boolean;
  fullWidth?:  boolean;
  onClick?:    () => void;
  type?:       'button' | 'submit' | 'reset';
  className?:  string;
  icon?:       React.ReactNode;   // leading icon
  iconRight?:  React.ReactNode;   // trailing icon
  'aria-label'?: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────
// All values reference CSS custom properties — never hardcoded colors

const base = [
  'inline-flex items-center justify-center gap-2',
  'font-medium rounded-[var(--ec-radius-md)]',
  'border transition-all duration-200',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ec-brand)]',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'select-none',
].join(' ');

const variants: Record<ButtonVariant, string> = {
  primary: [
    'bg-[var(--ec-brand)] text-white border-transparent',
    'hover:bg-[var(--ec-brand-dim)] active:scale-[0.98]',
  ].join(' '),

  secondary: [
    'bg-[var(--ec-card)] text-[var(--ec-text-primary)]',
    'border-[var(--ec-border-mid)]',
    'hover:bg-[var(--ec-card-hover)] hover:border-[var(--ec-border-strong)]',
    'active:scale-[0.98]',
  ].join(' '),

  ghost: [
    'bg-transparent text-[var(--ec-text-secondary)]',
    'border-transparent',
    'hover:bg-[var(--ec-card)] hover:text-[var(--ec-text-primary)]',
    'active:scale-[0.98]',
  ].join(' '),

  danger: [
    'bg-[var(--ec-danger-bg)] text-[var(--ec-danger)]',
    'border-[var(--ec-danger)]',
    'hover:bg-[var(--ec-danger)] hover:text-white',
    'active:scale-[0.98]',
  ].join(' '),

  success: [
    'bg-[var(--ec-success-bg)] text-[var(--ec-success)]',
    'border-[var(--ec-success)]',
    'hover:bg-[var(--ec-success)] hover:text-white',
    'active:scale-[0.98]',
  ].join(' '),
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8  px-3  text-xs',
  md: 'h-10 px-4  text-sm',
  lg: 'h-12 px-6  text-base',
};

// ── Spinner (inline) ──────────────────────────────────────────────────────────

function ButtonSpinner() {
  return (
    <svg
      className="animate-spin"
      width="14" height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="7" cy="7" r="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="20"
        strokeDashoffset="10"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Button({
  children,
  variant    = 'primary',
  size       = 'md',
  disabled   = false,
  loading    = false,
  fullWidth  = false,
  onClick,
  type       = 'button',
  className  = '',
  icon,
  iconRight,
  'aria-label': ariaLabel,
}: ButtonProps) {
  const classes = [
    base,
    variants[variant],
    sizes[size],
    fullWidth ? 'w-full' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-busy={loading}
    >
      {loading ? <ButtonSpinner /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}
