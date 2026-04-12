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

interface RsvpEntry {
  rsvpId:     string;
  name:       string;
  email:      string;
  response:   string;
  message?:   string;
  createdAt:  string;
  guestCount: number;
}

type ReminderAudience = 'yes' | 'yes_maybe' | 'specific';

interface MessageModal {
  eventId:    string;
  title:      string;
  rsvps:      RsvpEntry[];
  isFollowup: boolean;
}

interface ReminderModal {
  eventId:  string;
  title:    string;
  rsvps:    RsvpEntry[];
}

export default function DashboardPage() {
  const { user, loading: authLoading, logout, isAdmin } = useAuth();
  const router = useRouter();
  const { data: events = [], isLoading } = useEvents();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();

  const [showCreate,   setShowCreate]   = useState(false);
  const [title,        setTitle]        = useState('');
  const [eventDate,    setEventDate]    = useState('');
  const [location,     setLocation]     = useState('');
  const [creating,     setCreating]     = useState(false);
  const [createErr,    setCreateErr]    = useState('');
  const [expandedRsvp, setExpandedRsvp] = useState<string | null>(null);
  const [rsvpData,     setRsvpData]     = useState<Record<string, RsvpEntry[]>>({});
  const [rsvpLoading,  setRsvpLoading]  = useState<string | null>(null);
  const [deletingRsvp, setDeletingRsvp] = useState<string | null>(null);
  const [reminderToast, setReminderToast] = useState<string | null>(null);
  const [duplicating,   setDuplicating]   = useState<string | null>(null);

  // Reminder modal state
  const [reminderModal,    setReminderModal]    = useState<ReminderModal | null>(null);
  const [reminderAudience, setReminderAudience] = useState<ReminderAudience>('yes');
  const [selectedRsvpIds,  setSelectedRsvpIds]  = useState<Set<string>>(new Set());
  const [guestSearch,      setGuestSearch]      = useState('');
  const [reminderSending,  setReminderSending]  = useState(false);
  const [loadingReminderRsvps, setLoadingReminderRsvps] = useState(false);
  const [messageModal,    setMessageModal]    = useState<MessageModal | null>(null);
  const [msgSubject,      setMsgSubject]      = useState('');
  const [msgBody,         setMsgBody]         = useState('');
  const [msgAudience,     setMsgAudience]     = useState<ReminderAudience>('yes');
  const [msgSending,      setMsgSending]      = useState(false);
  const [loadingMsgRsvps, setLoadingMsgRsvps] = useState(false);

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

  async function deleteRsvp(eventId: string, rsvpId: string) {
    if (!confirm('Remove this RSVP?')) return;
    setDeletingRsvp(rsvpId);
    try {
      await apiClient.delete(`/events/${eventId}/rsvp/${rsvpId}`);
      setRsvpData(prev => ({
        ...prev,
        [eventId]: (prev[eventId] ?? []).filter(r => r.rsvpId !== rsvpId)
      }));
    } catch { alert('Failed to delete RSVP'); }
    finally { setDeletingRsvp(null); }
  }

  async function duplicateEvent(eventId: string) {
    if (!confirm('Duplicate this event as a new draft?')) return;
    setDuplicating(eventId);
    try {
      const res = await apiClient.post(`/events/${eventId}/duplicate`, {});
      const newEvent = res.data?.data;
      setReminderToast(`Event duplicated! Redirecting to settings...`);
      setTimeout(() => {
        setReminderToast(null);
        if (newEvent?.eventId) router.push(`/events/${newEvent.eventId}/settings`);
      }, 1500);
    } catch { alert('Failed to duplicate event'); }
    finally { setDuplicating(null); }
  }

  async function openMessageModal(eventId: string, eventTitle: string, isFollowup: boolean) {
    setLoadingMsgRsvps(true);
    setMsgAudience('yes');
    setMsgSubject(isFollowup ? `Thank you for joining ${eventTitle}!` : '');
    setMsgBody(isFollowup ? `Dear {name},\n\nThank you so much for joining us at ${eventTitle}. It was a pleasure having you with us!\n\nWe hope to see you again soon.` : '');
    try {
      let rsvps = rsvpData[eventId];
      if (!rsvps) {
        const res = await apiClient.get(`/events/${eventId}/rsvp`);
        rsvps = res.data.data ?? [];
        setRsvpData(prev => ({ ...prev, [eventId]: rsvps! }));
      }
      setMessageModal({ eventId, title: eventTitle, rsvps, isFollowup });
    } catch { alert('Failed to load RSVPs'); }
    finally { setLoadingMsgRsvps(false); }
  }

  async function sendMessage() {
    if (!messageModal) return;
    if (!msgSubject.trim() || !msgBody.trim()) { alert('Subject and message are required'); return; }
    setMsgSending(true);
    try {
      const res = await apiClient.post(`/events/${messageModal.eventId}/messages/send`, {
        subject:     msgSubject,
        body:        msgBody,
        audience:    msgAudience,
        triggerType: messageModal.isFollowup ? 'followup' : 'manual',
      });
      const { sent, failed } = res.data?.data ?? {};
      setMessageModal(null);
      setReminderToast(`Message sent to ${sent?.length ?? 0} guests${failed?.length ? `, ${failed.length} failed` : ''}`);
      setTimeout(() => setReminderToast(null), 5000);
    } catch { alert('Failed to send message'); }
    finally { setMsgSending(false); }
  }

  async function openReminderModal(eventId: string, eventTitle: string) {
    setLoadingReminderRsvps(true);
    setReminderAudience('yes');
    setGuestSearch('');
    try {
      let rsvps = rsvpData[eventId];
      if (!rsvps) {
        const res = await apiClient.get(`/events/${eventId}/rsvp`);
        rsvps = res.data.data ?? [];
        setRsvpData(prev => ({ ...prev, [eventId]: rsvps! }));
      }
      const defaultSelected = new Set(rsvps.filter(r => r.response === 'yes').map(r => r.rsvpId));
      setSelectedRsvpIds(defaultSelected);
      setReminderModal({ eventId, title: eventTitle, rsvps });
    } catch { alert('Failed to load RSVPs'); }
    finally { setLoadingReminderRsvps(false); }
  }

  function closeReminderModal() {
    setReminderModal(null);
    setReminderAudience('yes');
    setSelectedRsvpIds(new Set());
    setGuestSearch('');
  }

  function toggleRsvpSelection(rsvpId: string) {
    setSelectedRsvpIds(prev => {
      const next = new Set(prev);
      next.has(rsvpId) ? next.delete(rsvpId) : next.add(rsvpId);
      return next;
    });
  }

  function selectQuick(type: 'all' | 'yes' | 'yes_maybe' | 'none') {
    if (!reminderModal) return;
    const ids = reminderModal.rsvps
      .filter(r => {
        if (type === 'all')      return true;
        if (type === 'none')     return false;
        if (type === 'yes')      return r.response === 'yes';
        if (type === 'yes_maybe') return r.response === 'yes' || r.response === 'maybe';
        return false;
      })
      .map(r => r.rsvpId);
    setSelectedRsvpIds(new Set(ids));
  }

  async function sendReminder() {
    if (!reminderModal) return;
    setReminderSending(true);
    try {
      const body: { audience: string; rsvpIds?: string[] } =
        reminderAudience === 'specific'
          ? { audience: 'specific', rsvpIds: Array.from(selectedRsvpIds) }
          : { audience: reminderAudience };

      const res = await apiClient.post(`/events/${reminderModal.eventId}/reminders/send`, body);
      const { sent, failed } = res.data?.data ?? res.data ?? {};
      closeReminderModal();
      setReminderToast(`Reminder sent to ${sent?.length ?? 0} guests${failed?.length ? `, ${failed.length} failed` : ''}`);
      setTimeout(() => setReminderToast(null), 5000);
    } catch { alert('Failed to send reminders'); }
    finally { setReminderSending(false); }
  }

  async function copyRsvpLink(eventId: string) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eventcraft.irotte.com';
    await navigator.clipboard.writeText(`${appUrl}/rsvp/${eventId}`);
  }

  // Computed values for reminder modal
  const filteredRsvps = reminderModal?.rsvps.filter(r =>
    !guestSearch || r.name.toLowerCase().includes(guestSearch.toLowerCase()) || r.email.toLowerCase().includes(guestSearch.toLowerCase())
  ) ?? [];

  const audienceCounts = reminderModal ? {
    yes:      reminderModal.rsvps.filter(r => r.response === 'yes').length,
    yes_maybe: reminderModal.rsvps.filter(r => r.response === 'yes' || r.response === 'maybe').length,
    specific: selectedRsvpIds.size,
  } : { yes: 0, yes_maybe: 0, specific: 0 };

  const expectedAttendees = reminderAudience === 'specific'
    ? reminderModal?.rsvps.filter(r => selectedRsvpIds.has(r.rsvpId)).reduce((s, r) => s + (r.guestCount ?? 1), 0) ?? 0
    : reminderModal?.rsvps
        .filter(r => reminderAudience === 'yes' ? r.response === 'yes' : r.response === 'yes' || r.response === 'maybe')
        .reduce((s, r) => s + (r.guestCount ?? 1), 0) ?? 0;

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ec-bg)' }}>
      <div className="ec-spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg)' }}>
      <EcNav email={user?.email} isAdmin={isAdmin} onLogout={logout} />
      <main className="ec-page">

        {/* Reminder toast */}
        {reminderToast && (
          <div style={{ background: 'var(--ec-success-bg)', color: 'var(--ec-success)', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, border: '1px solid var(--ec-success-border)' }}>
            {reminderToast}
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em', marginBottom: 4 }}>Events</h1>
            <p style={{ fontSize: 13, color: 'var(--ec-text-3)' }}>{events.length} event{events.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => router.push('/beta/ai-planner')}
              style={{ fontSize: 11, padding: '5px 12px', borderRadius: 99, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.08)', color: '#818cf8', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, letterSpacing: '0.04em' }}>
              ✨ AI Planner (Beta)
            </button>
            <EcButton onClick={() => setShowCreate(!showCreate)}>+ New event</EcButton>
          </div>
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
              const isExpanded   = expandedRsvp === ev.eventId;
              const rsvps        = rsvpData[ev.eventId] ?? [];
              const yesRsvps     = rsvps.filter(r => r.response === 'yes');
              const counts       = { yes: yesRsvps.length, no: rsvps.filter(r => r.response === 'no').length, maybe: rsvps.filter(r => r.response === 'maybe').length };
              const totalGuests  = rsvps.reduce((sum, r) => sum + (r.guestCount ?? 1), 0);
              const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eventcraft.irotte.com';
              const micrositeUrl = ev.micrositeSlug ? `${appUrl}/e/${ev.micrositeSlug}` : null;

              return (
                <div key={ev.eventId} style={{ background: 'var(--ec-surface)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ec-text-1)', margin: 0 }}>{ev.title}</p>
                          <EcBadge status={ev.status === 'published' ? 'published' : 'draft'} />
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--ec-text-3)', margin: 0 }}>
                          {new Date(ev.eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          {ev.location ? ` · ${ev.location}` : ''}
                          {micrositeUrl ? ` · ${appUrl}/e/${ev.micrositeSlug}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => { if (confirm('Delete this event?')) deleteEvent.mutate(ev.eventId); }}
                        style={{ background: 'none', border: 'none', color: 'var(--ec-text-3)', cursor: 'pointer', fontSize: 18, padding: '0 4px', flexShrink: 0 }}
                      >×</button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <EcButton size="sm" onClick={() => router.push(`/events/${ev.eventId}/design`)}>Design</EcButton>
                      <EcButton size="sm" variant="ghost" onClick={() => router.push(`/events/${ev.eventId}/invite`)}>Invite</EcButton>
                      <EcButton size="sm" variant="ghost" onClick={() => router.push(`/events/${ev.eventId}/settings`)}>Settings</EcButton>
                      <EcButton size="sm" variant="ghost" loading={duplicating === ev.eventId} onClick={() => duplicateEvent(ev.eventId)}>Duplicate</EcButton>
                      <EcButton size="sm" variant="ghost" onClick={() => router.push(`/events/${ev.eventId}/checkin`)}>Check-in</EcButton>
                      <EcButton size="sm" variant="ghost" loading={rsvpLoading === ev.eventId} onClick={() => loadRsvps(ev.eventId)}>
                        RSVPs {rsvps.length > 0 ? `(${rsvps.length})` : ''}
                      </EcButton>
                      <EcButton size="sm" variant="ghost" loading={loadingReminderRsvps} onClick={() => openReminderModal(ev.eventId, ev.title)}>Remind</EcButton>
                      <EcButton size="sm" variant="ghost" loading={loadingMsgRsvps} onClick={() => openMessageModal(ev.eventId, ev.title, false)}>Message</EcButton>
                      <EcButton size="sm" variant="ghost" onClick={() => openMessageModal(ev.eventId, ev.title, true)}>Follow-up</EcButton>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--ec-border)', padding: 16, background: 'var(--ec-bg)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ec-text-2)' }}>Guest Responses</p>
                        <span style={{ fontSize: 11, color: 'var(--ec-success)' }}>✓ {counts.yes} yes</span>
                        <span style={{ fontSize: 11, color: 'var(--ec-text-3)' }}>? {counts.maybe} maybe</span>
                        <span style={{ fontSize: 11, color: 'var(--ec-danger)' }}>✗ {counts.no} no</span>
                        {rsvps.length > 0 && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'var(--ec-brand-subtle)', color: 'var(--ec-brand)', border: '1px solid var(--ec-brand-border)' }}>
                            {totalGuests} total guests
                          </span>
                        )}
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
                            <div key={i} style={{ background: 'var(--ec-surface)', borderRadius: 'var(--ec-radius-sm)', border: '1px solid var(--ec-border)', padding: '10px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--ec-surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ec-text-2)' }}>{r.name.charAt(0).toUpperCase()}</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ec-text-1)' }}>{r.name}</p>
                                  <p style={{ fontSize: 11, color: 'var(--ec-text-3)' }}>{r.email}</p>
                                </div>
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: r.response === 'yes' ? 'var(--ec-success-bg)' : r.response === 'no' ? 'var(--ec-danger-bg)' : 'var(--ec-warning-bg)', color: r.response === 'yes' ? 'var(--ec-success)' : r.response === 'no' ? 'var(--ec-danger)' : 'var(--ec-warning)', border: `1px solid ${r.response === 'yes' ? 'var(--ec-success-border)' : r.response === 'no' ? 'var(--ec-danger-border)' : 'var(--ec-warning-border)'}`, flexShrink: 0 }}>
                                  {r.response}
                                </span>
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'var(--ec-brand-subtle)', color: 'var(--ec-brand)', border: '1px solid var(--ec-brand-border)', flexShrink: 0 }}>
                                  {r.guestCount ?? 1} {(r.guestCount ?? 1) === 1 ? 'guest' : 'guests'}
                                </span>
                                <button
                                  onClick={() => deleteRsvp(ev.eventId, r.rsvpId)}
                                  disabled={deletingRsvp === r.rsvpId}
                                  style={{ background: 'none', border: 'none', color: 'var(--ec-danger)', cursor: 'pointer', fontSize: 16, padding: '0 4px', flexShrink: 0, opacity: deletingRsvp === r.rsvpId ? 0.4 : 1 }}
                                  title="Remove RSVP"
                                >×</button>
                              </div>
                              {r.message && (
                                <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginTop: 6, paddingLeft: 40, lineHeight: 1.4 }}>{r.message}</p>
                              )}
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

        {/* ── Message Modal ── */}
        {messageModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
            <div style={{ background: 'var(--ec-surface)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-lg)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--ec-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ec-text-1)', margin: 0 }}>{messageModal.isFollowup ? 'Send Follow-up' : 'Send Message'}</p>
                  <p style={{ fontSize: 12, color: 'var(--ec-text-3)', margin: 0 }}>{messageModal.title}</p>
                </div>
                <button onClick={() => setMessageModal(null)} style={{ background: 'none', border: 'none', color: 'var(--ec-text-3)', cursor: 'pointer', fontSize: 20 }}>×</button>
              </div>
              <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ec-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Audience</p>
                  <select value={msgAudience} onChange={e => setMsgAudience(e.target.value as ReminderAudience)}
                    style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 'var(--ec-radius-sm)', border: '1px solid var(--ec-border)', background: 'var(--ec-card)', color: 'var(--ec-text-1)', fontFamily: 'inherit' }}>
                    <option value="yes">Yes RSVPs only ({messageModal.rsvps.filter(r => r.response === 'yes').length} guests)</option>
                    <option value="yes_maybe">Yes + Maybe RSVPs ({messageModal.rsvps.filter(r => r.response === 'yes' || r.response === 'maybe').length} guests)</option>
                    <option value="all">All RSVPs ({messageModal.rsvps.length} guests)</option>
                  </select>
                </div>
                <EcInput label="Subject" value={msgSubject} onChange={e => setMsgSubject(e.target.value)} placeholder="A message from your host" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ec-text-2)' }}>Message</label>
                  <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)} rows={6} placeholder="Write your message here..."
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--ec-radius-sm)', background: 'var(--ec-card)', border: '1px solid var(--ec-border)', color: 'var(--ec-text-1)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                {messageModal.isFollowup && (
                  <p style={{ fontSize: 12, color: 'var(--ec-text-3)', lineHeight: 1.5 }}>
                    Gallery link will be automatically included if configured in Event Settings.
                  </p>
                )}
              </div>
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--ec-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <EcButton size="sm" variant="ghost" onClick={() => setMessageModal(null)}>Cancel</EcButton>
                <EcButton size="sm" loading={msgSending} onClick={sendMessage}>Send Message</EcButton>
              </div>
            </div>
          </div>
        )}

        {/* ── Reminder Modal ── */}
        {reminderModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
            <div style={{ background: 'var(--ec-surface)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-lg)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

              {/* Modal header */}
              <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--ec-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ec-text-1)', margin: 0 }}>Send Reminder</p>
                  <p style={{ fontSize: 12, color: 'var(--ec-text-3)', margin: 0 }}>{reminderModal.title}</p>
                </div>
                <button onClick={closeReminderModal} style={{ background: 'none', border: 'none', color: 'var(--ec-text-3)', cursor: 'pointer', fontSize: 20, padding: '0 4px' }}>×</button>
              </div>

              {/* Audience options */}
              <div style={{ padding: '16px 20px 0' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ec-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Who receives this reminder</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {([
                    { key: 'yes',      label: 'Yes RSVPs only',      count: audienceCounts.yes },
                    { key: 'yes_maybe', label: 'Yes + Maybe RSVPs',   count: audienceCounts.yes_maybe },
                    { key: 'specific', label: 'Select specific guests', count: audienceCounts.specific },
                  ] as { key: ReminderAudience; label: string; count: number }[]).map(opt => (
                    <div
                      key={opt.key}
                      onClick={() => {
                        setReminderAudience(opt.key);
                        if (opt.key === 'yes')      selectQuick('yes');
                        if (opt.key === 'yes_maybe') selectQuick('yes_maybe');
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${reminderAudience === opt.key ? 'var(--ec-brand)' : 'var(--ec-border)'}`, borderRadius: 'var(--ec-radius-sm)', background: reminderAudience === opt.key ? 'var(--ec-brand-subtle)' : 'transparent', cursor: 'pointer' }}
                    >
                      <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${reminderAudience === opt.key ? 'var(--ec-brand)' : 'var(--ec-border)'}`, background: reminderAudience === opt.key ? 'var(--ec-brand)' : 'transparent', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ec-text-1)', margin: 0 }}>{opt.label}</p>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--ec-text-3)' }}>{opt.count} guests</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guest selector (specific only) */}
              {reminderAudience === 'specific' && (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0 20px' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => selectQuick('all')}       style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--ec-border)', background: 'none', cursor: 'pointer', color: 'var(--ec-text-2)', fontFamily: 'inherit' }}>All</button>
                    <button onClick={() => selectQuick('yes')}       style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--ec-border)', background: 'none', cursor: 'pointer', color: 'var(--ec-text-2)', fontFamily: 'inherit' }}>Yes only</button>
                    <button onClick={() => selectQuick('yes_maybe')} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--ec-border)', background: 'none', cursor: 'pointer', color: 'var(--ec-text-2)', fontFamily: 'inherit' }}>Yes+Maybe</button>
                    <button onClick={() => selectQuick('none')}      style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--ec-border)', background: 'none', cursor: 'pointer', color: 'var(--ec-text-2)', fontFamily: 'inherit' }}>Clear</button>
                    <input
                      type="text" placeholder="Search..." value={guestSearch}
                      onChange={e => setGuestSearch(e.target.value)}
                      style={{ flex: 1, minWidth: 120, fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--ec-border)', background: 'var(--ec-card)', color: 'var(--ec-text-1)', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: 260 }}>
                    {filteredRsvps.map(r => (
                      <div key={r.rsvpId} onClick={() => toggleRsvpSelection(r.rsvpId)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--ec-border)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={selectedRsvpIds.has(r.rsvpId)} onChange={() => toggleRsvpSelection(r.rsvpId)}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 14, height: 14, marginTop: 2, flexShrink: 0, cursor: 'pointer' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, color: 'var(--ec-text-1)' }}>{r.name}</span>
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: r.response === 'yes' ? 'var(--ec-success-bg)' : r.response === 'no' ? 'var(--ec-danger-bg)' : 'var(--ec-warning-bg)', color: r.response === 'yes' ? 'var(--ec-success)' : r.response === 'no' ? 'var(--ec-danger)' : 'var(--ec-warning)' }}>{r.response}</span>
                            <span style={{ fontSize: 10, color: 'var(--ec-text-3)' }}>{r.guestCount ?? 1} guest{(r.guestCount ?? 1) !== 1 ? 's' : ''}</span>
                          </div>
                          {r.message && <p style={{ fontSize: 11, color: 'var(--ec-text-3)', margin: '2px 0 0', fontStyle: 'italic', lineHeight: 1.4 }}>{r.message}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal footer */}
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--ec-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ec-text-1)' }}>
                    {reminderAudience === 'specific' ? selectedRsvpIds.size : audienceCounts[reminderAudience]} guests
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ec-text-3)' }}> · ~{expectedAttendees} expected attendees</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <EcButton size="sm" variant="ghost" onClick={closeReminderModal}>Cancel</EcButton>
                  <EcButton size="sm" loading={reminderSending} onClick={sendReminder}>Send Reminder</EcButton>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
