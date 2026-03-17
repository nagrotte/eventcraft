'use client';

import { useParams } from 'next/navigation';
import { EcNav } from '@/components/ui/EcNav';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CanvasShell } from '@/components/canvas/CanvasShell';

export default function DesignPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ec-bg)' }}>
      <div className="ec-spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg)', display: 'flex', flexDirection: 'column' }}>
      <EcNav email={user?.email} />
      <CanvasShell eventId={eventId} />
    </div>
  );
}
