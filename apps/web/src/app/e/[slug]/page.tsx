import { LogoMark } from '@/components/ui/LogoMark';
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface Schedule {
  time:        string;
  description: string;
}

interface PublicEvent {
  eventId:      string;
  title:        string;
  eventDate:    string;
  location?:    string;
  description?: string;
  canvasJson?:  string;
  status:       string;
  micrositeSlug?: string;
  schedule?:    Schedule[];
  organizerName?:  string;
  organizerPhone?: string;
  organizerEmail?: string;
  galleryUrl?:  string;
}

export default function MicrositePage() {
  const { slug }              = useParams<{ slug: string }>();
  const [event, setEvent]     = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep]       = useState<'view' | 'form' | 'done'>('view');
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [response, setResponse] = useState<'yes' | 'no' | 'maybe'>('yes');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState('');
  const [copied, setCopied]   = useState(false);
  const canvasRef             = useRef<HTMLCanvasElement>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const apiBase               = process.env.NEXT_PUBLIC_API_URL ?? '';
  const appUrl                = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eventcraft.irotte.com';

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`${apiBase}/events/slug/${slug}/public`);
        const data = await res.json();
        if (data.data) { const d = data.data; if (typeof d.schedule === 'string') { try { d.schedule = JSON.parse(d.schedule); } catch { d.schedule = []; } } setEvent(d); }
        else setError('Event not found');
      } catch {
        setError('Event not found');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  useEffect(() => {
    function calcScale() {
      const vw = Math.min(window.innerWidth, 680) - 32;
      setCanvasScale(Math.min(1, vw / 600));
    }
    calcScale();
    window.addEventListener('resize', calcScale);
    return () => window.removeEventListener('resize', calcScale);
  }, []);

  useEffect(() => {
    if (!event?.canvasJson || !canvasRef.current) return;
    async function render() {
      try {
        const { Canvas: FC } = await import('fabric');
        const c = new FC(canvasRef.current!, { width: 600, height: 850, selection: false, interactive: false });
        await c.loadFromJSON(JSON.parse(event!.canvasJson!));
        c.getObjects().forEach(o => { o.selectable = false; o.evented = false; });
        c.renderAll();
      } catch {}
    }
    render();
  }, [event]);

  async function submitRsvp() {
    if (!name.trim() || !email.trim()) { setError('Name and email are required'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch(`${apiBase}/events/${event!.eventId}/rsvp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, response, message }),
      });
      if (!res.ok) throw new Error();
      setStep('done');
    } catch { setError('Failed to submit â€” please try again'); }
    finally { setSubmitting(false); }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${appUrl}/e/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a12' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #4F6FBF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error || !event) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a12' }}>
      <p style={{ color: '#888', fontFamily: 'Georgia, serif', fontSize: 16 }}>Event not found</p>
    </div>
  );

  const formattedDate = new Date(event.eventDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedTime = new Date(event.eventDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: '#fff', fontSize: 14,
    fontFamily: 'Georgia, serif', boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#08080f', fontFamily: 'Georgia, serif', color: '#fff' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::selection { background: rgba(79,111,191,0.3); }
      `}</style>

      {/* Hero â€” canvas design */}
      {event.canvasJson && (
        <div style={{ width: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center', background: '#04040a' }}>
          <div style={{ width: 600, height: 850, transformOrigin: 'top left', transform: `scale(${canvasScale})`, marginBottom: -(850 * (1 - canvasScale)) }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px' }}>

        {/* EventCraft logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <LogoMark size={28} onClick={() => window.location.href='https://eventcraft.irotte.com'} />
        </div>

        {/* Event title */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 36, fontWeight: 700, color: '#fff', marginBottom: 8, lineHeight: 1.2, letterSpacing: '-0.5px' }}>
            {event.title}
          </h1>
          {event.description && (
            <p style={{ fontSize: 16, color: '#aaa', lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
              {event.description}
            </p>
          )}
        </div>

        {/* Event details card */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '24px 28px', marginBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(79,111,191,0.15)', border: '1px solid rgba(79,111,191,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="12" rx="2" stroke="#4F6FBF" strokeWidth="1.3"/><path d="M5 1v3M11 1v3M1 7h14" stroke="#4F6FBF" strokeWidth="1.3" strokeLinecap="round"/></svg>
              </div>
              <div>
                <p style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>Date & Time</p>
                <p style={{ fontSize: 15, color: '#fff', fontWeight: 500 }}>{formattedDate}</p>
                <p style={{ fontSize: 14, color: '#D4AF37' }}>{formattedTime}</p>
              </div>
            </div>
            {event.location && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8 4.5 8S12.5 9.5 12.5 6c0-2.5-2-4.5-4.5-4.5z" stroke="#D4AF37" strokeWidth="1.3"/><circle cx="8" cy="6" r="1.5" stroke="#D4AF37" strokeWidth="1.3"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>Location</p>
                  <p style={{ fontSize: 15, color: '#fff', fontWeight: 500 }}>{event.location}</p>
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#4F6FBF', textDecoration: 'none', marginTop: 2, display: 'inline-block' }}>
                    Get directions â†’
                  </a>
                </div>
              </div>
            )}
            {event.organizerName && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="#888" strokeWidth="1.3"/><path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#888" strokeWidth="1.3" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>Organizer</p>
                  <p style={{ fontSize: 15, color: '#fff', fontWeight: 500 }}>{event.organizerName}</p>
                  {event.organizerPhone && <p style={{ fontSize: 13, color: '#aaa' }}>{event.organizerPhone}</p>}
                  {event.organizerEmail && <p style={{ fontSize: 13, color: '#4F6FBF' }}>{event.organizerEmail}</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Schedule */}
        {event.schedule && event.schedule.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '24px 28px', marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 20, letterSpacing: '0.5px' }}>Program / Schedule</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {event.schedule.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: i < event.schedule!.length - 1 ? 16 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#D4AF37', marginTop: 4 }} />
                    {i < event.schedule!.length - 1 && <div style={{ width: 1, flex: 1, background: 'rgba(212,175,55,0.25)', marginTop: 4 }} />}
                  </div>
                  <div style={{ paddingBottom: i < event.schedule!.length - 1 ? 16 : 0 }}>
                    <p style={{ fontSize: 12, color: '#D4AF37', marginBottom: 2, fontFamily: 'Helvetica Neue, sans-serif' }}>{item.time}</p>
                    <p style={{ fontSize: 14, color: '#ddd', lineHeight: 1.5 }}>{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photo gallery link */}
        {event.galleryUrl && (
          <div style={{ background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 16, padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#D4AF37', marginBottom: 4 }}>📸 Event Photos</p>
              <p style={{ fontSize: 13, color: '#888' }}>View and download photos from this event</p>
            </div>
            <a href={event.galleryUrl} target="_blank" rel="noreferrer"
              style={{ padding: '10px 20px', background: '#D4AF37', color: '#0a0a12', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0, fontFamily: 'Helvetica Neue, sans-serif' }}>
              View Gallery
            </a>
          </div>
        )}

        {/* RSVP section */}
        <div style={{ background: 'rgba(79,111,191,0.06)', border: '1px solid rgba(79,111,191,0.15)', borderRadius: 16, padding: '28px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>RSVP</h2>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Let the organizer know if you can attend</p>

          {step === 'view' && (
            <button onClick={() => setStep('form')} style={{ width: '100%', padding: '14px', background: '#4F6FBF', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
              RSVP Now
            </button>
          )}

          {step === 'form' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                {(['yes', 'no', 'maybe'] as const).map(r => (
                  <button key={r} onClick={() => setResponse(r)} style={{
                    flex: 1, padding: '10px 0', borderRadius: 8,
                    border: `1px solid ${response === r ? '#4F6FBF' : 'rgba(255,255,255,0.1)'}`,
                    background: response === r ? 'rgba(79,111,191,0.2)' : 'transparent',
                    color: response === r ? '#7B9FD4' : '#777',
                    cursor: 'pointer', fontSize: 13, fontWeight: response === r ? 600 : 400, fontFamily: 'Georgia, serif',
                  }}>
                    {r === 'yes' ? 'Yes' : r === 'no' ? 'No' : 'Maybe'}
                  </button>
                ))}
              </div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name *" style={inp} />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address *" type="email" style={inp} />
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Message (optional)" rows={2} style={{ ...inp, resize: 'none' }} />
              {error && <p style={{ fontSize: 13, color: '#f87171' }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep('view')} style={{ flex: 1, padding: '12px 0', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#888', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 14 }}>Back</button>
                <button onClick={submitRsvp} disabled={submitting} style={{ flex: 2, padding: '12px 0', background: '#4F6FBF', border: 'none', borderRadius: 8, color: '#fff', cursor: submitting ? 'wait' : 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'Georgia, serif', opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'Submitting...' : 'Submit RSVP'}
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{response === 'yes' ? '🎉' : response === 'no' ? '😔' : '🤔'}</div>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                {response === 'yes' ? 'See you there!' : response === 'no' ? "Sorry you can't make it" : "We'll keep a spot for you"}
              </p>
              <p style={{ fontSize: 13, color: '#888' }}>Your RSVP has been recorded.</p>
            </div>
          )}
        </div>

        {/* Share section */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 28px', marginBottom: 40 }}>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Helvetica Neue, sans-serif' }}>Share this event</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={copyLink} style={{ flex: 1, padding: '10px 0', background: copied ? 'rgba(79,111,191,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${copied ? 'rgba(79,111,191,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, color: copied ? '#7B9FD4' : '#aaa', cursor: 'pointer', fontSize: 13, fontFamily: 'Helvetica Neue, sans-serif', transition: 'all 0.2s' }}>
              {copied ? 'âœ“ Copied' : 'Copy Link'}
            </button>
            <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${event.title} â€” ${appUrl}/e/${slug}`)}`, '_blank')}
              style={{ flex: 1, padding: '10px 0', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 8, color: '#25d366', cursor: 'pointer', fontSize: 13, fontFamily: 'Helvetica Neue, sans-serif' }}>
              WhatsApp
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.15)', fontFamily: 'Helvetica Neue, sans-serif' }}>
          Powered by EventCraft · eventcraft.irotte.com
        </p>
      </div>
    </div>
  );
}
