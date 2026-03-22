'use client';
import { LogoMark } from '@/components/ui/LogoMark';
import { useTheme } from '@/components/ui/ThemeProvider';
import { EcButton } from '@/components/ui/EcButton';
import Link from 'next/link';
interface Breadcrumb {
  label: string;
  href?: string;
}
interface EcNavProps {
  email?:       string;
  isAdmin?:     boolean;
  onLogout?:    () => void;
  breadcrumbs?: Breadcrumb[];
}
export function EcNav({ email, isAdmin, onLogout, breadcrumbs }: EcNavProps) {
  const { theme, toggleTheme } = useTheme();
  return (
    <nav className="ec-nav">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <LogoMark size={28} />
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
          <span className="ec-nav-email" style={{ fontSize: 12, color: 'var(--ec-text-3)' }}>{email}</span>
        )}
        {isAdmin && (
          <Link href="/admin" style={{ fontSize: 12, color: 'var(--ec-brand)', textDecoration: 'none', fontWeight: 500, padding: '4px 8px', borderRadius: 'var(--ec-radius-sm)', border: '1px solid var(--ec-brand-border)', background: 'var(--ec-brand-subtle)' }}>
            Admin
          </Link>
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
