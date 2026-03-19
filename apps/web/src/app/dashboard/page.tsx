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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

interface RsvpEntry {
  rsvpId:    string;
  name:      string;
  email:     string;
  response:  string;
  message?:  string;
  createdAt: string;
}

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const { data: events, isLoading }            = useEvents();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();
  const router      = useRouter();

  const [showForm,    setShowForm]    = useState(false);
  const [title,       setTitle]       = useState('');
  const [date,        setDate]        = useState('');
  const [location,    setLocation]    = useState('');
  const [copiedId,    setCopiedId]    = useState<string | null>(null);
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

  async function toggleExpand(eventId: string) {
    if (expandedId === eventId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(eventId);
    if (!rsvps[eventId]) {
      setLoadingRsvp(eventId);
      try {
        const res = await apiClient.get(`/events/${eventId}/rsvp`);
        setRsvps(prev => ({ ...prev, [eventId]: res.data.data ?? [] }));
      } catch {
        setRsvps(prev => ({ ...prev, [eventId]: [] }));
      } finally {
        setLoadingRsvp(null);
      }
    }
  }

  const responseColor = (r: string) =>
    r === 'yes' ? 'var(--ec-success)' : r === 'no' ? 'var(--ec-danger)' : 'var(--ec-text-3)';
  const responseLabel = (r: string) =>
    r === 'yes' ? 'Yes' : r === 'no' ? 'No' : 'Maybe';

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
            {events.map(event => {
              const eventRsvps = rsvps[event.eventId] ?? [];
              const yesCount   = eventRsvps.filter(r => r.response === 'yes').length;
              const noCount    = eventRsvps.filter(r => r.response === 'no').length;
              const maybeCount = eventRsvps.filter(r => r.response === 'maybe').length;

              return (
                <div key={event.eventId} style={{ borderRadius: 'var(--ec-radius-lg)', border: '1px solid var(--ec-border)', background: 'var(--ec-surface)', overflow: 'hidden' }}>

                  {/* Main row */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ec-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.title}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginTop: 2 }}>
                        {new Date(event.eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        {event.location && <span> · {event.location}</span>}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <EcBadge status={event.status} />
                      <EcButton variant="secondary" size="sm" onClick={() => router.push(`/events/${event.eventId}/design`)}>
                        Design
                      </EcButton>
                      <EcButton
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(event.eventId)}
                        style={{ padding: '0 8px' }}
                      >
                        {expandedId === event.eventId ? 'Hide' : 'RSVP'}
                      </EcButton>
                      <EcButton
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteEvent.mutate(event.eventId)}
                        style={{ padding: '0 6px', color: 'var(--ec-text-3)' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path d="M2 3h9M5 3V2h3v1M4.5 3l.5 7.5M8.5 3l-.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      </EcButton>
                    </div>
                  </div>

                  {/* Expanded RSVP + Guest list */}
                  {expandedId === event.eventId && (
                    <div style={{ borderTop: '1px solid var(--ec-border)', background: 'var(--ec-surface-raised)' }}>

                      {/* RSVP Link */}
                      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ec-border)' }}>
                        <p style={{ fontSize: 11, color: 'var(--ec-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>RSVP Link</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <div style={{ flex: 1, padding: '7px 10px', background: 'var(--ec-bg)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-sm)', fontSize: 11, color: 'var(--ec-text-2)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {getRsvpUrl(event.eventId)}
                          </div>
                          <EcButton size="sm" variant={copiedId === event.eventId ? 'secondary' : 'ghost'} onClick={() => copyLink(event.eventId)} style={{ flexShrink: 0 }}>
                            {copiedId === event.eventId ? 'Copied' : 'Copy'}
                          </EcButton>
                          <EcButton size="sm" variant="ghost" onClick={() => router.push(`/rsvp/${event.eventId}`)} style={{ flexShrink: 0 }}>
                            Preview
                          </EcButton>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <EcButton size="sm" variant="ghost" onClick={async () => {
                            const QRCode = (await import('qrcode')).default;
                            const dataUrl = await QRCode.toDataURL(getRsvpUrl(event.eventId), { width: 300, margin: 2 });
                            const a = document.createElement('a');
                            a.href = dataUrl;
                            a.download = `qr-${event.title}.png`;
                            a.click();
                          }}>
                            Download QR
                          </EcButton>
                          <EcButton size="sm" variant="ghost" onClick={() => {
                            window.open(`https://wa.me/?text=${encodeURIComponent(`You're invited to ${event.title}! RSVP: ${getRsvpUrl(event.eventId)}`)}`, '_blank');
                          }}>
                            Share WhatsApp
                          </EcButton>
                        </div>
                      </div>

                      {/* Guest list */}
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <p style={{ fontSize: 11, color: 'var(--ec-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Guest List {eventRsvps.length > 0 && `(${eventRsvps.length})`}
                          </p>
                          {eventRsvps.length > 0 && (
                            <div style={{ display: 'flex', gap: 12 }}>
                              <span style={{ fontSize: 11, color: 'var(--ec-success)' }}>{yesCount} yes</span>
                              <span style={{ fontSize: 11, color: 'var(--ec-text-3)' }}>{maybeCount} maybe</span>
                              <span style={{ fontSize: 11, color: 'var(--ec-danger)' }}>{noCount} no</span>
                            </div>
                          )}
                        </div>

                        {loadingRsvp === event.eventId ? (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                            <div className="ec-spinner" />
                          </div>
                        ) : eventRsvps.length === 0 ? (
                          <p style={{ fontSize: 12, color: 'var(--ec-text-3)', textAlign: 'center', padding: '12px 0' }}>
                            No RSVPs yet — share the link above
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {eventRsvps.map(rsvp => (
                              <div key={rsvp.rsvpId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--ec-bg)', borderRadius: 'var(--ec-radius-md)', border: '1px solid var(--ec-border)' }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--ec-surface)', border: '1px solid var(--ec-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ec-text-2)' }}>
                                    {rsvp.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ec-text-1)' }}>{rsvp.name}</p>
                                  <p style={{ fontSize: 11, color: 'var(--ec-text-3)' }}>{rsvp.email}</p>
                                  {rsvp.message && (
                                    <p style={{ fontSize: 11, color: 'var(--ec-text-2)', marginTop: 2, fontStyle: 'italic' }}>"{rsvp.message}"</p>
                                  )}
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 500, color: responseColor(rsvp.response), flexShrink: 0 }}>
                                  {responseLabel(rsvp.response)}
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--ec-text-3)', flexShrink: 0 }}>
                                  {new Date(rsvp.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
