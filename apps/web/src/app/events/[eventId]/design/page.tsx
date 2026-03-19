'use client';

import { useParams } from 'next/navigation';
import { EcNav }       from '@/components/ui/EcNav';
import { useAuth }     from '@/hooks/useAuth';
import { useEvent }    from '@/hooks/useEvents';
import { useRouter }   from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { CanvasShell }   from '@/components/canvas/CanvasShell';
import { DesignWizard }  from '@/components/canvas/DesignWizard';

export default function DesignPage() {
  const { eventId }       = useParams<{ eventId: string }>();
  const { user, loading } = useAuth();
  const { data: event }   = useEvent(eventId);
  const router            = useRouter();

  // Show wizard only on first visit (no saved design)
  const [showWizard,    setShowWizard]    = useState(false);
  const [wizardPrompt,  setWizardPrompt]  = useState<string | null>(null);
  const [wizardChecked, setWizardChecked] = useState(false);
  const hasDesignRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  // Check if event has an existing design
  useEffect(() => {
    if (!eventId || wizardChecked) return;
    async function checkDesign() {
      try {
        const { default: apiClient } = await import('@/lib/api-client');
        const res = await apiClient.get(`/events/${eventId}/design`);
        const hasExisting = !!res.data?.data?.canvasJson;
        hasDesignRef.current = hasExisting;
        // Only show wizard if no existing design
        setShowWizard(!hasExisting);
      } catch {
        setShowWizard(true);
      } finally {
        setWizardChecked(true);
      }
    }
    checkDesign();
  }, [eventId, wizardChecked]);

  function handleWizardComplete(prompt: string) {
    setWizardPrompt(prompt);
    setShowWizard(false);
  }

  function handleWizardSkip() {
    setWizardPrompt(null);
    setShowWizard(false);
  }

  if (loading || !wizardChecked) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ec-bg)' }}>
      <div className="ec-spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg)', display: 'flex', flexDirection: 'column' }}>
      <EcNav
        email={user?.email}
        breadcrumbs={[
          { label: 'Events',  href: '/dashboard' },
          { label: event?.title ?? 'Event', href: '/dashboard' },
          { label: 'Design' },
        ]}
      />
      <CanvasShell
        eventId={eventId}
        eventTitle={event?.title}
        eventDate={event?.eventDate}
        eventLocation={event?.location}
        initialPrompt={wizardPrompt}
      />

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
