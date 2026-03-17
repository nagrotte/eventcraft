'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EcButton } from '@/components/ui/EcButton';
import { EcInput }  from '@/components/ui/EcInput';
import { LogoMark } from '@/components/ui/LogoMark';

export default function LoginPage() {
  const { login } = useAuth();
  const router    = useRouter();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ec-auth-bg">
      <div className="ec-auth-card">

        <LogoMark />

        <div className="ec-card" style={{ padding: 32 }}>

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em', marginBottom: 4 }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ec-text-2)' }}>
              Sign in to your account
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <EcInput
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
            />
            <EcInput
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />

            {error && <div className="ec-error">{error}</div>}

            <EcButton type="submit" fullWidth loading={loading}>
              Sign in
            </EcButton>
          </form>

          <div className="ec-divider" />

          <p style={{ fontSize: 12, color: 'var(--ec-text-3)', textAlign: 'center' }}>
            No account?{' '}
            <Link href="/auth/register" style={{ color: 'var(--ec-brand)', textDecoration: 'none', fontWeight: 500 }}>
              Create one for free
            </Link>
          </p>

        </div>

        <p style={{ fontSize: 11, color: 'var(--ec-text-3)', textAlign: 'center', marginTop: 20 }}>
          By signing in you agree to our Terms and Privacy Policy
        </p>

      </div>
    </div>
  );
}
