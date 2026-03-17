'use client';

import { useTheme } from '@/components/ui/ThemeProvider';
import { EcButton } from '@/components/ui/EcButton';

interface EcNavProps {
  email?:    string;
  onLogout?: () => void;
}

export function EcNav({ email, onLogout }: EcNavProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="ec-nav">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="ec-logo-mark">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7.5L5.5 11L12 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em' }}>
          EventCraft
        </span>
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
