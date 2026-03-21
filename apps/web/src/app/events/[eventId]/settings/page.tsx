'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvents';
import { EcNav } from '@/components/ui/EcNav';
import { EcButton } from '@/components/ui/EcButton';
import { EcInput } from '@/components/ui/EcInput';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';

interface ScheduleItem { time: string; description: string; }

export default function EventSettingsPage() {
  const { eventId }                = useParams<{ eventId: string }>();
  const { user, loading, isAdmin } = useAuth();
  const { data: event, refetch }   = useEvent(eventId);
  const router                     = useRouter();

  const [slug,          setSlug]          = useState('');
  const [organizerName, setOrganizerName] = useState('');
  const [organizerPhone,setOrganizerPhone]= useState('');
  const [organizerEmail,setOrganizerEmail]= useState('');
  const [galleryUrl,    setGalleryUrl]    = useState('');
  const [schedule,      setSchedule]      = useState<ScheduleItem[]>([]);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [error,         setError]         = useState('');
  const [publishing,    setPublishing]    = useState(false);
  const [slugError,     setSlugError]     = useState('');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eventcraft.irotte.com';

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!event) return;
    setSlug(event.micrositeSlug ?? '');
    setOrganizerName(event.organizerName ?? '');
    setOrganizerPhone(event.organizerPhone ?? '');
    setOrganizerEmail(event.organizerEmail ?? '');
    setGalleryUrl(event.galleryUrl ?? '');
    try {
      setSchedule(event.schedule ? JSON.parse(event.schedule) : []);
    } catch { setSchedule([]); }
  }, [event]);

  function suggestSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
  }

  function validateSlug(val: string) {
    if (!val) { setSlugError('Slug is required to publish'); return false; }
    if (!/^[a-z0-9-]+$/.test(val)) { setSlugError('Only lowercase letters, numbers and hyphens'); return false; }
    setSlugError('');
    return true;
  }

  function addScheduleItem() {
    setSchedule(prev => [...prev, { time: '', description: '' }]);
  }

  function updateScheduleItem(i: number, field: 'time' | 'description', val: string) {
    setSchedule(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }

  function removeScheduleItem(i: number) {
    setSchedule(prev => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true); setError(''); setSaved(false);
    try {
      await apiClient.put(`/events/${eventId}`, {
        title:          event?.title,
        eventDate:      event?.eventDate,
        micrositeSlug:  slug || undefined,
        organizerName:  organizerName || undefined,
        organizerPhone: organizerPhone || undefined,
        organizerEmail: organizerEmail || undefined,
        galleryUrl:     galleryUrl || undefined,
        schedule:       schedule.length > 0 ? JSON.stringify(schedule) : undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { setError('Failed to save'); }
    finally { setSaving(false); }
  }

  async function publish() {
    if (!validateSlug(slug)) return;
    setPublishing(true); setError('');
    try {
      await save();
      await apiClient.put(`/events/${eventId}/publish`, { micrositeSlug: slug });
    } catch { setError('Failed to publish'); }
    finally { setPublishing(false); }
  }

  const isPublished = event?.status === 'published';

  const sectionStyle: React.CSSProperties = {
    background: 'var(--ec-surface)', border: '1px solid var(--ec-border)',
    borderRadius: 'var(--ec-radius-lg)', padding: '24px', marginBottom: 16,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--ec-text-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'block',
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ec-bg)' }}>
      <div className="ec-spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg)' }}>
      <EcNav
        email={user?.email}
        isAdmin={isAdmin}
        onLogout={() => {}}
        breadcrumbs={[
          { label: 'Events', href: '/dashboard' },
          { label: event?.title ?? 'Event', href: '/dashboard' },
          { label: 'Settings' },
        ]}
      />
      <main className="ec-page" style={{ maxWidth: 720 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em', marginBottom: 4 }}>
              Event Settings
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ec-text-3)' }}>{event?.title}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {saved && <span style={{ fontSize: 12, color: 'var(--ec-success)' }}>✓ Saved</span>}
            <EcButton variant="ghost" size="sm" loading={saving} onClick={save}>Save</EcButton>
            <EcButton size="sm" loading={publishing} onClick={publish}>
              {isPublished ? 'Update & Publish' : 'Publish Microsite'}
            </EcButton>
          </div>
        </div>

        {error && <div className="ec-error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Microsite slug */}
        <div style={sectionStyle}>
          <span style={labelStyle}>Microsite URL</span>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--ec-text-3)', paddingTop: 10, flexShrink: 0 }}>
              {appUrl}/e/
            </span>
            <div style={{ flex: 1 }}>
              <EcInput
                value={slug}
                onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugError(''); }}
                placeholder="your-event-slug"
              />
            </div>
            <EcButton size="sm" variant="ghost" onClick={() => setSlug(suggestSlug(event?.title ?? ''))}>
              Auto
            </EcButton>
          </div>
          {slugError && <p style={{ fontSize: 12, color: 'var(--ec-danger)', marginBottom: 4 }}>{slugError}</p>}
          {slug && !slugError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--ec-text-3)', fontFamily: 'monospace' }}>
                {appUrl}/e/{slug}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(`${appUrl}/e/${slug}`)}
                style={{ fontSize: 11, color: 'var(--ec-brand)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Copy
              </button>
              {isPublished && (
                <a href={`/e/${slug}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: 'var(--ec-brand)', textDecoration: 'none' }}>
                  Preview →
                </a>
              )}
            </div>
          )}
          <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginTop: 8, lineHeight: 1.5 }}>
            This is the public URL for your event microsite. Share this on WhatsApp, email, and QR codes.
            Only lowercase letters, numbers and hyphens allowed.
          </p>
        </div>

        {/* Organizer info */}
        <div style={sectionStyle}>
          <span style={labelStyle}>Organizer Info</span>
          <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginBottom: 14, lineHeight: 1.5 }}>
            Shown on the microsite so guests can contact you.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <EcInput label="Your name" value={organizerName} onChange={e => setOrganizerName(e.target.value)} placeholder="Nag Rotte" />
            <EcInput label="Phone number" value={organizerPhone} onChange={e => setOrganizerPhone(e.target.value)} placeholder="+1 832 555 0000" />
            <EcInput label="Email" type="email" value={organizerEmail} onChange={e => setOrganizerEmail(e.target.value)} placeholder="you@example.com" />
          </div>
        </div>

        {/* Schedule */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={labelStyle}>Program / Schedule</span>
            <EcButton size="sm" variant="ghost" onClick={addScheduleItem}>+ Add item</EcButton>
          </div>
          {schedule.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ec-text-3)', textAlign: 'center', padding: '16px 0' }}>
              No schedule items yet. Click "+ Add item" to add program details.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {schedule.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 120, flexShrink: 0 }}>
                    <EcInput
                      value={item.time}
                      onChange={e => updateScheduleItem(i, 'time', e.target.value)}
                      placeholder="6:00 PM"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <EcInput
                      value={item.description}
                      onChange={e => updateScheduleItem(i, 'description', e.target.value)}
                      placeholder="Pravachanam begins"
                    />
                  </div>
                  <button
                    onClick={() => removeScheduleItem(i)}
                    style={{ background: 'none', border: 'none', color: 'var(--ec-text-3)', cursor: 'pointer', fontSize: 18, padding: '8px 4px', flexShrink: 0 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gallery */}
        <div style={sectionStyle}>
          <span style={labelStyle}>Post-Event Photo Gallery</span>
          <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginBottom: 12, lineHeight: 1.5 }}>
            After the event, paste your akriti.net gallery URL here. A "View Photos" button will appear on the microsite.
          </p>
          <EcInput
            label="Gallery URL (akriti.net)"
            value={galleryUrl}
            onChange={e => setGalleryUrl(e.target.value)}
            placeholder="https://akriti.net/gallery/your-event"
          />
        </div>

        {/* Status */}
        <div style={{ ...sectionStyle, background: isPublished ? 'var(--ec-success-bg)' : 'var(--ec-surface)', border: `1px solid ${isPublished ? 'var(--ec-success-border)' : 'var(--ec-border)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: isPublished ? 'var(--ec-success)' : 'var(--ec-text-1)', marginBottom: 4 }}>
                {isPublished ? '✓ Microsite is Live' : 'Microsite not published yet'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--ec-text-3)' }}>
                {isPublished
                  ? `Public at ${appUrl}/e/${slug}`
                  : 'Set a slug above and click "Publish Microsite" to go live'}
              </p>
            </div>
            {isPublished && slug && (
              <a href={`/e/${slug}`} target="_blank" rel="noreferrer">
                <EcButton size="sm" variant="ghost">Open →</EcButton>
              </a>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
