'use client';

import { useState } from 'react';
import { EcButton } from '@/components/ui/EcButton';
import { EcInput }  from '@/components/ui/EcInput';

interface QrConfigDialogProps {
  eventId:  string;
  onPlace:  (url: string) => void;
  onClose:  () => void;
}

const PRESETS = (eventId: string) => [
  {
    label:       'RSVP Page',
    description: 'Guests scan to RSVP for this event',
    url:         `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourdomain.com'}/rsvp/${eventId}`,
  },
  {
    label:       'Event Microsite',
    description: 'Public event details page',
    url:         `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourdomain.com'}/event/${eventId}`,
  },
  {
    label:       'WhatsApp Group',
    description: 'Link to a WhatsApp group or message',
    url:         'https://wa.me/1234567890',
  },
  {
    label:       'Google Maps',
    description: 'Directions to the venue',
    url:         'https://maps.google.com/?q=',
  },
  {
    label:       'Website / Custom URL',
    description: 'Any URL you choose',
    url:         '',
  },
];

export function QrConfigDialog({ eventId, onPlace, onClose }: QrConfigDialogProps) {
  const presets = PRESETS(eventId);
  const [selected, setSelected] = useState(0);
  const [customUrl, setCustomUrl] = useState('');

  const finalUrl = selected === presets.length - 1
    ? customUrl
    : presets[selected].url;

  return (
    <div style={{
      position:   'fixed',
      inset:      0,
      background: 'rgba(0,0,0,0.6)',
      display:    'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex:     2000,
    }}>
      <div style={{
        background:   'var(--ec-surface)',
        border:       '1px solid var(--ec-border)',
        borderRadius: 'var(--ec-radius-xl)',
        padding:      28,
        width:        440,
        boxShadow:    'var(--ec-shadow-lg)',
      }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ec-text-1)', marginBottom: 4 }}>
            Configure QR Code
          </h2>
          <p style={{ fontSize: 12, color: 'var(--ec-text-3)' }}>
            Choose what happens when guests scan this QR code
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {presets.map((preset, i) => (
            <div
              key={i}
              onClick={() => setSelected(i)}
              style={{
                padding:      '12px 14px',
                borderRadius: 'var(--ec-radius-md)',
                border:       `1px solid ${selected === i ? 'var(--ec-brand)' : 'var(--ec-border)'}`,
                background:   selected === i ? 'var(--ec-brand-subtle)' : 'var(--ec-surface-raised)',
                cursor:       'pointer',
                transition:   'all 0.12s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: selected === i ? 'var(--ec-brand)' : 'var(--ec-text-1)' }}>
                  {preset.label}
                </span>
                {selected === i && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" fill="var(--ec-brand)"/>
                    <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
              <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginTop: 2 }}>
                {preset.description}
              </p>
              {selected === i && preset.url && (
                <p style={{ fontSize: 10, color: 'var(--ec-brand)', marginTop: 4, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  {preset.url}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Custom URL input */}
        {selected === presets.length - 1 && (
          <div style={{ marginBottom: 16 }}>
            <EcInput
              label="Custom URL"
              value={customUrl}
              onChange={e => setCustomUrl(e.target.value)}
              placeholder="https://yourdomain.com/..."
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <EcButton variant="ghost" onClick={onClose}>Cancel</EcButton>
          <EcButton
            onClick={() => finalUrl && onPlace(finalUrl)}
            disabled={!finalUrl}
          >
            Add QR Code
          </EcButton>
        </div>
      </div>
    </div>
  );
}
