'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { EcNav } from '@/components/ui/EcNav';
import { EcButton } from '@/components/ui/EcButton';
import apiClient from '@/lib/api-client';

interface GoogleContact {
  name:  string;
  email: string;
  phone: string;
}

function ContactImportInner() {
  const { user, loading, isAdmin, logout } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [contacts,   setContacts]   = useState<GoogleContact[]>([]);
  const [selected,   setSelected]   = useState<Set<number>>(new Set());
  const [importing,  setImporting]  = useState(false);
  const [imported,   setImported]   = useState(0);
  const [error,      setError]      = useState('');
  const [step,       setStep]       = useState<'loading' | 'select' | 'done' | 'error'>('loading');

  useEffect(() => {
    if (!loading && !user) { router.push('/auth/login'); return; }
  }, [user, loading, router]);

  useEffect(() => {
    const contactsParam = searchParams.get('contacts');
    const errorParam    = searchParams.get('error');

    if (errorParam) {
      const msg = errorParam === 'cancelled' ? 'Import cancelled.' : 'Failed to connect to Google. Please try again.';
      setError(msg);
      setStep('error');
      return;
    }

    if (contactsParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(contactsParam));
        setContacts(parsed);
        // Select all by default
        setSelected(new Set(parsed.map((_: any, i: number) => i)));
        setStep('select');
      } catch {
        setError('Failed to read contacts from Google.');
        setStep('error');
      }
      return;
    }

    // No params — redirect to Google OAuth
    window.location.href = '/api/auth/google';
  }, [searchParams]);

  function toggleContact(i: number) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(i) ? s.delete(i) : s.add(i);
      return s;
    });
  }

  function toggleAll() {
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map((_, i) => i)));
  }

  async function importSelected() {
    const toImport = contacts.filter((_, i) => selected.has(i));
    if (!toImport.length) return;

    setImporting(true);
    setError('');
    let count = 0;

    for (const contact of toImport) {
      try {
        await apiClient.post('/contacts', {
          name:  contact.name,
          email: contact.email || undefined,
          phone: contact.phone || undefined,
        });
        count++;
      } catch {
        // Skip duplicates/errors silently
      }
    }

    setImported(count);
    setImporting(false);
    setStep('done');
  }

  if (loading || step === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ec-bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="ec-spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ fontSize: 13, color: 'var(--ec-text-3)' }}>Connecting to Google...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg)' }}>
      <EcNav
        email={user?.email}
        isAdmin={isAdmin}
        onLogout={logout}
        breadcrumbs={[{ label: 'Invite', href: '#' }, { label: 'Import from Gmail' }]}
      />
      <main className="ec-page" style={{ maxWidth: 680 }}>

        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ fontSize: 32, marginBottom: 16 }}>⚠️</p>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ec-text-1)', marginBottom: 8 }}>Import failed</h1>
            <p style={{ fontSize: 14, color: 'var(--ec-text-3)', marginBottom: 24 }}>{error}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <EcButton onClick={() => window.location.href = '/api/auth/google'}>Try again</EcButton>
              <EcButton variant="ghost" onClick={() => router.back()}>Go back</EcButton>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>✅</p>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ec-text-1)', marginBottom: 8 }}>
              {imported} contact{imported !== 1 ? 's' : ''} imported
            </h1>
            <p style={{ fontSize: 14, color: 'var(--ec-text-3)', marginBottom: 24 }}>
              They are now available in your EventCraft contacts.
            </p>
            <EcButton onClick={() => router.back()}>Back to Invite</EcButton>
          </div>
        )}

        {step === 'select' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em', marginBottom: 4 }}>
                Import from Gmail
              </h1>
              <p style={{ fontSize: 13, color: 'var(--ec-text-3)' }}>
                {contacts.length} contacts found · {selected.size} selected
              </p>
            </div>

            {/* Search + select all */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button
                onClick={toggleAll}
                style={{ fontSize: 12, color: 'var(--ec-brand)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {selected.size === contacts.length ? 'Deselect all' : 'Select all'}
              </button>
              <p style={{ fontSize: 12, color: 'var(--ec-text-3)' }}>
                {selected.size} of {contacts.length} selected
              </p>
            </div>

            {/* Contact list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24, maxHeight: 480, overflowY: 'auto', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-lg)', padding: 8 }}>
              {contacts.map((c, i) => {
                const isSelected = selected.has(i);
                return (
                  <div
                    key={i}
                    onClick={() => toggleContact(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                      borderRadius: 'var(--ec-radius-md)', cursor: 'pointer',
                      background: isSelected ? 'var(--ec-brand-subtle)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--ec-brand-border)' : 'transparent'}`,
                      transition: 'all 0.1s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleContact(i)}
                      onClick={e => e.stopPropagation()}
                      style={{ width: 14, height: 14, accentColor: 'var(--ec-brand)', flexShrink: 0 }}
                    />
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: isSelected ? 'var(--ec-brand)' : 'var(--ec-surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? '#fff' : 'var(--ec-text-2)' }}>
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ec-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--ec-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[c.email, c.phone].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {error && <p style={{ fontSize: 12, color: 'var(--ec-danger)', marginBottom: 12 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <EcButton
                onClick={importSelected}
                loading={importing}
                disabled={selected.size === 0 || importing}
              >
                {importing ? 'Importing...' : `Import ${selected.size} contact${selected.size !== 1 ? 's' : ''}`}
              </EcButton>
              <EcButton variant="ghost" onClick={() => router.back()}>Cancel</EcButton>
            </div>
          </>
        )}

      </main>
    </div>
  );
}

export default function ContactImportPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="ec-spinner" />
      </div>
    }>
      <ContactImportInner />
    </Suspense>
  );
}