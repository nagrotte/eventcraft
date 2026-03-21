'use client';
import { useTheme } from '@/components/ui/ThemeProvider';
import { EcButton } from '@/components/ui/EcButton';
import Link from 'next/link';
interface Breadcrumb {
  label: string;
  href?: string;
}
interface EcNavProps {
  email?:       string;
  onLogout?:    () => void;
  breadcrumbs?: Breadcrumb[];
}
export function EcNav({ email, onLogout, breadcrumbs }: EcNavProps) {
  const { theme, toggleTheme } = useTheme();
  return (
    <nav className="ec-nav">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div className="ec-logo-mark" style={{ width: 28, height: 28, flexShrink: 0 }}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g transform="translate(16, 17)">
                <ellipse cx="0"   cy="-10" rx="4"   ry="9"   fill="#6366F1" opacity="0.9"/>
                <ellipse cx="8"   cy="-6"  rx="3.5" ry="7.5" fill="#6366F1" opacity="0.7" transform="rotate(35 8 -6)"/>
                <ellipse cx="-8"  cy="-6"  rx="3.5" ry="7.5" fill="#6366F1" opacity="0.7" transform="rotate(-35 -8 -6)"/>
                <ellipse cx="12"  cy="1"   rx="3"   ry="6"   fill="#818CF8" opacity="0.35" transform="rotate(60 12 1)"/>
                <ellipse cx="-12" cy="1"   rx="3"   ry="6"   fill="#818CF8" opacity="0.35" transform="rotate(-60 -12 1)"/>
                <ellipse cx="0"   cy="-6"  rx="2.5" ry="5.5" fill="#D4AF37" opacity="0.95"/>
                <ellipse cx="5"   cy="-4"  rx="2"   ry="5"   fill="#D4AF37" opacity="0.8" transform="rotate(30 5 -4)"/>
                <ellipse cx="-5"  cy="-4"  rx="2"   ry="5"   fill="#D4AF37" opacity="0.8" transform="rotate(-30 -5 -4)"/>
                <circle cx="0" cy="-6" r="3"   fill="#0F0A2E"/>
                <circle cx="0" cy="-6" r="1.8" fill="#D4AF37"/>
                <line x1="0" y1="2" x2="0" y2="8" stroke="#6366F1" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
              </g>
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em' }}>
            EventCraft
          </span>
        </Link>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {breadcrumbs.map((crumb, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--ec-text-3)' }}>/</span>
                {crumb.href ? (
                  <Link href={crumb.href} style={{ fontSize: 12, color: 'var(--ec-text-2)', textDecoration: 'none' }}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--ec-text-1)', fontWeight: 500 }}>
                    {crumb.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {email && (
          <span style={{ fontSize: 12, color: 'var(--ec-text-3)' }}>{email}</span>
        )}
        <button
          onClick={toggleTheme}
          style={{
            width: 30, height: 30,
            borderRadius: 'var(--ec-radius-md)',
            border: '1px solid var(--ec-border)',
            background: 'var(--ec-surface-raised)',
            color: 'var(--ec-text-2)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
          title="Toggle theme"
        >
          {theme === 'dark' ? (
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M6.5 1v1M6.5 11v1M1 6.5h1M11 6.5h1M2.9 2.9l.7.7M9.4 9.4l.7.7M9.4 2.9l-.7.7M3.6 9.4l-.7.7"
                stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M11.5 8A5.5 5.5 0 0 1 5 1.5a5.5 5.5 0 1 0 6.5 6.5z"
                stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          )}
        </button>
        {onLogout && (
          <EcButton variant="ghost" size="sm" onClick={onLogout}>Sign out</EcButton>
        )}
      </div>
    </nav>
  );
}
