'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useEvents, useCreateEvent, useDeleteEvent } from '@/hooks/useEvents';
import { EcNav } from '@/components/ui/EcNav';
import { EcButton } from '@/components/ui/EcButton';
import { EcInput } from '@/components/ui/EcInput';
import { EcBadge } from '@/components/ui/EcBadge';
import apiClient from '@/lib/api-client';
import { useEffect } from 'react';

interface RsvpEntry { name: string; email: string; response: string; message?: string; createdAt: string; }

export default function DashboardPage() {
  const { user, loading: authLoading, logout, isAdmin } = useAuth();
  const router = useRouter();
  const { data: events = [], isLoading } = useEvents();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();

  const [showCreate, setShowCreate] = useState(false);
  const [title,      setTitle]      = useState('');
  const [eventDate,  setEventDate]  = useState('');
  const [location,   setLocation]   = useState('');
  const [creating,   setCreating]   = useState(false);
  const [createErr,  setCreateErr]  = useState('');

  const [expandedRsvp, setExpandedRsvp] = useState<string | null>(null);
  const [rsvpData,     setRsvpData]     = useState<Record<string, RsvpEntry[]>>({});
  const [rsvpLoading,  setRsvpLoading]  = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading, router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !eventDate) { setCreateErr('Title and date are required'); return; }
    setCreating(true); setCreateErr('');
    try {
      const ev = await createEvent.mutateAsync({ title, eventDate, location: location || undefined });
      setShowCreate(false); setTitle(''); setEventDate(''); setLocation('');
      router.push(`/events/${ev.eventId}/design`);
    } catch { setCreateErr('Failed to create event'); }
    finally { setCreating(false); }
  }

  async function loadRsvps(eventId: string) {
    if (expandedRsvp === eventId) { setExpandedRsvp(null); return; }
    setRsvpLoading(eventId);
    try {
      const res = await apiClient.get(`/events/${eventId}/rsvp`);
      setRsvpData(prev => ({ ...prev, [eventId]: res.data.data ?? [] }));
      setExpandedRsvp(eventId);
    } catch { } finally { setRsvpLoading(null); }
  }

  async function copyRsvpLink(eventId: string) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eventcraft.irotte.com';
    await navigator.clipboard.writeText(`${appUrl}/rsvp/${eventId}`);
  }

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ec-bg)' }}>
      <div className="ec-spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg)' }}>
      <EcNav email={user?.email} isAdmin={isAdmin} onLogout={logout} />
      <main className="ec-page">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em', marginBottom: 4 }}>
              Events
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ec-text-3)' }}>
              {events.length} event{events.length !== 1 ? 's' : ''}
            </p>
          </div>
          <EcButton onClick={() => setShowCreate(!showCreate)}>+ New event</EcButton>
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{ background: 'var(--ec-surface)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-lg)', padding: 20, marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ec-text-1)', marginBottom: 14 }}>New Event</p>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <EcInput label="Event title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ganesh Chaturthi Celebration" required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <EcInput label="Date & time" type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
                <EcInput label="Location (optional)" value={location} onChange={e => setLocation(e.target.value)} placeholder="Katy, TX" />
              </div>
              {createErr && <p style={{ fontSize: 12, color: 'var(--ec-danger)' }}>{createErr}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <EcButton type="submit" size="sm" loading={creating}>Create & Design</EcButton>
                <EcButton type="button" size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</EcButton>
              </div>
            </form>
          </div>
        )}

        {/* Event list */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="ec-spinner" /></div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 20px', background: 'var(--ec-surface)', borderRadius: 'var(--ec-radius-lg)', border: '1px solid var(--ec-border)' }}>
            <p style={{ fontSize: 15, color: 'var(--ec-text-2)', marginBottom: 8 }}>No events yet</p>
            <p style={{ fontSize: 13, color: 'var(--ec-text-3)' }}>Create your first event to get started</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.map(ev => {
              const isExpanded = expandedRsvp === ev.eventId;
              const rsvps      = rsvpData[ev.eventId] ?? [];
              const counts     = { yes: rsvps.filter(r => r.response === 'yes').length, no: rsvps.filter(r => r.response === 'no').length, maybe: rsvps.filter(r => r.response === 'maybe').length };
              const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eventcraft.irotte.com';
              const micrositeUrl = ev.micrositeSlug ? `${appUrl}/e/${ev.micrositeSlug}` : null;

              return (
                <div key={ev.eventId} style={{ background: 'var(--ec-surface)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-lg)', overflow: 'hidden' }}>
                  {/* Event row */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ec-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.title}
                        </p>
                        <EcBadge status={ev.status === 'published' ? 'published' : 'draft'} />
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--ec-text-3)' }}>
                        {new Date(ev.eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        {ev.location ? ` · ${ev.location}` : ''}
                        {micrositeUrl ? ` · ${appUrl}/e/${ev.micrositeSlug}` : ''}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <EcButton size="sm" onClick={() => router.push(`/events/${ev.eventId}/design`)}>Design</EcButton>
                      <EcButton size="sm" variant="ghost" onClick={() => router.push(`/events/${ev.eventId}/invite`)}>Invite</EcButton>
                      <EcButton size="sm" variant="ghost" onClick={() => router.push(`/events/${ev.eventId}/settings`)}>Settings</EcButton>
                      <EcButton size="sm" variant="ghost" loading={rsvpLoading === ev.eventId} onClick={() => loadRsvps(ev.eventId)}>
                        RSVP {rsvps.length > 0 ? `(${rsvps.length})` : ''}
                      </EcButton>
                      <button
                        onClick={() => { if (confirm('Delete this event?')) deleteEvent.mutate(ev.eventId); }}
                        style={{ background: 'none', border: 'none', color: 'var(--ec-text-3)', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}
                      >×</button>
                    </div>
                  </div>

                  {/* RSVP panel */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--ec-border)', padding: 16, background: 'var(--ec-bg)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ec-text-2)' }}>Guest Responses</p>
                        <span style={{ fontSize: 11, color: 'var(--ec-success)' }}>✓ {counts.yes} yes</span>
                        <span style={{ fontSize: 11, color: 'var(--ec-text-3)' }}>? {counts.maybe} maybe</span>
                        <span style={{ fontSize: 11, color: 'var(--ec-danger)' }}>✗ {counts.no} no</span>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                          <EcButton size="sm" variant="ghost" onClick={() => copyRsvpLink(ev.eventId)}>Copy RSVP link</EcButton>
                          {micrositeUrl && (
                            <EcButton size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(micrositeUrl)}>Copy microsite</EcButton>
                          )}
                        </div>
                      </div>
                      {rsvps.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--ec-text-3)' }}>No RSVPs yet</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {rsvps.map((r, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--ec-surface)', borderRadius: 'var(--ec-radius-sm)', border: '1px solid var(--ec-border)' }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--ec-surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ec-text-2)' }}>{r.name.charAt(0)}</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ec-text-1)' }}>{r.name}</p>
                                <p style={{ fontSize: 11, color: 'var(--ec-text-3)' }}>{r.email}</p>
                              </div>
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: r.response === 'yes' ? 'var(--ec-success-bg)' : r.response === 'no' ? 'var(--ec-danger-bg)' : 'var(--ec-warning-bg)', color: r.response === 'yes' ? 'var(--ec-success)' : r.response === 'no' ? 'var(--ec-danger)' : 'var(--ec-warning)', border: `1px solid ${r.response === 'yes' ? 'var(--ec-success-border)' : r.response === 'no' ? 'var(--ec-danger-border)' : 'var(--ec-warning-border)'}` }}>
                                {r.response}
                              </span>
                              {r.message && <p style={{ fontSize: 11, color: 'var(--ec-text-3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.message}</p>}
                            </div>
                          ))}
                        </div>
                      )}
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
