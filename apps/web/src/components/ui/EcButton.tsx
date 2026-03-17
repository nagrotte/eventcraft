import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface EcButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant;
  size?:     Size;
  loading?:  boolean;
  fullWidth?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary:   'ec-btn ec-btn-primary',
  secondary: 'ec-btn ec-btn-secondary',
  ghost:     'ec-btn ec-btn-ghost',
  danger:    'ec-btn ec-btn-danger'
};

const sizeClass: Record<Size, string> = {
  sm: 'ec-btn-sm',
  md: '',
  lg: 'ec-btn-lg'
};

export function EcButton({
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}: EcButtonProps) {
  return (
    <button
      className={[
        variantClass[variant],
        sizeClass[size],
        fullWidth ? 'w-full' : '',
        className
      ].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="ec-spinner" style={{ width: 14, height: 14 }} />
      ) : null}
      {children}
    </button>
  );
}
