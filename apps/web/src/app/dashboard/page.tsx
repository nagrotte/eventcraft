'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEvents, useCreateEvent, useDeleteEvent } from '@/hooks/useEvents';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EcNav }    from '@/components/ui/EcNav';
import { EcButton } from '@/components/ui/EcButton';
import { EcInput }  from '@/components/ui/EcInput';
import { EcBadge }  from '@/components/ui/EcBadge';

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const { data: events, isLoading }            = useEvents();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();
  const router      = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [title,    setTitle]    = useState('');
  const [date,     setDate]     = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading, router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createEvent.mutateAsync({
      title,
      eventDate: new Date(date).toISOString(),
      location:  location || undefined
    });
    setTitle(''); setDate(''); setLocation('');
    setShowForm(false);
  }

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ec-bg)' }}>
      <div className="ec-spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg)' }}>
      <EcNav email={user?.email} onLogout={logout} />

      <main className="ec-page">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em' }}>
              Events
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ec-text-3)', marginTop: 4 }}>
              {events?.length ?? 0} event{events?.length !== 1 ? 's' : ''}
            </p>
          </div>
          <EcButton onClick={() => setShowForm(!showForm)}>
            New event
          </EcButton>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="ec-card-raised" style={{ padding: 20, marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--ec-text-2)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              New event
            </p>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <EcInput
                placeholder="Event title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="datetime-local"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                  className="ec-input"
                  style={{ flex: 1 }}
                />
                <EcInput
                  placeholder="Location (optional)"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <EcButton type="submit" loading={createEvent.isPending}>
                  Create event
                </EcButton>
                <EcButton type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </EcButton>
              </div>
            </form>
          </div>
        )}

        {/* Events list */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
            <div className="ec-spinner" />
          </div>
        ) : !events || events.length === 0 ? (
          <div className="ec-empty">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ marginBottom: 12, opacity: 0.3 }}>
              <rect x="4" y="6" width="24" height="22" rx="3" stroke="var(--ec-text-2)" strokeWidth="1.5"/>
              <path d="M10 4v4M22 4v4M4 12h24" stroke="var(--ec-text-2)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p style={{ fontSize: 14, color: 'var(--ec-text-2)', fontWeight: 500 }}>No events yet</p>
            <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginTop: 4 }}>Click "New event" to get started</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {events.map(event => (
              <div key={event.eventId} className="ec-row">
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ec-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {event.title}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginTop: 2 }}>
                    {new Date(event.eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    {event.location && <span style={{ color: 'var(--ec-text-3)' }}> · {event.location}</span>}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 16 }}>
                  <EcBadge status={event.status} />
                  <EcButton
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteEvent.mutate(event.eventId)}
                    title="Delete event"
                    style={{ padding: '0 6px', color: 'var(--ec-text-3)' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M2 3h9M5 3V2h3v1M4.5 3l.5 7.5M8.5 3l-.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  </EcButton>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
