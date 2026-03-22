'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvents';
import { EcNav } from '@/components/ui/EcNav';
import { EcButton } from '@/components/ui/EcButton';
import { EcInput } from '@/components/ui/EcInput';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';

interface Contact {
  contactId: string;
  name:      string;
  email?:    string;
  phone?:    string;
}

type Tab = 'email' | 'whatsapp';

export default function InvitePage() {
  const { eventId }               = useParams<{ eventId: string }>();
  const { user, loading, isAdmin } = useAuth();
  const { data: event }           = useEvent(eventId);
  const router                    = useRouter();

  const [tab,          setTab]          = useState<Tab>('email');
  const [contacts,     setContacts]     = useState<Contact[]>([]);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [loadingC,     setLoadingC]     = useState(true);
  const [sending,      setSending]      = useState(false);
  const [sent,         setSent]         = useState<string[]>([]);
  const [error,        setError]        = useState('');
  const [showAdd,      setShowAdd]      = useState(false);
  const [newName,      setNewName]      = useState('');
  const [newEmail,     setNewEmail]     = useState('');
  const [newPhone,     setNewPhone]     = useState('');
  const [addingC,      setAddingC]      = useState(false);
  const [message,      setMessage]      = useState('');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eventcraft.irotte.com';
  const rsvpUrl = `${appUrl}/rsvp/${eventId}`;

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    loadContacts();
  }, [user]);

  useEffect(() => {
    if (!event) return;
    const formattedDate = event.eventDate
      ? new Date(event.eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : '';
    setMessage(
      tab === 'email'
        ? ''
        : `You are invited to *${event.title}*!\n\n📅 ${formattedDate}${event.location ? `\n📍 ${event.location}` : ''}\n\nRSVP here: ${rsvpUrl}`
    );
  }, [event, tab]);

  async function loadContacts() {
    setLoadingC(true);
    try {
      const res = await apiClient.get('/contacts');
      setContacts(res.data.data ?? []);
    } catch { setError('Failed to load contacts'); }
    finally { setLoadingC(false); }
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddingC(true);
    try {
      const res = await apiClient.post('/contacts', { name: newName, email: newEmail, phone: newPhone });
      setContacts(prev => [...prev, res.data.data]);
      setNewName(''); setNewEmail(''); setNewPhone('');
      setShowAdd(false);
    } catch { setError('Failed to add contact'); }
    finally { setAddingC(false); }
  }

  async function deleteContact(contactId: string) {
    try {
      await apiClient.delete(`/contacts/${contactId}`);
      setContacts(prev => prev.filter(c => c.contactId !== contactId));
      setSelected(prev => { const s = new Set(prev); s.delete(contactId); return s; });
    } catch { setError('Failed to delete contact'); }
  }

  function toggleContact(contactId: string) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(contactId) ? s.delete(contactId) : s.add(contactId);
      return s;
    });
  }

  function toggleAll() {
    const eligible = contacts.filter(c => tab === 'email' ? !!c.email : !!c.phone);
    if (selected.size === eligible.length) setSelected(new Set());
    else setSelected(new Set(eligible.map(c => c.contactId)));
  }

  async function sendEmailBlast() {
    const targets = contacts.filter(c => selected.has(c.contactId) && c.email);
    if (!targets.length) { setError('No contacts with email selected'); return; }
    setSending(true); setError('');
    try {
      const res = await apiClient.post(`/events/${eventId}/invite/email`, {
        contactIds: targets.map(c => c.contactId)
      });
      setSent(res.data.data?.sent ?? []);
      setSelected(new Set());
    } catch { setError('Failed to send emails'); }
    finally { setSending(false); }
  }

  function openWhatsApp(contact: Contact) {
    const text = message || `You are invited to ${event?.title}! RSVP: ${rsvpUrl}`;
    const personalised = text.replace('{name}', contact.name);
    const phone = contact.phone?.replace(/[^0-9]/g, '') ?? '';
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(personalised)}`, '_blank');
  }

  function whatsAppBlastLink() {
    const text = message || `You are invited to ${event?.title}! RSVP: ${rsvpUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  const eligible = contacts.filter(c => tab === 'email' ? !!c.email : !!c.phone);
  const selectedContacts = contacts.filter(c => selected.has(c.contactId));

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px', borderRadius: 'var(--ec-radius-md)', fontSize: 13,
    fontWeight: active ? 600 : 400, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--ec-brand)' : 'var(--ec-border)'}`,
    background: active ? 'var(--ec-brand-subtle)' : 'transparent',
    color: active ? 'var(--ec-brand)' : 'var(--ec-text-2)',
    fontFamily: 'inherit', transition: 'all 0.12s',
  });

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
          { label: 'Invite' },
        ]}
      />
      <main className="ec-page" style={{ maxWidth: 900 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Send Invitations
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ec-text-3)' }}>
            {event?.title} · {event?.eventDate ? new Date(event.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button style={tabStyle(tab === 'email')}    onClick={() => setTab('email')}>
            ✉ Email
          </button>
          <button style={tabStyle(tab === 'whatsapp')} onClick={() => setTab('whatsapp')}>
            💬 WhatsApp
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>

          {/* Left: Contacts */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ec-text-1)' }}>
                  Contacts <span style={{ color: 'var(--ec-text-3)', fontWeight: 400 }}>({contacts.length})</span>
                </p>
                {eligible.length > 0 && (
                  <button onClick={toggleAll} style={{ fontSize: 11, color: 'var(--ec-brand)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {selected.size === eligible.length ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <EcButton size="sm" onClick={() => setShowAdd(!showAdd)}>+ Add contact</EcButton>
                <EcButton size="sm" variant="ghost" onClick={() => router.push('/contacts/import')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 12A10 10 0 1 1 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M22 2L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M16 2h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Import Gmail
                </EcButton>
              </div>
            </div>

            {/* Add contact form */}
            {showAdd && (
              <div style={{ background: 'var(--ec-surface)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-lg)', padding: 16, marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ec-text-2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Contact</p>
                <form onSubmit={addContact} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <EcInput placeholder="Full name *" value={newName} onChange={e => setNewName(e.target.value)} required />
                  <EcInput placeholder="Email address" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                  <EcInput placeholder="WhatsApp number (with country code, e.g. 14155551234)" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <EcButton type="submit" size="sm" loading={addingC}>Add</EcButton>
                    <EcButton type="button" size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</EcButton>
                  </div>
                </form>
              </div>
            )}

            {/* Contact list */}
            {loadingC ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="ec-spinner" /></div>
            ) : contacts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', background: 'var(--ec-surface)', borderRadius: 'var(--ec-radius-lg)', border: '1px solid var(--ec-border)' }}>
                <p style={{ fontSize: 14, color: 'var(--ec-text-2)', marginBottom: 8 }}>No contacts yet</p>
                <p style={{ fontSize: 12, color: 'var(--ec-text-3)' }}>Add your first contact above</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {contacts.map(c => {
                  const hasChannel = tab === 'email' ? !!c.email : !!c.phone;
                  const isSelected = selected.has(c.contactId);
                  return (
                    <div key={c.contactId} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      background: 'var(--ec-surface)', borderRadius: 'var(--ec-radius-md)',
                      border: `1px solid ${isSelected ? 'var(--ec-brand-border)' : 'var(--ec-border)'}`,
                      opacity: hasChannel ? 1 : 0.5, transition: 'all 0.12s',
                    }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!hasChannel}
                        onChange={() => toggleContact(c.contactId)}
                        style={{ width: 15, height: 15, accentColor: 'var(--ec-brand)', cursor: hasChannel ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                      />
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: isSelected ? 'var(--ec-brand-subtle)' : 'var(--ec-surface-raised)', border: `1px solid ${isSelected ? 'var(--ec-brand-border)' : 'var(--ec-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? 'var(--ec-brand)' : 'var(--ec-text-2)' }}>{c.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ec-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--ec-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tab === 'email' ? (c.email || 'No email') : (c.phone || 'No phone')}
                        </p>
                      </div>
                      {tab === 'whatsapp' && c.phone && (
                        <EcButton size="sm" variant="ghost" onClick={() => openWhatsApp(c)} style={{ flexShrink: 0, fontSize: 11 }}>
                          Open
                        </EcButton>
                      )}
                      {!hasChannel && (
                        <span style={{ fontSize: 10, color: 'var(--ec-text-3)', flexShrink: 0 }}>
                          No {tab === 'email' ? 'email' : 'phone'}
                        </span>
                      )}
                      <button onClick={() => deleteContact(c.contactId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ec-text-3)', fontSize: 16, flexShrink: 0, padding: 0 }}>×</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Send panel */}
          <div style={{ position: 'sticky', top: 20 }}>
            <div style={{ background: 'var(--ec-surface)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-lg)', padding: 20 }}>

              {tab === 'email' ? (
                <>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ec-text-1)', marginBottom: 16 }}>Email Invitation</p>
                  {/* Preview */}
                  <div style={{ background: 'var(--ec-bg)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-md)', padding: 16, marginBottom: 16, fontSize: 12 }}>
                    <p style={{ color: 'var(--ec-text-3)', marginBottom: 4 }}>FROM</p>
                    <p style={{ color: 'var(--ec-text-1)', marginBottom: 8 }}>noreply@pragmaticconsulting.net</p>
                    <p style={{ color: 'var(--ec-text-3)', marginBottom: 4 }}>SUBJECT</p>
                    <p style={{ color: 'var(--ec-text-1)', marginBottom: 8 }}>You're invited: {event?.title}</p>
                    <p style={{ color: 'var(--ec-text-3)', marginBottom: 4 }}>CONTENT</p>
                    <p style={{ color: 'var(--ec-text-2)', fontSize: 11, lineHeight: 1.5 }}>
                      Beautifully formatted HTML email with event design, date, location and RSVP button.
                    </p>
                  </div>
                  <div style={{ marginBottom: 16, padding: '8px 12px', background: 'var(--ec-brand-subtle)', border: '1px solid var(--ec-brand-border)', borderRadius: 'var(--ec-radius-md)' }}>
                    <p style={{ fontSize: 12, color: 'var(--ec-brand)', fontWeight: 500 }}>
                      {selected.size} contact{selected.size !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                  {error && <p style={{ fontSize: 12, color: 'var(--ec-danger)', marginBottom: 12 }}>{error}</p>}
                  {sent.length > 0 && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--ec-success-bg)', border: '1px solid var(--ec-success-border)', borderRadius: 'var(--ec-radius-md)' }}>
                      <p style={{ fontSize: 12, color: 'var(--ec-success)' }}>✓ Sent to {sent.length} contact{sent.length !== 1 ? 's' : ''}</p>
                    </div>
                  )}
                  <EcButton fullWidth loading={sending} onClick={sendEmailBlast} disabled={selected.size === 0}>
                    Send {selected.size > 0 ? `to ${selected.size}` : ''} via Email
                  </EcButton>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ec-text-1)', marginBottom: 12 }}>WhatsApp Message</p>
                  <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginBottom: 8 }}>
                    Customize the message. Use <code style={{ background: 'var(--ec-surface-raised)', padding: '1px 4px', borderRadius: 3 }}>{'{name}'}</code> for personalization.
                  </p>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={6}
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--ec-bg)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-md)', color: 'var(--ec-text-1)', fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, marginBottom: 12 }}
                  />
                  <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginBottom: 12 }}>
                    Select contacts above and click "Open" next to each, or use the blast link below to share with anyone.
                  </p>
                  <EcButton fullWidth variant="secondary" onClick={whatsAppBlastLink}>
                    Open WhatsApp with message
                  </EcButton>
                  <p style={{ fontSize: 10, color: 'var(--ec-text-3)', marginTop: 8, textAlign: 'center', lineHeight: 1.5 }}>
                    Opens WhatsApp on your device. Select contacts there to send.
                  </p>
                </>
              )}
            </div>

            {/* RSVP link */}
            <div style={{ background: 'var(--ec-surface)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-lg)', padding: 16, marginTop: 12 }}>
              <p style={{ fontSize: 11, color: 'var(--ec-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>RSVP Link</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, padding: '6px 10px', background: 'var(--ec-bg)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-sm)', fontSize: 10, color: 'var(--ec-text-2)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rsvpUrl}
                </div>
                <EcButton size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(rsvpUrl)}>Copy</EcButton>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
