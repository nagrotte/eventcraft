/**
 * @eventcraft/ui — Public Surface
 * ================================
 * ONLY import from this file. Never import directly from
 * individual component files inside packages/ui/src/components/
 *
 * Revealing module pattern: internals are private, only
 * explicitly exported items are public API.
 */

// ── Providers ─────────────────────────────────────────────────────────────────
export { ThemeProvider, useTheme, ThemeToggle } from './providers/ThemeProvider';
export type { ThemeMode } from './providers/ThemeProvider';

// ── Components ────────────────────────────────────────────────────────────────
export { Button }                            from './components/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button';

export { Card, CardHeader, CardTitle, CardBody, CardFooter } from './components/Card';
export type { CardProps }                    from './components/Card';

export { Badge, RsvpBadge, EventStatusBadge } from './components/Badge';
export type { BadgeProps, BadgeVariant }     from './components/Badge';

export { Spinner }                           from './components/SpinnerAndInput';
export type { SpinnerProps }                 from './components/SpinnerAndInput';

export { Input }                             from './components/SpinnerAndInput';
export type { InputProps }                   from './components/SpinnerAndInput';
