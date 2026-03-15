/**
 * Card — shared component
 */

import React from 'react';

export interface CardProps {
  children:   React.ReactNode;
  className?: string;
  onClick?:   () => void;
  hoverable?: boolean;
  padding?:   'none' | 'sm' | 'md' | 'lg';
}

const paddings = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-6',
};

export function Card({
  children,
  className  = '',
  onClick,
  hoverable  = false,
  padding    = 'md',
}: CardProps) {
  const classes = [
    'bg-[var(--ec-card)]',
    'border border-[var(--ec-border)]',
    'rounded-[var(--ec-radius-lg)]',
    paddings[padding],
    hoverable && 'cursor-pointer transition-all duration-150 hover:border-[var(--ec-border-mid)] hover:bg-[var(--ec-card-hover)]',
    onClick   && 'cursor-pointer',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  );
}

// ── Card sub-components ───────────────────────────────────────────────────────

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`text-base font-semibold text-[var(--ec-text-primary)] ${className}`}>
      {children}
    </h3>
  );
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-sm text-[var(--ec-text-secondary)] ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between mt-4 pt-4 border-t border-[var(--ec-border)] ${className}`}>
      {children}
    </div>
  );
}
