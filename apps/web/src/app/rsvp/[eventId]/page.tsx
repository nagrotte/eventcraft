'use client';
import { LogoMark } from '@/components/ui/LogoMark';

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface PublicEvent {
  eventId:      string;
  title:        string;
  eventDate:    string;
  location?:    string;
  description?: string;
  canvasJson?:  string;
  status:       string;
}

export default function RsvpPage() {
  const { eventId }             = useParams<{ eventId: string }>();
  const [event, setEvent]       = useState<PublicEvent | null>(null);
  const [loading, setLoading]   = useState(true);
  const [step, setStep]         = useState<'view' | 'form' | 'done'>('view');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [response, setResponse] = useState<'yes' | 'no' | 'maybe'>('yes');
  const [guestCount, setGuestCount] = useState(1);
  const [message, setMessage]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');
  const canvasRef               = useRef<HTMLCanvasElement>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`${apiBase}/events/${eventId}/public`);
        const data = await res.json();
        setEvent(data.data);
      } catch {
        setError('Event not found');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [eventId]);

  useEffect(() => {
    function calcScale() {
      const vw = Math.min(window.innerWidth, 640) - 32;
      setCanvasScale(Math.min(1, vw / 600));
    }
    calcScale();
    window.addEventListener('resize', calcScale);
    return () => window.removeEventListener('resize', calcScale);
  }, []);

  useEffect(() => {
    if (!event?.canvasJson || !canvasRef.current) return;
    async function renderCanvas() {
      try {
        const { Canvas: FabricCanvas } = await import('fabric');
        const canvas = new FabricCanvas(canvasRef.current!, {
          width: 600, height: 850, selection: false, interactive: false,
        });
        await canvas.loadFromJSON(JSON.parse(event!.canvasJson!));
        canvas.getObjects().forEach(obj => { obj.selectable = false; obj.evented = false; });
        canvas.renderAll();
      } catch { console.warn('Could not render canvas'); }
    }
    renderCanvas();
  }, [event]);

  async function submitRsvp() {
    if (!name.trim() || !email.trim()) { setError('Name and email are required'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch(`${apiBase}/events/${eventId}/rsvp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, email, response, message, guestCount }),
      });
      if (!res.ok) throw new Error('Failed');
      setStep('done');
    } catch {
      setError('Failed to submit — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a12' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #6366F1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  const formattedDate = event?.eventDate
    ? new Date(event.eventDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' at ' + new Date(event.eventDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : '';

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8, color: '#fff', fontSize: 14,
    fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a12', fontFamily: 'Inter, sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>

      {/* EventCraft logo */}
      <div style={{ textAlign: 'center', padding: '24px 16px 8px', cursor: 'pointer' }} onClick={() => window.location.href='https://eventcraft.irotte.com'}>
        <LogoMark iconOnly={true} size={32} onClick={() => window.location.href='https://eventcraft.irotte.com'} />
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px' }}>

        {/* Canvas design — centered on mobile */}
        {event?.canvasJson && (
          <div style={{ width: '100%', marginBottom: 24, overflow: 'hidden', borderRadius: 4, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 600,
              height: 850,
              transformOrigin: 'top center',
              transform: `scale(${canvasScale})`,
              marginBottom: -(850 * (1 - canvasScale)),
            }}>
              <canvas ref={canvasRef} style={{ display: 'block' }} />
            </div>
          </div>
        )}

        {/* Event details */}
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 12, lineHeight: 1.2 }}>{event?.title}</h1>
          {formattedDate && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                <rect x="1" y="3" width="13" height="11" rx="2" stroke="#6366F1" strokeWidth="1.2"/>
                <path d="M4 1v3M11 1v3M1 7h13" stroke="#6366F1" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 14, color: '#ccc', lineHeight: 1.4 }}>{formattedDate}</span>
            </div>
          )}
          {event?.location && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M7.5 1.5C5 1.5 3 3.5 3 6c0 3.5 4.5 7.5 4.5 7.5S12 9.5 12 6c0-2.5-2-4.5-4.5-4.5z" stroke="#6366F1" strokeWidth="1.2"/>
                <circle cx="7.5" cy="6" r="1.5" stroke="#6366F1" strokeWidth="1.2"/>
              </svg>
              <span style={{ fontSize: 14, color: '#ccc', lineHeight: 1.4 }}>{event.location}</span>
            </div>
          )}
        </div>

        {/* RSVP section */}
        {step === 'view' && (
          <button onClick={() => setStep('form')} style={{ width: '100%', padding: '14px', background: '#6366F1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            RSVP Now
          </button>
        )}

        {step === 'form' && (
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 16 }}>Your RSVP</h2>

            {/* Response buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['yes', 'no', 'maybe'] as const).map(r => (
                <button key={r} onClick={() => setResponse(r)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  border: `1px solid ${response === r ? '#6366F1' : 'rgba(255,255,255,0.1)'}`,
                  background: response === r ? 'rgba(99,102,241,0.2)' : 'transparent',
                  color: response === r ? '#6366F1' : '#999',
                  cursor: 'pointer', fontSize: 13, fontWeight: response === r ? 600 : 400, fontFamily: 'inherit',
                }}>
                  {r === 'yes' ? 'Yes' : r === 'no' ? 'No' : 'Maybe'}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 6 }}>Your name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={inp} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 6 }}>Email *</label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" style={inp} />
            </div>

            {/* Guest count */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 6 }}>Number of guests attending (including yourself)</label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, overflow: 'hidden' }}>
                <button
                  onClick={() => setGuestCount(g => Math.max(1, g - 1))}
                  style={{ width: 44, height: 42, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}
                >−</button>
                <span style={{ flex: 1, textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: 500 }}>{guestCount}</span>
                <button
                  onClick={() => setGuestCount(g => Math.min(20, g + 1))}
                  style={{ width: 44, height: 42, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}
                >+</button>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 6 }}>Message (optional)</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Add a note..." rows={3} style={{ ...inp, resize: 'none' }} />
            </div>

            {error && <p style={{ fontSize: 13, color: '#f87171', marginBottom: 12 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('view')} style={{ flex: 1, padding: '12px 0', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#999', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                Back
              </button>
              <button onClick={submitRsvp} disabled={submitting} style={{ flex: 2, padding: '12px 0', background: '#6366F1', border: 'none', borderRadius: 8, color: '#fff', cursor: submitting ? 'wait' : 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Submitting...' : 'Submit RSVP'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              {response === 'yes' ? '🎉' : response === 'no' ? '😔' : '🤔'}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              {response === 'yes' ? 'See you there!' : response === 'no' ? "Sorry you can't make it" : "We'll keep a spot for you"}
            </h2>
            <p style={{ fontSize: 13, color: '#999' }}>Your RSVP has been recorded.</p>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 24 }}>
          Powered by EventCraft
        </p>
      </div>
    </div>
  );
}
