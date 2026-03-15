/**
 * Badge — status indicator pill
 */

import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'brand' | 'outline';

export interface BadgeProps {
  children:   React.ReactNode;
  variant?:   BadgeVariant;
  className?: string;
}

const badgeVariants: Record<BadgeVariant, string> = {
  default:  'bg-[var(--ec-card)] text-[var(--ec-text-secondary)] border-[var(--ec-border)]',
  success:  'bg-[var(--ec-success-bg)] text-[var(--ec-success)] border-[var(--ec-success)]',
  warning:  'bg-[var(--ec-warning-bg)] text-[var(--ec-warning)] border-[var(--ec-warning)]',
  danger:   'bg-[var(--ec-danger-bg)] text-[var(--ec-danger)] border-[var(--ec-danger)]',
  brand:    'bg-[var(--ec-brand-glow)] text-[var(--ec-brand)] border-[var(--ec-brand)]',
  outline:  'bg-transparent text-[var(--ec-text-secondary)] border-[var(--ec-border-mid)]',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={[
      'inline-flex items-center px-2 py-0.5',
      'text-xs font-semibold tracking-wide',
      'rounded-[var(--ec-radius-full)] border',
      badgeVariants[variant],
      className,
    ].filter(Boolean).join(' ')}>
      {children}
    </span>
  );
}

// ── Rsvp Status Badge ─────────────────────────────────────────────────────────

export function RsvpBadge({ status }: { status: 'yes' | 'no' | 'maybe' | 'pending' }) {
  const map = {
    yes:     { variant: 'success' as BadgeVariant, label: 'Going' },
    no:      { variant: 'danger'  as BadgeVariant, label: 'Declined' },
    maybe:   { variant: 'warning' as BadgeVariant, label: 'Maybe' },
    pending: { variant: 'default' as BadgeVariant, label: 'Pending' },
  };
  const { variant, label } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

// ── Event Status Badge ────────────────────────────────────────────────────────

export function EventStatusBadge({ status }: { status: 'draft' | 'published' | 'cancelled' | 'completed' }) {
  const map = {
    draft:     { variant: 'default'  as BadgeVariant, label: 'Draft' },
    published: { variant: 'success'  as BadgeVariant, label: 'Live' },
    cancelled: { variant: 'danger'   as BadgeVariant, label: 'Cancelled' },
    completed: { variant: 'outline'  as BadgeVariant, label: 'Completed' },
  };
  const { variant, label } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}
