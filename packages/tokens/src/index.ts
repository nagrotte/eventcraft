/**
 * EventCraft Design Tokens
 * ========================
 * SINGLE SOURCE OF TRUTH for all visual design decisions.
 * Every color, spacing value, radius, shadow, and typography
 * setting in the entire application derives from this file.
 *
 * Usage:
 *   - Web (Next.js):   ThemeProvider injects these as CSS custom properties on :root
 *   - Mobile (Expo):   NativeWind reads these via tailwind.config.js
 *   - Components:      Never hardcode hex values — always reference a token
 */

// ── Color Palettes ────────────────────────────────────────────────────────────

export const palettes = {
  brand: {
    50:  '#EEEDF8',
    100: '#CECBF6',
    200: '#AFA9EC',
    300: '#9090E3',
    400: '#7C6EFA',  // ← primary brand color
    500: '#6358E0',
    600: '#5A4ED1',  // ← dark mode brand / light mode primary
    700: '#4038B0',
    800: '#3C3489',
    900: '#26215C',
  },
  success: {
    50:  '#D1FAE5',
    400: '#2DD4A0',
    600: '#0E9E6E',
    900: '#065F46',
  },
  warning: {
    50:  '#FEF9C3',
    400: '#F5A623',
    600: '#C47A00',
    900: '#92400E',
  },
  danger: {
    50:  '#FEE2E2',
    400: '#F0595A',
    600: '#C0383A',
    900: '#B91C1C',
  },
  gray: {
    50:  '#F4F3FF',
    100: '#E4E3F2',
    200: '#C4C3D8',
    300: '#A09EC0',
    400: '#7E7C9A',
    500: '#5C5A78',
    600: '#4A4865',
    700: '#332F52',
    800: '#1A1830',
    900: '#0E0C1C',
  },
} as const;

// ── Dark Mode Semantic Tokens ─────────────────────────────────────────────────

export const dark = {
  color: {
    brand:          palettes.brand[400],      // '#7C6EFA'
    brandDim:       palettes.brand[600],      // '#5A4ED1'
    brandGlow:      'rgba(124,110,250,0.14)',

    bg:             '#0B0B18',
    surface:        '#131324',
    card:           '#1A1A30',
    cardHover:      '#1F1F3A',
    elevated:       '#16162A',

    border:         'rgba(255,255,255,0.06)',
    borderMid:      'rgba(255,255,255,0.11)',
    borderStrong:   'rgba(255,255,255,0.18)',

    textPrimary:    '#EDEAF8',
    textSecondary:  '#7E7C9A',
    textHint:       '#4A4865',

    success:        palettes.success[400],
    successBg:      'rgba(45,212,160,0.12)',
    warning:        palettes.warning[400],
    warningBg:      'rgba(245,166,35,0.12)',
    danger:         palettes.danger[400],
    dangerBg:       'rgba(240,89,90,0.12)',
  },
} as const;

// ── Light Mode Semantic Tokens ────────────────────────────────────────────────

export const light = {
  color: {
    brand:          palettes.brand[600],      // '#5A4ED1'
    brandDim:       palettes.brand[700],      // '#4038B0'
    brandGlow:      'rgba(90,78,209,0.10)',

    bg:             '#F4F3FF',
    surface:        '#FFFFFF',
    card:           '#EEEDF8',
    cardHover:      '#E4E3F2',
    elevated:       '#FFFFFF',

    border:         'rgba(0,0,0,0.08)',
    borderMid:      'rgba(0,0,0,0.13)',
    borderStrong:   'rgba(0,0,0,0.22)',

    textPrimary:    '#1A1830',
    textSecondary:  '#6B6890',
    textHint:       '#A09EC0',

    success:        palettes.success[600],
    successBg:      'rgba(14,158,110,0.10)',
    warning:        palettes.warning[600],
    warningBg:      'rgba(196,122,0,0.10)',
    danger:         palettes.danger[600],
    dangerBg:       'rgba(192,56,58,0.10)',
  },
} as const;

// ── Spacing ───────────────────────────────────────────────────────────────────

export const spacing = {
  0:   '0px',
  1:   '4px',
  2:   '8px',
  3:   '12px',
  4:   '16px',
  5:   '20px',
  6:   '24px',
  8:   '32px',
  10:  '40px',
  12:  '48px',
  16:  '64px',
  20:  '80px',
  24:  '96px',
} as const;

// ── Border Radius ─────────────────────────────────────────────────────────────

export const radius = {
  none: '0px',
  sm:   '4px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  '2xl':'24px',
  full: '9999px',
} as const;

// ── Typography ────────────────────────────────────────────────────────────────

export const typography = {
  fontFamily: {
    sans:  '"Inter", system-ui, -apple-system, sans-serif',
    mono:  '"JetBrains Mono", "Fira Mono", "Courier New", monospace',
  },
  fontSize: {
    xs:   '11px',
    sm:   '12px',
    base: '14px',
    md:   '16px',
    lg:   '18px',
    xl:   '20px',
    '2xl':'24px',
    '3xl':'30px',
    '4xl':'36px',
    '5xl':'48px',
  },
  fontWeight: {
    normal:  '400',
    medium:  '500',
    semibold:'600',
    bold:    '700',
  },
  lineHeight: {
    tight:  '1.2',
    snug:   '1.4',
    normal: '1.6',
    relaxed:'1.8',
  },
} as const;

// ── Shadows ───────────────────────────────────────────────────────────────────

export const shadows = {
  dark: {
    sm:   '0 1px 3px rgba(0,0,0,0.4)',
    md:   '0 4px 12px rgba(0,0,0,0.4)',
    lg:   '0 8px 24px rgba(0,0,0,0.5)',
    brand:'0 4px 20px rgba(124,110,250,0.25)',
  },
  light: {
    sm:   '0 1px 3px rgba(0,0,0,0.08)',
    md:   '0 4px 12px rgba(0,0,0,0.10)',
    lg:   '0 8px 24px rgba(0,0,0,0.12)',
    brand:'0 4px 20px rgba(90,78,209,0.20)',
  },
} as const;

// ── Animation ─────────────────────────────────────────────────────────────────

export const animation = {
  duration: {
    fast:   '100ms',
    normal: '200ms',
    slow:   '300ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in:      'cubic-bezier(0.4, 0, 1, 1)',
    out:     'cubic-bezier(0, 0, 0.2, 1)',
  },
} as const;

// ── Z-Index ───────────────────────────────────────────────────────────────────

export const zIndex = {
  base:    0,
  raised:  10,
  dropdown:100,
  sticky:  200,
  overlay: 300,
  modal:   400,
  toast:   500,
} as const;

// ── CSS Custom Properties Generator ──────────────────────────────────────────
// Used by ThemeProvider to inject tokens as CSS vars on :root

export function toCssVars(mode: 'dark' | 'light'): Record<string, string> {
  const colors = mode === 'dark' ? dark.color : light.color;

  return {
    // Colors
    '--ec-brand':           colors.brand,
    '--ec-brand-dim':       colors.brandDim,
    '--ec-brand-glow':      colors.brandGlow,
    '--ec-bg':              colors.bg,
    '--ec-surface':         colors.surface,
    '--ec-card':            colors.card,
    '--ec-card-hover':      colors.cardHover,
    '--ec-elevated':        colors.elevated,
    '--ec-border':          colors.border,
    '--ec-border-mid':      colors.borderMid,
    '--ec-border-strong':   colors.borderStrong,
    '--ec-text-primary':    colors.textPrimary,
    '--ec-text-secondary':  colors.textSecondary,
    '--ec-text-hint':       colors.textHint,
    '--ec-success':         colors.success,
    '--ec-success-bg':      colors.successBg,
    '--ec-warning':         colors.warning,
    '--ec-warning-bg':      colors.warningBg,
    '--ec-danger':          colors.danger,
    '--ec-danger-bg':       colors.dangerBg,

    // Spacing
    '--ec-space-1':  spacing[1],
    '--ec-space-2':  spacing[2],
    '--ec-space-3':  spacing[3],
    '--ec-space-4':  spacing[4],
    '--ec-space-6':  spacing[6],
    '--ec-space-8':  spacing[8],

    // Radius
    '--ec-radius-sm':  radius.sm,
    '--ec-radius-md':  radius.md,
    '--ec-radius-lg':  radius.lg,
    '--ec-radius-xl':  radius.xl,
    '--ec-radius-2xl': radius['2xl'],
    '--ec-radius-full':radius.full,

    // Typography
    '--ec-font-sans':  typography.fontFamily.sans,
    '--ec-font-mono':  typography.fontFamily.mono,
  };
}

// ── Tailwind/NativeWind Config Values ─────────────────────────────────────────
// Used by tailwind.config.js in web and mobile apps

export const tailwindTokens = {
  colors: {
    brand: {
      DEFAULT: palettes.brand[400],
      dim:     palettes.brand[600],
      ...palettes.brand,
    },
    success: palettes.success,
    warning: palettes.warning,
    danger:  palettes.danger,
    gray:    palettes.gray,
  },
  spacing,
  borderRadius: radius,
  fontFamily:   typography.fontFamily,
  fontSize:     typography.fontSize,
  fontWeight:   typography.fontWeight,
  zIndex,
} as const;

// ── Default export ────────────────────────────────────────────────────────────

const tokens = { palettes, dark, light, spacing, radius, typography, shadows, animation, zIndex, toCssVars, tailwindTokens };
export default tokens;
