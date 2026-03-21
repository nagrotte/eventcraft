'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EcButton } from '@/components/ui/EcButton';

interface Breadcrumb { label: string; href?: string; }
interface EcNavProps {
  email?:       string;
  onLogout?:    () => void;
  breadcrumbs?: Breadcrumb[];
}

function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#0F0A2E"/>
      <g transform="translate(16, 17)">
        <ellipse cx="0"   cy="-10" rx="4"   ry="9"   fill="#6366F1" opacity="0.9"/>
        <ellipse cx="8"   cy="-6"  rx="3.5" ry="7.5" fill="#6366F1" opacity="0.7" transform="rotate(35 8 -6)"/>
        <ellipse cx="-8"  cy="-6"  rx="3.5" ry="7.5" fill="#6366F1" opacity="0.7" transform="rotate(-35 -8 -6)"/>
        <ellipse cx="12"  cy="1"   rx="3"   ry="6"   fill="#818CF8" opacity="0.35" transform="rotate(60 12 1)"/>
        <ellipse cx="-12" cy="1"   rx="3"   ry="6"   fill="#818CF8" opacity="0.35" transform="rotate(-60 -12 1)"/>
        <ellipse cx="0"   cy="-6"  rx="2.5" ry="5.5" fill="#D4AF37" opacity="0.95"/>
        <ellipse cx="5"   cy="-4"  rx="2"   ry="5"   fill="#D4AF37" opacity="0.8" transform="rotate(30 5 -4)"/>
        <ellipse cx="-5"  cy="-4"  rx="2"   ry="5"   fill="#D4AF37" opacity="0.8" transform="rotate(-30 -5 -4)"/>
        <circle cx="0" cy="-6" r="3"   fill="#0F0A2E"/>
        <circle cx="0" cy="-6" r="1.8" fill="#D4AF37"/>
        <line x1="0" y1="2" x2="0" y2="8" stroke="#6366F1" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      </g>
    </svg>
  );
}

export function EcNav({ email, onLogout, breadcrumbs }: EcNavProps) {
  const router = useRouter();

  return (
    <nav style={{
      height: 52, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 20px',
      borderBottom: '1px solid var(--ec-border)',
      background: 'var(--ec-surface)', flexShrink: 0,
    }}>
      {/* Left: logo + breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
          <LogoMark size={28} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ec-text-1)', fontFamily: 'Georgia, serif', letterSpacing: '-0.3px' }}>
            Event<span style={{ color: 'var(--ec-brand)', fontWeight: 400 }}>Craft</span>
          </span>
        </Link>

        {breadcrumbs && breadcrumbs.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            {breadcrumbs.map((b, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                <span style={{ color: 'var(--ec-text-3)', fontSize: 13 }}>/</span>
                {b.href ? (
                  <Link href={b.href} style={{ fontSize: 13, color: 'var(--ec-text-2)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                    {b.label}
                  </Link>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--ec-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                    {b.label}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right: email + logout */}
      {email && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--ec-text-3)', display: 'none' }} className="ec-nav-email">{email}</span>
          {onLogout && (
            <EcButton variant="ghost" size="sm" onClick={onLogout}>Sign out</EcButton>
          )}
        </div>
      )}
    </nav>
  );
}
