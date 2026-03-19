'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEvents, useCreateEvent, useDeleteEvent } from '@/hooks/useEvents';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EcNav }    from '@/components/ui/EcNav';
import { EcButton } from '@/components/ui/EcButton';
import { EcInput }  from '@/components/ui/EcInput';
import { EcBadge }  from '@/components/ui/EcBadge';
import apiClient from '@/lib/api-client';


interface RsvpEntry {
  rsvpId:    string;
  name:      string;
  email:     string;
  response:  string;
  message?:  string;
  createdAt: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [rsvps,       setRsvps]       = useState<Record<string, RsvpEntry[]>>({});
  const [loadingRsvp, setLoadingRsvp] = useState<string | null>(null);

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

  function getRsvpUrl(eventId: string) {
    return `${APP_URL}/rsvp/${eventId}`;
  }

  async function copyLink(eventId: string) {
    await navigator.clipboard.writeText(getRsvpUrl(eventId));
    setCopiedId(eventId);
    setTimeout(() => setCopiedId(null), 2000);
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

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em' }}>Events</h1>
            <p style={{ fontSize: 13, color: 'var(--ec-text-3)', marginTop: 4 }}>
              {events?.length ?? 0} event{events?.length !== 1 ? 's' : ''}
            </p>
          </div>
          <EcButton onClick={() => setShowForm(!showForm)}>New event</EcButton>
        </div>

        {showForm && (
          <div className="ec-card-raised" style={{ padding: 20, marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--ec-text-2)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              New event
            </p>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <EcInput placeholder="Event title" value={title} onChange={e => setTitle(e.target.value)} required />
              <div style={{ display: 'flex', gap: 10 }}>
                <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} required className="ec-input" style={{ flex: 1 }} />
                <EcInput placeholder="Location (optional)" value={location} onChange={e => setLocation(e.target.value)} style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <EcButton type="submit" loading={createEvent.isPending}>Create event</EcButton>
                <EcButton type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</EcButton>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
            <div className="ec-spinner" />
          </div>
        ) : !events || events.length === 0 ? (
          <div className="ec-empty">
            <p style={{ fontSize: 14, color: 'var(--ec-text-2)', fontWeight: 500 }}>No events yet</p>
            <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginTop: 4 }}>Click "New event" to get started</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.map(event => (
              <div key={event.eventId} style={{ borderRadius: 'var(--ec-radius-lg)', border: '1px solid var(--ec-border)', background: 'var(--ec-surface)', overflow: 'hidden' }}>

                {/* Main row */}
                <div className="ec-row" style={{ border: 'none' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ec-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {event.title}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginTop: 2 }}>
                      {new Date(event.eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      {event.location && <span> · {event.location}</span>}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                    <EcBadge status={event.status} />
                    <EcButton variant="secondary" size="sm" onClick={() => router.push(`/events/${event.eventId}/design`)}>
                      Design
                    </EcButton>
                    <EcButton
                      variant="ghost" size="sm"
                      onClick={() => { toggleExpand(event.eventId); }}
                      title="RSVP & links"
                      style={{ padding: '0 8px' }}
                    >
                      {expandedId === event.eventId ? '▲' : '▼'}
                    </EcButton>
                    <EcButton
                      variant="ghost" size="sm"
                      onClick={() => deleteEvent.mutate(event.eventId)}
                      style={{ padding: '0 6px', color: 'var(--ec-text-3)' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M2 3h9M5 3V2h3v1M4.5 3l.5 7.5M8.5 3l-.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    </EcButton>
                  </div>
                </div>

                {/* Expanded RSVP panel */}
                {expandedId === event.eventId && (
                  <div style={{ padding: '12px 16px 14px', borderTop: '1px solid var(--ec-border)', background: 'var(--ec-surface-raised)' }}>
                    <p style={{ fontSize: 11, color: 'var(--ec-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                      RSVP Link
                    </p>

                    {/* Link display */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{
                        flex: 1, padding: '7px 10px', background: 'var(--ec-bg)',
                        border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-sm)',
                        fontSize: 11, color: 'var(--ec-text-2)', fontFamily: 'monospace',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {getRsvpUrl(event.eventId)}
                      </div>
                      <EcButton
                        size="sm"
                        variant={copiedId === event.eventId ? 'secondary' : 'ghost'}
                        onClick={() => copyLink(event.eventId)}
                        style={{ flexShrink: 0 }}
                      >
                        {copiedId === event.eventId ? '✓ Copied' : 'Copy'}
                      </EcButton>
                      <EcButton
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/rsvp/${event.eventId}`)}
                        style={{ flexShrink: 0 }}
                      >
                        Preview
                      </EcButton>
                    </div>

                    {/* Quick actions */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <EcButton
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const QRCode = (await import('qrcode')).default;
                          const dataUrl = await QRCode.toDataURL(getRsvpUrl(event.eventId), { width: 300, margin: 2 });
                          const a = document.createElement('a');
                          a.href = dataUrl;
                          a.download = `qr-${event.title}.png`;
                          a.click();
                        }}
                      >
                        ⊞ Download QR
                      </EcButton>
                      <EcButton
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const whatsapp = `https://wa.me/?text=${encodeURIComponent(`You're invited to ${event.title}! RSVP here: ${getRsvpUrl(event.eventId)}`)}`;
                          window.open(whatsapp, '_blank');
                        }}
                      >
                        Share via WhatsApp
                      </EcButton>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
