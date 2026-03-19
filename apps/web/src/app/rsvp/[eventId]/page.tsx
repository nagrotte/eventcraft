'use client';

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface PublicEvent {
  eventId:     string;
  title:       string;
  eventDate:   string;
  location?:   string;
  description?: string;
  canvasJson?: string;
  status:      string;
}

export default function RsvpPage() {
  const { eventId }     = useParams<{ eventId: string }>();
  const [event, setEvent]     = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep]       = useState<'view' | 'form' | 'done'>('view');
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [response, setResponse] = useState<'yes' | 'no' | 'maybe'>('yes');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiBase   = process.env.NEXT_PUBLIC_API_URL ?? '';

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${apiBase}/events/${eventId}/public`);
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

  // Render canvas design as static image
  useEffect(() => {
    if (!event?.canvasJson || !canvasRef.current) return;
    async function renderCanvas() {
      try {
        const { Canvas: FabricCanvas } = await import('fabric');
        const canvas = new FabricCanvas(canvasRef.current!, {
          width: 600, height: 850, selection: false, interactive: false,
        });
        await canvas.loadFromJSON(JSON.parse(event!.canvasJson!));
        canvas.renderAll();
        // Make non-interactive
        canvas.getObjects().forEach(obj => { obj.selectable = false; obj.evented = false; });
        canvas.renderAll();
      } catch { console.warn('Could not render canvas'); }
    }
    renderCanvas();
  }, [event]);

  async function submitRsvp() {
    if (!name.trim() || !email.trim()) { setError('Name and email are required'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/events/${eventId}/rsvp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, email, response, message }),
      });
      if (!res.ok) throw new Error('Submission failed');
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

  if (error && !event) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a12' }}>
      <p style={{ color: '#fff', fontSize: 18 }}>Event not found</p>
    </div>
  );

  const formattedDate = event?.eventDate
    ? new Date(event.eventDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a12', padding: '40px 20px', fontFamily: 'Inter, sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* EventCraft branding */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20 }}>
            <div style={{ width: 18, height: 18, background: '#6366F1', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.5 9L10 3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <span style={{ fontSize: 12, color: '#6366F1', fontWeight: 500 }}>EventCraft</span>
          </div>
        </div>

        {/* Invitation design */}
        {event?.canvasJson && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <div style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6)', borderRadius: 4, overflow: 'hidden', maxWidth: '100%' }}>
              <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', height: 'auto' }} />
            </div>
          </div>
        )}

        {/* Event details */}
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '24px', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 12, lineHeight: 1.2 }}>
            {event?.title}
          </h1>
          {formattedDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="3" width="13" height="11" rx="2" stroke="#6366F1" strokeWidth="1.2"/><path d="M4 1v3M11 1v3M1 7h13" stroke="#6366F1" strokeWidth="1.2" strokeLinecap="round"/></svg>
              <span style={{ fontSize: 15, color: '#ccc' }}>{formattedDate}</span>
            </div>
          )}
          {event?.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1.5C5 1.5 3 3.5 3 6c0 3.5 4.5 7.5 4.5 7.5S12 9.5 12 6c0-2.5-2-4.5-4.5-4.5z" stroke="#6366F1" strokeWidth="1.2"/><circle cx="7.5" cy="6" r="1.5" stroke="#6366F1" strokeWidth="1.2"/></svg>
              <span style={{ fontSize: 15, color: '#ccc' }}>{event.location}</span>
            </div>
          )}
          {event?.description && (
            <p style={{ fontSize: 14, color: '#999', marginTop: 12, lineHeight: 1.6 }}>{event.description}</p>
          )}
        </div>

        {/* RSVP section */}
        {step === 'view' && (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => setStep('form')}
              style={{ padding: '14px 40px', background: '#6366F1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer', width: '100%' }}
            >
              RSVP Now
            </button>
          </div>
        )}

        {step === 'form' && (
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 20 }}>Your RSVP</h2>

            {/* Response choice */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['yes', 'no', 'maybe'] as const).map(r => (
                <button key={r} onClick={() => setResponse(r)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  border: `1px solid ${response === r ? '#6366F1' : 'rgba(255,255,255,0.1)'}`,
                  background: response === r ? 'rgba(99,102,241,0.2)' : 'transparent',
                  color: response === r ? '#6366F1' : '#999',
                  cursor: 'pointer', fontSize: 14, fontWeight: response === r ? 600 : 400,
                  fontFamily: 'inherit', textTransform: 'capitalize',
                }}>
                  {r === 'yes' ? '✓ Yes' : r === 'no' ? '✗ No' : '? Maybe'}
                </button>
              ))}
            </div>

            {/* Name */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 6 }}>Your name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            {/* Email */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 6 }}>Email address *</label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email"
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            {/* Message */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 6 }}>Message (optional)</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Add a note..." rows={3}
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontSize: 14, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }} />
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
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              {response === 'yes' ? "See you there!" : response === 'no' ? "Sorry you can't make it" : "We'll keep a spot for you"}
            </h2>
            <p style={{ fontSize: 14, color: '#999' }}>
              Your RSVP has been recorded. Check your email for confirmation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
