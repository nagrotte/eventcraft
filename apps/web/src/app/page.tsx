import { LogoMark } from '@/components/ui/LogoMark';
'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (user) { router.push('/dashboard'); return; }
      setTimeout(() => setVisible(true), 80);
    }
  }, [user, loading, router]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080612', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="ec-spinner" />
    </div>
  );

  if (user) return null;

  const features = [
    {
      icon: '✦',
      title: 'Canvas Invitations',
      desc: 'Design stunning event invitations with a professional canvas editor. Templates, custom artwork, QR codes — all in one place.',
    },
    {
      icon: '◈',
      title: 'Email & WhatsApp',
      desc: 'Send personalized invitations directly to your guest list via email or WhatsApp with one click.',
    },
    {
      icon: '◎',
      title: 'RSVP Tracking',
      desc: 'Know exactly who is coming. Real-time RSVP responses with guest management and attendance tracking.',
    },
    {
      icon: '❋',
      title: 'Photo Gallery',
      desc: 'Share post-event memories with a beautiful hosted gallery linked directly from your event microsite.',
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080612',
      color: '#f0eef8',
      fontFamily: 'Georgia, serif',
      overflowX: 'hidden',
    }}>
      {/* Ambient background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(79,70,229,0.18) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 80% 80%, rgba(212,175,55,0.06) 0%, transparent 60%)',
      }} />

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 40px',
        background: 'rgba(8,6,18,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        {/* Logo */}
        <LogoMark size={28} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => router.push('/auth/login')}
            style={{
              background: 'none', border: 'none', color: 'rgba(240,238,248,0.55)',
              fontSize: 13, cursor: 'pointer', fontFamily: 'Helvetica Neue, sans-serif',
              padding: '8px 16px', borderRadius: 6,
            }}>
            Sign in
          </button>
          <button
            onClick={() => router.push('/auth/register')}
            style={{
              background: '#4F46E5', border: 'none', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Helvetica Neue, sans-serif',
              padding: '8px 20px', borderRadius: 8,
              letterSpacing: '0.01em',
            }}>
            Get started free
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center',
        padding: '120px 24px 80px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.8s ease, transform 0.8s ease',
      }}>
        {/* Eyebrow */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 14px',
          background: 'rgba(212,175,55,0.08)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: 20,
          marginBottom: 32,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#D4AF37', display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: '#D4AF37', fontFamily: 'Helvetica Neue, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Event invitations, reimagined
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(40px, 7vw, 76px)',
          fontWeight: 700,
          lineHeight: 1.08,
          letterSpacing: '-0.03em',
          color: '#f0eef8',
          maxWidth: 820,
          margin: '0 0 24px',
        }}>
          Create events that<br />
          <span style={{
            background: 'linear-gradient(135deg, #7B9FD4 0%, #D4AF37 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            people remember
          </span>
        </h1>

        {/* Subhead */}
        <p style={{
          fontSize: 18,
          color: 'rgba(240,238,248,0.5)',
          maxWidth: 520,
          margin: '0 0 48px',
          lineHeight: 1.65,
          fontFamily: 'Helvetica Neue, sans-serif',
          fontWeight: 300,
        }}>
          Design beautiful invitations, manage RSVPs, send personalized emails — everything you need to host a memorable event.
        </p>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => router.push('/auth/register')}
            style={{
              background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
              border: 'none', color: '#fff',
              fontSize: 15, fontWeight: 600,
              fontFamily: 'Helvetica Neue, sans-serif',
              padding: '14px 36px', borderRadius: 10,
              cursor: 'pointer', letterSpacing: '0.01em',
              boxShadow: '0 8px 32px rgba(79,70,229,0.35)',
            }}>
            Get started — it&apos;s free
          </button>
          <button
            onClick={() => router.push('/auth/login')}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(240,238,248,0.7)',
              fontSize: 15, fontFamily: 'Helvetica Neue, sans-serif',
              padding: '14px 36px', borderRadius: 10,
              cursor: 'pointer',
            }}>
            Sign in
          </button>
        </div>

        {/* Scroll hint */}
        <div style={{ marginTop: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'Helvetica Neue, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Explore</span>
          <div style={{ width: 1, height: 40, background: 'linear-gradient(to bottom, rgba(212,175,55,0.4), transparent)' }} />
        </div>
      </section>

      {/* Features */}
      <section style={{
        position: 'relative', zIndex: 1,
        maxWidth: 1100, margin: '0 auto',
        padding: '40px 24px 120px',
      }}>
        {/* Section label */}
        <p style={{
          textAlign: 'center',
          fontSize: 11, color: 'rgba(255,255,255,0.25)',
          fontFamily: 'Helvetica Neue, sans-serif',
          letterSpacing: '0.12em', textTransform: 'uppercase',
          marginBottom: 56,
        }}>
          Everything you need
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 2,
        }}>
          {features.map((f, i) => (
            <div key={i} style={{
              padding: '40px 32px',
              background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Accent line */}
              <div style={{
                position: 'absolute', top: 0, left: 32, right: 32, height: 1,
                background: i === 0 ? 'linear-gradient(to right, transparent, #D4AF37, transparent)' : 'transparent',
              }} />
              <div style={{
                fontSize: 22,
                color: '#D4AF37',
                marginBottom: 18,
                fontFamily: 'Georgia, serif',
              }}>
                {f.icon}
              </div>
              <h3 style={{
                fontSize: 16, fontWeight: 600,
                color: '#e8e4f8',
                marginBottom: 12,
                letterSpacing: '-0.01em',
              }}>
                {f.title}
              </h3>
              <p style={{
                fontSize: 13, color: 'rgba(240,238,248,0.4)',
                lineHeight: 1.7,
                fontFamily: 'Helvetica Neue, sans-serif',
                fontWeight: 300,
              }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{
        position: 'relative', zIndex: 1,
        textAlign: 'center',
        padding: '80px 24px 120px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{
          width: 1, height: 60, background: 'linear-gradient(to bottom, transparent, rgba(212,175,55,0.3))',
          margin: '0 auto 48px',
        }} />

        {/* Lotus */}
        <div style={{ marginBottom: 28 }}>
          <LogoMark iconOnly={true} size={48} />
        </div>

        <h2 style={{
          fontSize: 'clamp(28px, 4vw, 44px)',
          fontWeight: 700, letterSpacing: '-0.02em',
          color: '#f0eef8', margin: '0 0 16px',
          lineHeight: 1.15,
        }}>
          Your next event starts here
        </h2>
        <p style={{
          fontSize: 15, color: 'rgba(240,238,248,0.4)',
          marginBottom: 40,
          fontFamily: 'Helvetica Neue, sans-serif',
          fontWeight: 300,
        }}>
          Free to start. No credit card required.
        </p>
        <button
          onClick={() => router.push('/auth/register')}
          style={{
            background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
            border: 'none', color: '#fff',
            fontSize: 15, fontWeight: 600,
            fontFamily: 'Helvetica Neue, sans-serif',
            padding: '15px 48px', borderRadius: 10,
            cursor: 'pointer',
            boxShadow: '0 8px 40px rgba(79,70,229,0.3)',
            letterSpacing: '0.01em',
          }}>
          Get started for free
        </button>
      </section>

      {/* Footer */}
      <footer style={{
        position: 'relative', zIndex: 1,
        textAlign: 'center',
        padding: '24px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        <p style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.15)',
          fontFamily: 'Helvetica Neue, sans-serif',
          letterSpacing: '0.04em',
        }}>
          &copy; {new Date().getFullYear()} eventcraft &nbsp;&middot;&nbsp; eventcraft.irotte.com
        </p>
      </footer>
    </div>
  );
}
