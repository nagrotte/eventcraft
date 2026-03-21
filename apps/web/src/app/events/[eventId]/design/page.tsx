'use client';

import { useParams } from 'next/navigation';
import { EcNav }     from '@/components/ui/EcNav';
import { useAuth }   from '@/hooks/useAuth';
import { useEvent }  from '@/hooks/useEvents';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CanvasShell }   from '@/components/canvas/CanvasShell';
import { DesignWizard }  from '@/components/canvas/DesignWizard';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

export default function DesignPage() {
  const { eventId }       = useParams<{ eventId: string }>();
  const { user, loading } = useAuth();
  const { data: event }   = useEvent(eventId);
  const router            = useRouter();
  const isMobile          = useIsMobile();

  const [showWizard,   setShowWizard]   = useState(false);
  const [wizardPrompt, setWizardPrompt] = useState<string | null>(null);
  const [wizardDone,   setWizardDone]   = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!eventId) return;
    const key = `wizard-shown-${eventId}`;
    const alreadyShown = sessionStorage.getItem(key);
    if (!alreadyShown) setShowWizard(true);
    else setWizardDone(true);
  }, [eventId]);

  function handleWizardComplete(prompt: string) {
    sessionStorage.setItem(`wizard-shown-${eventId}`, '1');
    setWizardPrompt(prompt);
    setShowWizard(false);
    setWizardDone(true);
  }

  function handleWizardSkip() {
    sessionStorage.setItem(`wizard-shown-${eventId}`, '1');
    setWizardPrompt(null);
    setShowWizard(false);
    setWizardDone(true);
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ec-bg)' }}>
      <div className="ec-spinner" />
    </div>
  );

  // Still detecting screen size — show spinner
  if (isMobile === null) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ec-bg)' }}>
      <div className="ec-spinner" />
    </div>
  );

  // Mobile block screen
  if (isMobile) return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg)', display: 'flex', flexDirection: 'column' }}>
      <EcNav
        email={user?.email}
        breadcrumbs={[
          { label: 'Events', href: '/dashboard' },
          { label: event?.title ?? 'Event', href: '/dashboard' },
          { label: 'Design' },
        ]}
      />
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>🖥️</div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ec-text-1)', marginBottom: 12 }}>
          Desktop required
        </h2>
        <p style={{ fontSize: 14, color: 'var(--ec-text-2)', maxWidth: 280, lineHeight: 1.6, marginBottom: 8 }}>
          The canvas editor works best on a laptop or desktop.
        </p>
        <p style={{ fontSize: 13, color: 'var(--ec-text-3)', maxWidth: 280, lineHeight: 1.6, marginBottom: 28 }}>
          Open <strong>eventcraft.irotte.com</strong> on your computer to design your invitation.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            padding: '12px 28px', background: 'var(--ec-brand)', color: '#fff',
            border: 'none', borderRadius: 'var(--ec-radius-md)', fontSize: 14,
            fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Back to Events
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg)', display: 'flex', flexDirection: 'column' }}>
      <EcNav
        email={user?.email}
        breadcrumbs={[
          { label: 'Events', href: '/dashboard' },
          { label: event?.title ?? 'Event', href: '/dashboard' },
          { label: 'Design' },
        ]}
      />
      {wizardDone && (
        <CanvasShell
          eventId={eventId}
          eventTitle={event?.title}
          eventDate={event?.eventDate}
          eventLocation={event?.location}
          initialPrompt={wizardPrompt}
        />
      )}
      {showWizard && (
        <DesignWizard
          eventTitle={event?.title}
          eventDate={event?.eventDate}
          eventLocation={event?.location}
          onComplete={handleWizardComplete}
          onSkip={handleWizardSkip}
        />
      )}
    </div>
  );
}
