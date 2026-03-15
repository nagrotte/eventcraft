'use client';

/**
 * ThemeProvider
 * =============
 * Injects design tokens as CSS custom properties on :root.
 * Persists theme preference to localStorage.
 * Provides useTheme hook to all children.
 *
 * Usage:
 *   // app/layout.tsx
 *   <ThemeProvider defaultMode="dark">
 *     {children}
 *   </ThemeProvider>
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { toCssVars } from '@eventcraft/tokens';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  mode:       ThemeMode;
  toggleMode: () => void;
  setMode:    (mode: ThemeMode) => void;
  isDark:     boolean;
  isLight:    boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children:     React.ReactNode;
  defaultMode?: ThemeMode;
}

export function ThemeProvider({ children, defaultMode = 'dark' }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(defaultMode);

  // On mount, read persisted preference
  useEffect(() => {
    const stored = localStorage.getItem('ec-theme') as ThemeMode | null;
    if (stored === 'dark' || stored === 'light') {
      setModeState(stored);
    } else {
      // Detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setModeState(prefersDark ? 'dark' : 'light');
    }
  }, []);

  // Inject CSS vars whenever mode changes
  useEffect(() => {
    const vars = toCssVars(mode);
    const root = document.documentElement;

    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Set data attribute for any CSS selectors that need it
    root.setAttribute('data-theme', mode);
    root.classList.toggle('dark', mode === 'dark');
    root.classList.toggle('light', mode === 'light');
  }, [mode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('ec-theme', newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const value: ThemeContextValue = {
    mode,
    toggleMode,
    setMode,
    isDark:  mode === 'dark',
    isLight: mode === 'light',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

// ── Theme Toggle Button Component ─────────────────────────────────────────────

export function ThemeToggle({ className }: { className?: string }) {
  const { mode, toggleMode } = useTheme();

  return (
    <button
      onClick={toggleMode}
      className={className}
      aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
    >
      {mode === 'dark' ? (
        // Sun icon
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ) : (
        // Moon icon
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7z"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
}
