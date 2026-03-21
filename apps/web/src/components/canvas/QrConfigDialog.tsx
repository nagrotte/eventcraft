'use client';

import { useState } from 'react';
import { EcButton } from '@/components/ui/EcButton';
import { EcInput }  from '@/components/ui/EcInput';

interface QrConfigDialogProps {
  eventId:       string;
  eventTitle?:   string;
  eventDate?:    string;
  eventLocation?: string;
  micrositeSlug?: string;
  organizerName?:  string;
  organizerPhone?: string;
  organizerEmail?: string;
  onPlace:  (url: string) => void;
  onClose:  () => void;
}

type QrType = 'rsvp' | 'microsite' | 'maps' | 'calendar' | 'vcard' | 'whatsapp' | 'custom';

interface QrOption {
  type:        QrType;
  label:       string;
  description: string;
  icon:        string;
  needsInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
}

const OPTIONS: QrOption[] = [
  {
    type:        'rsvp',
    label:       'RSVP Page',
    description: 'Guests scan to RSVP for this event',
    icon:        '✉',
  },
  {
    type:        'microsite',
    label:       'Event Microsite',
    description: 'Full event page with details, schedule and photos',
    icon:        '🌐',
  },
  {
    type:        'maps',
    label:       'Google Maps — Directions',
    description: 'Scan to get directions to the venue',
    icon:        '📍',
    needsInput:  true,
    inputLabel:  'Venue address',
    inputPlaceholder: '25731 Jewel Springs Ln, Katy, TX 77494',
  },
  {
    type:        'calendar',
    label:       'Add to Calendar',
    description: 'Scan to add this event to phone calendar',
    icon:        '📅',
  },
  {
    type:        'vcard',
    label:       'Organizer Contact',
    description: 'Scan to save organizer as a phone contact',
    icon:        '👤',
  },
  {
    type:        'whatsapp',
    label:       'WhatsApp Message',
    description: 'Scan to open WhatsApp with a pre-filled RSVP message',
    icon:        '💬',
    needsInput:  true,
    inputLabel:  'WhatsApp number (with country code)',
    inputPlaceholder: '14155551234',
  },
  {
    type:        'custom',
    label:       'Custom URL',
    description: 'Any URL you choose',
    icon:        '🔗',
    needsInput:  true,
    inputLabel:  'URL',
    inputPlaceholder: 'https://',
  },
];

function buildICalContent(title: string, dateStr: string, location: string): string {
  const dt = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const end = new Date(dt.getTime() + 2 * 60 * 60 * 1000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `SUMMARY:${title}`,
    `DTSTART:${fmt(dt)}`,
    `DTEND:${fmt(end)}`,
    location ? `LOCATION:${location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

function buildVCard(name: string, phone: string, email: string): string {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    phone ? `TEL:${phone}` : '',
    email ? `EMAIL:${email}` : '',
    'END:VCARD',
  ].filter(Boolean).join('\n');
}

export function QrConfigDialog({
  eventId, eventTitle = 'Event', eventDate = '', eventLocation = '',
  micrositeSlug, organizerName = '', organizerPhone = '', organizerEmail = '',
  onPlace, onClose,
}: QrConfigDialogProps) {
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eventcraft.irotte.com';
  const rsvpUrl    = `${appUrl}/rsvp/${eventId}`;
  const siteUrl    = micrositeSlug ? `${appUrl}/e/${micrositeSlug}` : `${appUrl}/rsvp/${eventId}`;

  const [selected, setSelected]   = useState<QrType>('rsvp');
  const [inputVal, setInputVal]   = useState('');

  const opt = OPTIONS.find(o => o.type === selected)!;

  function getFinalUrl(): string {
    switch (selected) {
      case 'rsvp':
        return rsvpUrl;
      case 'microsite':
        return siteUrl;
      case 'maps': {
        const addr = inputVal.trim() || eventLocation;
        return `https://maps.google.com/?q=${encodeURIComponent(addr)}`;
      }
      case 'calendar': {
        const ical = buildICalContent(eventTitle, eventDate, eventLocation);
        return `data:text/calendar;charset=utf-8,${encodeURIComponent(ical)}`;
      }
      case 'vcard': {
        const vc = buildVCard(
          inputVal.trim() || organizerName,
          organizerPhone,
          organizerEmail
        );
        return `data:text/vcard;charset=utf-8,${encodeURIComponent(vc)}`;
      }
      case 'whatsapp': {
        const phone = inputVal.trim().replace(/[^0-9]/g, '');
        const msg   = `You're invited to ${eventTitle}! RSVP here: ${rsvpUrl}`;
        return phone
          ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
          : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      }
      case 'custom':
        return inputVal.trim();
      default:
        return '';
    }
  }

  function getPreview(): string {
    const url = getFinalUrl();
    if (!url) return '';
    if (url.startsWith('data:')) return url.substring(0, 60) + '...';
    return url.length > 60 ? url.substring(0, 60) + '...' : url;
  }

  const canPlace = !!getFinalUrl() &&
    (selected !== 'custom' || inputVal.trim().startsWith('http'));

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
    }}>
      <div style={{
        background: 'var(--ec-surface)', border: '1px solid var(--ec-border)',
        borderRadius: 'var(--ec-radius-xl)', padding: 28, width: 480,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--ec-shadow-lg)',
      }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ec-text-1)', marginBottom: 4 }}>
            Configure QR Code
          </h2>
          <p style={{ fontSize: 12, color: 'var(--ec-text-3)' }}>
            Choose what happens when guests scan this QR code
          </p>
        </div>

        {/* Options grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {OPTIONS.map(o => {
            const active = selected === o.type;
            return (
              <div
                key={o.type}
                onClick={() => { setSelected(o.type); setInputVal(''); }}
                style={{
                  padding: '10px 14px', borderRadius: 'var(--ec-radius-md)',
                  border: `1px solid ${active ? 'var(--ec-brand)' : 'var(--ec-border)'}`,
                  background: active ? 'var(--ec-brand-subtle)' : 'var(--ec-surface-raised)',
                  cursor: 'pointer', transition: 'all 0.12s',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{o.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: active ? 'var(--ec-brand)' : 'var(--ec-text-1)' }}>
                      {o.label}
                    </span>
                    {active && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="6" fill="var(--ec-brand)"/>
                        <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginTop: 1 }}>{o.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input for options that need it */}
        {opt.needsInput && (
          <div style={{ marginBottom: 14 }}>
            <EcInput
              label={opt.inputLabel}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder={opt.inputPlaceholder}
            />
            {selected === 'maps' && eventLocation && (
              <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginTop: 4 }}>
                Leave blank to use event location: <em>{eventLocation}</em>
              </p>
            )}
            {selected === 'vcard' && organizerName && (
              <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginTop: 4 }}>
                Leave blank to use organizer name: <em>{organizerName}</em>
              </p>
            )}
            {selected === 'whatsapp' && (
              <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginTop: 4 }}>
                Leave blank to open WhatsApp without a specific contact
              </p>
            )}
          </div>
        )}

        {/* Preview */}
        {getFinalUrl() && (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: 'var(--ec-bg)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-sm)' }}>
            <p style={{ fontSize: 10, color: 'var(--ec-text-3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>QR will encode</p>
            <p style={{ fontSize: 11, color: 'var(--ec-text-2)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {getPreview()}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <EcButton variant="ghost" onClick={onClose}>Cancel</EcButton>
          <EcButton onClick={() => canPlace && onPlace(getFinalUrl())} disabled={!canPlace}>
            Add QR Code
          </EcButton>
        </div>
      </div>
    </div>
  );
}
