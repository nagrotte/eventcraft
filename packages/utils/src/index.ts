/**
 * EventCraft Shared Utilities
 * ===========================
 * Pure functions shared across web, mobile, and Lambda.
 * No side effects. No external dependencies beyond crypto.
 */

// ── ID Generation ─────────────────────────────────────────────────────────────

/**
 * Generates a prefixed UUID for a given entity type.
 * e.g. generateId('evt') → 'evt_a1b2c3d4e5f6...'
 */
export function generateId(prefix: string): string {
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  return `${prefix}_${uuid.replace(/-/g, '')}`;
}

/**
 * Entity-specific ID generators
 */
export const ids = {
  user:     () => generateId('usr'),
  event:    () => generateId('evt'),
  design:   () => generateId('dsg'),
  rsvp:     () => generateId('rsvp'),
  qr:       () => generateId('qr'),
  export:   () => generateId('exp'),
  template: () => generateId('tpl'),
  usage:    () => generateId('usg'),
} as const;

// ── Date & Time ───────────────────────────────────────────────────────────────

/**
 * Returns current UTC ISO string — used for createdAt/updatedAt fields
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Formats an ISO date string for display
 * e.g. '2025-07-19T16:00:00Z' → 'Saturday, July 19, 2025'
 */
export function formatDate(iso: string, options?: Intl.DateTimeFormatOptions): string {
  const defaults: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  };
  return new Date(iso).toLocaleDateString('en-US', options ?? defaults);
}

/**
 * Formats an ISO date string for display with time
 * e.g. '2025-07-19T16:00:00Z' → 'July 19, 2025 at 4:00 PM'
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year:   'numeric',
    month:  'long',
    day:    'numeric',
    hour:   'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Returns a relative time string
 * e.g. '3 days ago', 'in 5 hours', 'just now'
 */
export function timeAgo(iso: string): string {
  const now  = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const abs  = Math.abs(diff);
  const future = diff < 0;

  const minute = 60 * 1000;
  const hour   = 60 * minute;
  const day    = 24 * hour;
  const week   = 7  * day;
  const month  = 30 * day;

  let result: string;
  if      (abs < minute)      result = 'just now';
  else if (abs < hour)        result = `${Math.floor(abs / minute)} min`;
  else if (abs < day)         result = `${Math.floor(abs / hour)} hr`;
  else if (abs < week)        result = `${Math.floor(abs / day)} days`;
  else if (abs < month)       result = `${Math.floor(abs / week)} weeks`;
  else                        result = `${Math.floor(abs / month)} months`;

  if (result === 'just now') return result;
  return future ? `in ${result}` : `${result} ago`;
}

/**
 * Returns days remaining until a date (negative if past)
 */
export function daysUntil(iso: string): number {
  const now  = Date.now();
  const then = new Date(iso).getTime();
  return Math.ceil((then - now) / (24 * 60 * 60 * 1000));
}

// ── Slug Generation ───────────────────────────────────────────────────────────

/**
 * Converts a string to a URL-safe slug
 * e.g. 'Summer Garden Party!' → 'summer-garden-party'
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generates a unique microsite slug from event title + short random suffix
 * e.g. 'Summer Garden Party' → 'summer-garden-party-a1b2'
 */
export function generateSlug(title: string): string {
  const base   = slugify(title).substring(0, 40);
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

// ── String Utilities ──────────────────────────────────────────────────────────

/**
 * Truncates text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Capitalizes first letter of each word
 */
export function titleCase(text: string): string {
  return text.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substring(1).toLowerCase());
}

/**
 * Returns initials from a full name (max 2 chars)
 * e.g. 'Nag Rotte' → 'NR'
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

// ── Number / Currency ─────────────────────────────────────────────────────────

/**
 * Formats a number as USD currency
 * e.g. 9.99 → '$9.99'
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a large number with K/M suffix
 * e.g. 1234 → '1.2K', 1234567 → '1.2M'
 */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Clamps a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ── Validation ────────────────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

// ── CSS Class Name Utility ────────────────────────────────────────────────────

/**
 * Merges class names, filtering out falsy values.
 * Lightweight alternative to clsx for simple cases.
 * e.g. cn('btn', isActive && 'btn--active', undefined) → 'btn btn--active'
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ── Object Utilities ──────────────────────────────────────────────────────────

/**
 * Removes undefined/null keys from an object (useful before DynamoDB writes)
 */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)
  ) as Partial<T>;
}

/**
 * Deep equality check for plain objects
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── DynamoDB Key Helpers ──────────────────────────────────────────────────────
// Mirrors the single-table design PK/SK patterns

export const pk = {
  user:     (userId: string)              => `USER#${userId}`,
  event:    (eventId: string)             => `EVENT#${eventId}`,
  design:   (designId: string)            => `DESIGN#${designId}`,
  rsvp:     (eventId: string, email: string) => `EVENT#${eventId}`,
  rsvpSk:   (email: string)              => `RSVP#${email}`,
  qr:       (qrId: string)               => `QR#${qrId}`,
  export:   (exportId: string)            => `EXPORT#${exportId}`,
  template: (templateId: string)          => `TEMPLATE#${templateId}`,
  usage:    (userId: string)              => `USAGE#${userId}`,
} as const;

export const gsi1 = {
  userEvents:  (userId: string)  => ({ pk: `USER#${userId}`,   sk: 'EVENT#' }),
  userDesigns: (userId: string)  => ({ pk: `USER#${userId}`,   sk: 'DESIGN#' }),
  eventRsvps:  (eventId: string) => ({ pk: `RSVP#yes`,         sk: `EVENT#${eventId}` }),
  eventQrs:    (eventId: string) => ({ pk: `EVENT#${eventId}`, sk: 'QR#' }),
} as const;
