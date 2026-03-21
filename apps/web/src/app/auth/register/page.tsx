'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EcButton } from '@/components/ui/EcButton';
import { EcInput }  from '@/components/ui/EcInput';
import { LogoMark } from '@/components/ui/LogoMark';

export default function RegisterPage() {
  const { register, confirm, login } = useAuth();
  const router = useRouter();
  const [step,     setStep]     = useState<'register' | 'confirm'>('register');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [code,     setCode]     = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password);
      // Auto-confirm Lambda handles confirmation — go straight to login
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      // User is auto-confirmed but session not ready — redirect to login
      if (msg.toLowerCase().includes('already confirmed') || 
          msg.toLowerCase().includes('notauthorized') ||
          msg.toLowerCase().includes('user already exists')) {
        router.push('/auth/login');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await confirm(email, code);
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ec-auth-bg">
      <div className="ec-auth-card">
        <LogoMark />
        <div className="ec-card" style={{ padding: 32 }}>
          {step === 'register' ? (
            <>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em', marginBottom: 4 }}>
                  Create account
                </h1>
                <p style={{ fontSize: 13, color: 'var(--ec-text-2)' }}>Get started with EventCraft for free</p>
              </div>
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <EcInput label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                <EcInput label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 characters" required minLength={8} />
                {error && <div className="ec-error">{error}</div>}
                <EcButton type="submit" fullWidth loading={loading}>Create account</EcButton>
              </form>
              <div className="ec-divider" />
              <p style={{ fontSize: 12, color: 'var(--ec-text-3)', textAlign: 'center' }}>
                Already have an account?{' '}
                <Link href="/auth/login" style={{ color: 'var(--ec-brand)', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
              </p>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--ec-success-bg)', border: '1px solid var(--ec-success-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5L6.5 12L13 4" stroke="var(--ec-success)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em', marginBottom: 4 }}>Check your email</h1>
                <p style={{ fontSize: 13, color: 'var(--ec-text-2)' }}>
                  We sent a 6-digit code to <strong style={{ color: 'var(--ec-text-1)' }}>{email}</strong>
                </p>
              </div>
              <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <EcInput label="Confirmation code" type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="123456" required />
                {error && <div className="ec-error">{error}</div>}
                <EcButton type="submit" fullWidth loading={loading}>Verify email</EcButton>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
