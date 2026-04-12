'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvents';
import { EcNav } from '@/components/ui/EcNav';
import { EcButton } from '@/components/ui/EcButton';
import { useEffect, useState, useRef } from 'react';
import apiClient from '@/lib/api-client';

interface RsvpEntry {
  rsvpId:     string;
  name:       string;
  email:      string;
  response:   string;
  guestCount: number;
  checkedIn?: boolean;
}

interface CheckinResult {
  rsvpId:     string;
  name:       string;
  guestCount: number;
  checkedIn:  boolean;
}

export default function CheckinPage() {
  const { eventId }                = useParams<{ eventId: string }>();
  const { user, loading, isAdmin } = useAuth();
  const { data: event }            = useEvent(eventId);
  const router                     = useRouter();

  const [rsvps,         setRsvps]         = useState<RsvpEntry[]>([]);
  const [loadingRsvps,  setLoadingRsvps]  = useState(true);
  const [qrInput,       setQrInput]       = useState('');
  const [checkingIn,    setCheckingIn]    = useState(false);
  const [lastCheckin,   setLastCheckin]   = useState<CheckinResult | null>(null);
  const [error,         setError]         = useState('');
  const [search,        setSearch]        = useState('');
  const inputRef                          = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!eventId) return;
    apiClient.get(`/events/${eventId}/rsvp`).then(res => {
      setRsvps(res.data.data ?? []);
    }).finally(() => setLoadingRsvps(false));
  }, [eventId]);

  // Auto-focus QR input
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function processQrScan(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setQrInput('');
    setError('');
    setLastCheckin(null);

    // QR value format: {eventId}:{rsvpId}
    const parts   = trimmed.split(':');
    const scannedEventId = parts[0];
    const scannedRsvpId  = parts[1];

    if (scannedEventId !== eventId) {
      setError('QR code is for a different event');
      return;
    }

    setCheckingIn(true);
    try {
      const res = await apiClient.post(`/events/${eventId}/rsvp/${scannedRsvpId}/checkin`, {});
      const result: CheckinResult = res.data?.data;
      setLastCheckin(result);
      setRsvps(prev => prev.map(r => r.rsvpId === scannedRsvpId ? { ...r, checkedIn: true } : r));
    } catch { setError('Check-in failed. Guest not found or already checked in.'); }
    finally { setCheckingIn(false); inputRef.current?.focus(); }
  }

  async function manualCheckin(rsvpId: string) {
    setError('');
    setCheckingIn(true);
    try {
      const res = await apiClient.post(`/events/${eventId}/rsvp/${rsvpId}/checkin`, {});
      const result: CheckinResult = res.data?.data;
      setLastCheckin(result);
      setRsvps(prev => prev.map(r => r.rsvpId === rsvpId ? { ...r, checkedIn: true } : r));
    } catch { setError('Check-in failed.'); }
    finally { setCheckingIn(false); }
  }

  const checkedInCount  = rsvps.filter(r => r.checkedIn).length;
  const totalGuests     = rsvps.filter(r => r.checkedIn).reduce((s, r) => s + (r.guestCount ?? 1), 0);
  const filteredRsvps   = rsvps.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg)' }}>
      <EcNav email={user?.email} isAdmin={isAdmin} onLogout={() => {}}
        breadcrumbs={[{ label: 'Events', href: '/dashboard' }, { label: event?.title ?? 'Event' }, { label: 'Check-in' }]} />
      <main className="ec-page" style={{ maxWidth: 720 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ec-text-1)', margin: 0 }}>Guest Check-in</h1>
            <p style={{ fontSize: 13, color: 'var(--ec-text-3)', margin: '4px 0 0' }}>{event?.title}</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 22, fontWeight: 600, color: 'var(--ec-text-1)', margin: 0 }}>{checkedInCount}</p>
              <p style={{ fontSize: 11, color: 'var(--ec-text-3)', margin: 0 }}>checked in</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 22, fontWeight: 600, color: 'var(--ec-brand)', margin: 0 }}>{totalGuests}</p>
              <p style={{ fontSize: 11, color: 'var(--ec-text-3)', margin: 0 }}>guests arrived</p>
            </div>
          </div>
        </div>

        {/* QR scan input */}
        <div style={{ background: 'var(--ec-surface)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-lg)', padding: '20px 24px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ec-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Scan QR Code
          </p>
          <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginBottom: 12, lineHeight: 1.5 }}>
            Point camera at guest QR code, or type/paste the code below. The input is always focused and ready.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              value={qrInput}
              onChange={e => setQrInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') processQrScan(qrInput); }}
              placeholder="Scan QR or type rsvpId..."
              style={{ flex: 1, fontSize: 13, padding: '9px 12px', borderRadius: 'var(--ec-radius-sm)', border: '1px solid var(--ec-border)', background: 'var(--ec-card)', color: 'var(--ec-text-1)', fontFamily: 'inherit', outline: 'none' }}
            />
            <EcButton size="sm" loading={checkingIn} onClick={() => processQrScan(qrInput)}>Check In</EcButton>
          </div>

          {/* Success result */}
          {lastCheckin && (
            <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(45,212,160,0.08)', border: '1px solid rgba(45,212,160,0.25)', borderRadius: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ec-success)', margin: '0 0 2px' }}>✓ Checked in!</p>
              <p style={{ fontSize: 13, color: 'var(--ec-text-1)', margin: 0 }}>{lastCheckin.name} · {lastCheckin.guestCount} guest{lastCheckin.guestCount !== 1 ? 's' : ''}</p>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(240,89,90,0.08)', border: '1px solid rgba(240,89,90,0.2)', borderRadius: 8 }}>
              <p style={{ fontSize: 13, color: 'var(--ec-danger)', margin: 0 }}>{error}</p>
            </div>
          )}
        </div>

        {/* RSVP list with manual check-in */}
        <div style={{ background: 'var(--ec-surface)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-lg)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ec-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Guest List</p>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guest..."
              style={{ fontSize: 12, padding: '5px 10px', borderRadius: 'var(--ec-radius-sm)', border: '1px solid var(--ec-border)', background: 'var(--ec-card)', color: 'var(--ec-text-1)', fontFamily: 'inherit', width: 180 }} />
          </div>
          {loadingRsvps ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="ec-spinner" /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredRsvps.filter(r => r.response !== 'no').map(r => (
                <div key={r.rsvpId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: r.checkedIn ? 'rgba(45,212,160,0.06)' : 'var(--ec-card)', border: `1px solid ${r.checkedIn ? 'rgba(45,212,160,0.2)' : 'var(--ec-border)'}`, borderRadius: 'var(--ec-radius-sm)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ec-text-1)', margin: 0 }}>{r.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--ec-text-3)', margin: 0 }}>{r.guestCount ?? 1} guest{(r.guestCount ?? 1) !== 1 ? 's' : ''}</p>
                  </div>
                  {r.checkedIn ? (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(45,212,160,0.12)', color: 'var(--ec-success)', border: '1px solid rgba(45,212,160,0.25)' }}>✓ Checked in</span>
                  ) : (
                    <EcButton size="sm" variant="ghost" onClick={() => manualCheckin(r.rsvpId)}>Check in</EcButton>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
