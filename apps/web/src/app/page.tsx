'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) router.push('/dashboard');
      else router.push('/auth/login');
    }
  }, [user, loading, router]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="ec-spinner" />
    </div>
  );
}
