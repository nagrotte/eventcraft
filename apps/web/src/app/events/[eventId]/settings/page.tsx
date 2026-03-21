'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvents';
import { EcNav } from '@/components/ui/EcNav';
import { EcButton } from '@/components/ui/EcButton';
import { EcInput } from '@/components/ui/EcInput';
import { useEffect, useRef, useState } from 'react';
import apiClient from '@/lib/api-client';

interface ScheduleItem { time: string; description: string; }

interface UploadState {
  file:     File;
  progress: 'pending' | 'uploading' | 'done' | 'error';
  error?:   string;
}

export default function EventSettingsPage() {
  const { eventId }                = useParams<{ eventId: string }>();
  const { user, loading, isAdmin } = useAuth();
  const { data: event, refetch }   = useEvent(eventId);
  const router                     = useRouter();
  const fileInputRef               = useRef<HTMLInputElement>(null);

  const [title,          setTitle]          = useState('');
  const [eventDate,      setEventDate]      = useState('');
  const [location,       setLocation]       = useState('');
  const [description,    setDescription]    = useState('');
  const [slug,           setSlug]           = useState('');
  const [organizerName,  setOrganizerName]  = useState('');
  const [organizerPhone, setOrganizerPhone] = useState('');
  const [organizerEmail, setOrganizerEmail] = useState('');
  const [galleryUrl,     setGalleryUrl]     = useState('');
  const [schedule,       setSchedule]       = useState<ScheduleItem[]>([]);

  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState('');
  const [publishing,  setPublishing]  = useState(false);
  const [slugError,   setSlugError]   = useState('');

  // Gallery upload state
  const [galleryId,      setGalleryId]      = useState<string | null>(null);
  const [uploads,        setUploads]        = useState<UploadState[]>([]);
  const [creatingGallery, setCreatingGallery] = useState(false);
  const [galleryError,   setGalleryError]   = useState('');
  const uploadedCount = uploads.filter(u => u.progress === 'done').length;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eventcraft.irotte.com';

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!event) return;
    setTitle(event.title ?? '');
    setLocation(event.location ?? '');
    setDescription(event.description ?? '');
    setSlug(event.micrositeSlug ?? '');
    setOrganizerName(event.organizerName ?? '');
    setOrganizerPhone(event.organizerPhone ?? '');
    setOrganizerEmail(event.organizerEmail ?? '');
    setGalleryUrl(event.galleryUrl ?? '');
    if (event.eventDate) {
      try {
        const d = new Date(event.eventDate);
        setEventDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      } catch { setEventDate(event.eventDate); }
    }
    try { setSchedule(event.schedule ? JSON.parse(event.schedule) : []); }
    catch { setSchedule([]); }
  }, [event]);

  function suggestSlug(t: string) {
    return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
  }

  function validateSlug(val: string) {
    if (!val) { setSlugError('Slug is required to publish'); return false; }
    if (!/^[a-z0-9-]+$/.test(val)) { setSlugError('Only lowercase letters, numbers and hyphens'); return false; }
    setSlugError(''); return true;
  }

  function addScheduleItem() { setSchedule(prev => [...prev, { time: '', description: '' }]); }
  function updateScheduleItem(i: number, field: 'time' | 'description', val: string) {
    setSchedule(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }
  function removeScheduleItem(i: number) { setSchedule(prev => prev.filter((_, idx) => idx !== i)); }

  async function save(gUrl?: string) {
    if (!title.trim()) { setError('Event title is required'); return; }
    if (!eventDate)    { setError('Event date is required'); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      await apiClient.put(`/events/${eventId}`, {
        title:          title.trim(),
        eventDate:      new Date(eventDate).toISOString(),
        location:       location || undefined,
        description:    description || undefined,
        micrositeSlug:  slug || undefined,
        organizerName:  organizerName || undefined,
        organizerPhone: organizerPhone || undefined,
        organizerEmail: organizerEmail || undefined,
        galleryUrl:     gUrl ?? galleryUrl ?? undefined,
        schedule:       schedule.length > 0 ? JSON.stringify(schedule) : undefined,
      });
      await refetch();
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
      await refetch();
    } catch { setError('Failed to publish'); }
    finally { setPublishing(false); }
  }

  // ── Gallery upload ────────────────────────────────────────────────────────

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setGalleryError('');

    // Create gallery on akriti.net if we don't have one yet
    let gId = galleryId;
    if (!gId) {
      setCreatingGallery(true);
      try {
        const res = await fetch('/api/gallery', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action: 'create', title: title || event?.title || 'Event Gallery', eventId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to create gallery');
        gId = data.galleryId;
        setGalleryId(gId!);
        const newUrl = data.galleryUrl;
        setGalleryUrl(newUrl);
        // Save gallery URL to event immediately
        await save(newUrl);
      } catch (err: any) {
        setGalleryError(err.message ?? 'Failed to create gallery');
        setCreatingGallery(false);
        return;
      } finally {
        setCreatingGallery(false);
      }
    }

    // Add files to upload queue
    const newUploads: UploadState[] = files.map(file => ({ file, progress: 'pending' }));
    setUploads(prev => [...prev, ...newUploads]);

    // Upload each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadIndex = uploads.length + i;

      setUploads(prev => prev.map((u, idx) =>
        idx === uploadIndex ? { ...u, progress: 'uploading' } : u));

      try {
        // Get presigned URL from our proxy
        const urlRes = await fetch('/api/gallery', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            action:      'upload-url',
            galleryId:   gId,
            filename:    file.name,
            contentType: file.type || 'image/jpeg',
          }),
        });
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlData.error ?? 'Failed to get upload URL');

        // Upload directly to S3
        const s3Res = await fetch(urlData.url, {
          method:  'PUT',
          headers: {},
          body:    file,
        });
        if (!s3Res.ok) throw new Error('S3 upload failed');

        setUploads(prev => prev.map((u, idx) =>
          idx === uploadIndex ? { ...u, progress: 'done' } : u));
      } catch (err: any) {
        setUploads(prev => prev.map((u, idx) =>
          idx === uploadIndex ? { ...u, progress: 'error', error: err.message } : u));
      }
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
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
            <EcButton variant="ghost" size="sm" loading={saving} onClick={() => save()}>Save</EcButton>
            <EcButton size="sm" loading={publishing} onClick={publish}>
              {isPublished ? 'Update & Publish' : 'Publish Microsite'}
            </EcButton>
          </div>
        </div>

        {error && <div className="ec-error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Event Details */}
        <div style={sectionStyle}>
          <span style={labelStyle}>Event Details</span>
          <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginBottom: 16, lineHeight: 1.5 }}>
            Update your event name, date, and location at any time.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <EcInput label="Event title *" value={title} onChange={e => setTitle(e.target.value)} placeholder="Srirama Navami Celebration" />
            <EcInput label="Date & time *" type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            <EcInput label="Location" value={location} onChange={e => setLocation(e.target.value)} placeholder="1204 Rosewood Lane, Katy TX 77494" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ec-text-2)' }}>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A brief description shown on the microsite..."
                rows={3}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 'var(--ec-radius-sm)',
                  background: 'var(--ec-card)', border: '1px solid var(--ec-border)',
                  color: 'var(--ec-text-1)', fontSize: 13, fontFamily: 'inherit',
                  resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>

        {/* Microsite URL */}
        <div style={sectionStyle}>
          <span style={labelStyle}>Microsite URL</span>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--ec-text-3)', paddingTop: 10, flexShrink: 0 }}>{appUrl}/e/</span>
            <div style={{ flex: 1 }}>
              <EcInput
                value={slug}
                onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugError(''); }}
                placeholder="your-event-slug"
              />
            </div>
            <EcButton size="sm" variant="ghost" onClick={() => setSlug(suggestSlug(title || event?.title || ''))}>Auto</EcButton>
          </div>
          {slugError && <p style={{ fontSize: 12, color: 'var(--ec-danger)', marginBottom: 4 }}>{slugError}</p>}
          {slug && !slugError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--ec-text-3)', fontFamily: 'monospace' }}>{appUrl}/e/{slug}</p>
              <button onClick={() => navigator.clipboard.writeText(`${appUrl}/e/${slug}`)}
                style={{ fontSize: 11, color: 'var(--ec-brand)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Copy
              </button>
              {isPublished && (
                <a href={`/e/${slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--ec-brand)', textDecoration: 'none' }}>Preview →</a>
              )}
            </div>
          )}
          <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginTop: 8, lineHeight: 1.5 }}>
            Only lowercase letters, numbers and hyphens.
          </p>
        </div>

        {/* Organizer Info */}
        <div style={sectionStyle}>
          <span style={labelStyle}>Organizer Info</span>
          <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginBottom: 14, lineHeight: 1.5 }}>
            Shown on the microsite and included in email invitations.
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
                    <EcInput value={item.time} onChange={e => updateScheduleItem(i, 'time', e.target.value)} placeholder="6:00 PM" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <EcInput value={item.description} onChange={e => updateScheduleItem(i, 'description', e.target.value)} placeholder="Pravachanam begins" />
                  </div>
                  <button onClick={() => removeScheduleItem(i)}
                    style={{ background: 'none', border: 'none', color: 'var(--ec-text-3)', cursor: 'pointer', fontSize: 18, padding: '8px 4px', flexShrink: 0 }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Post-Event Gallery */}
        <div style={sectionStyle}>
          <span style={labelStyle}>Post-Event Photo Gallery</span>
          <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginBottom: 16, lineHeight: 1.5 }}>
            Upload photos after the event. They will be hosted on akriti.net and a "View Photos" button will appear on your microsite.
          </p>

          {galleryError && (
            <div style={{ fontSize: 12, color: 'var(--ec-danger)', padding: '8px 12px', background: 'rgba(240,89,90,0.08)', border: '1px solid rgba(240,89,90,0.2)', borderRadius: 8, marginBottom: 12 }}>
              {galleryError}
            </div>
          )}

          {/* Upload button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: galleryUrl ? 14 : 0 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFilesSelected}
            />
            <EcButton
              size="sm"
              variant="ghost"
              loading={creatingGallery}
              onClick={() => fileInputRef.current?.click()}
            >
              {creatingGallery ? 'Creating gallery...' : '+ Upload Photos'}
            </EcButton>
            {uploadedCount > 0 && (
              <span style={{ fontSize: 12, color: 'var(--ec-success)' }}>
                ✓ {uploadedCount} photo{uploadedCount !== 1 ? 's' : ''} uploaded
              </span>
            )}
          </div>

          {/* Upload progress list */}
          {uploads.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {uploads.map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: u.progress === 'done' ? 'var(--ec-success)'
                      : u.progress === 'error' ? 'var(--ec-danger)'
                      : u.progress === 'uploading' ? 'var(--ec-brand)'
                      : 'var(--ec-text-3)'
                  }} />
                  <span style={{ color: 'var(--ec-text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.file.name}
                  </span>
                  <span style={{ color: 'var(--ec-text-3)', flexShrink: 0 }}>
                    {u.progress === 'done' ? '✓' : u.progress === 'error' ? '✗' : u.progress === 'uploading' ? '...' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Gallery URL display */}
          {galleryUrl && (
            <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--ec-card)', border: '1px solid var(--ec-border)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginBottom: 3 }}>Gallery hosted at</p>
                  <p style={{ fontSize: 12, color: 'var(--ec-brand)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {galleryUrl}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => navigator.clipboard.writeText(galleryUrl)}
                    style={{ fontSize: 11, color: 'var(--ec-brand)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Copy
                  </button>
                  <a href={galleryUrl} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: 'var(--ec-brand)', textDecoration: 'none' }}>
                    View →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Manual URL fallback */}
          {!galleryUrl && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginBottom: 6 }}>Or paste an existing gallery URL:</p>
              <EcInput
                value={galleryUrl}
                onChange={e => setGalleryUrl(e.target.value)}
                placeholder="https://www.akriti.net/gallery/..."
              />
            </div>
          )}
        </div>

        {/* Status */}
        <div style={{
          ...sectionStyle,
          background: isPublished ? 'rgba(45,212,160,0.06)' : 'var(--ec-surface)',
          border: `1px solid ${isPublished ? 'rgba(45,212,160,0.25)' : 'var(--ec-border)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: isPublished ? 'var(--ec-success)' : 'var(--ec-text-1)', marginBottom: 4 }}>
                {isPublished ? '✓ Microsite is Live' : 'Microsite not published yet'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--ec-text-3)' }}>
                {isPublished ? `Public at ${appUrl}/e/${slug}` : 'Set a slug above and click "Publish Microsite" to go live'}
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
