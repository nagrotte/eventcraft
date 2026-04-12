'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { EcNav } from '@/components/ui/EcNav';
import { EcButton } from '@/components/ui/EcButton';
import { EcInput } from '@/components/ui/EcInput';
import apiClient from '@/lib/api-client';
import { useEffect } from 'react';

interface ScheduleItem { time: string; description: string; }
interface ChecklistItem { category: string; item: string; }
interface BudgetItem { category: string; estimate: string; }

interface AIPlan {
  title:           string;
  description:     string;
  suggestedDate:   string;
  location:        string;
  schedule:        ScheduleItem[];
  checklist:       ChecklistItem[];
  budget:          BudgetItem[];
  invitationDraft: string;
  reminderCopy:    string;
}

type Step = 'describe' | 'generating' | 'review' | 'creating';

export default function AIPlannerPage() {
  const { user, loading, logout, isAdmin } = useAuth();
  const router = useRouter();

  const [step,        setStep]        = useState<Step>('describe');
  const [creating,     setCreating]     = useState(false);
  const [description, setDescription] = useState('');
  const [plan,        setPlan]        = useState<AIPlan | null>(null);
  const [error,       setError]       = useState('');

  // Editable plan fields
  const [title,       setTitle]       = useState('');
  const [desc,        setDesc]        = useState('');
  const [location,    setLocation]    = useState('');
  const [eventDate,   setEventDate]   = useState('');
  const [schedule,    setSchedule]    = useState<ScheduleItem[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!plan) return;
    setTitle(plan.title);
    setDesc(plan.description);
    setLocation(plan.location);
    setSchedule(plan.schedule ?? []);
    // Suggest date as next occurrence if vague
    if (plan.suggestedDate) {
      try {
        const d = new Date(plan.suggestedDate);
        if (!isNaN(d.getTime())) {
          setEventDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
        }
      } catch { }
    }
  }, [plan]);

  async function generatePlan() {
    if (!description.trim()) { setError('Please describe your event'); return; }
    setError('');
    setStep('generating');
    try {
      const res = await fetch('/api/ai-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Failed');
      const parsed: AIPlan = data.data;
      setPlan(parsed);
      setStep('review');
    } catch (e) {
      console.error(e);
      setError('Failed to generate plan. Please try again.');
      setStep('describe');
    }
  }

  async function createEvent() {
    setCreating(true);
    try {
      const res = await apiClient.post('/events', {
        title:       title.trim(),
        description: desc.trim() || undefined,
        eventDate:   eventDate ? new Date(eventDate).toISOString() : new Date().toISOString(),
        location:    location.trim() || undefined,
        schedule:    schedule.length > 0 ? JSON.stringify(schedule) : undefined,
      });
      const newEvent = res.data?.data ?? res.data;
      if (newEvent?.eventId) router.push(`/events/${newEvent.eventId}/settings`);
    } catch {
      setError('Failed to create event');
    } finally {
      setCreating(false);
    }
  }

  const sectionStyle: React.CSSProperties = {
    background: 'var(--ec-surface)', border: '1px solid var(--ec-border)',
    borderRadius: 'var(--ec-radius-lg)', padding: '20px 24px', marginBottom: 16,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--ec-text-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, display: 'block',
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ec-bg)' }}>
      <div className="ec-spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg)' }}>
      <EcNav email={user?.email} isAdmin={isAdmin} onLogout={logout}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'AI Planner (Beta)' }]} />
      <main className="ec-page" style={{ maxWidth: 720 }}>

        {/* Beta badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em', margin: 0 }}>
            AI Event Planner
          </h1>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', letterSpacing: '0.08em' }}>
            BETA
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ec-text-3)', marginBottom: 28, lineHeight: 1.6 }}>
          Describe your event in plain English and AI will generate a complete plan — title, schedule, checklist, budget estimate, and invitation copy.
        </p>

        {error && <div className="ec-error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Step 1: Describe */}
        {step === 'describe' && (
          <div style={sectionStyle}>
            <span style={labelStyle}>Describe your event</span>
            <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginBottom: 14, lineHeight: 1.6 }}>
              Be as specific as you like — type of event, expected guests, date, location, cultural traditions, budget range, etc.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={"Example: I'm hosting a Telugu classical music concert for 40 guests at my home in Katy TX. The event will be on a Sunday evening around 5pm. We want Carnatic music, a discourse, and prasadam. Budget around $2000."}
                rows={5}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--ec-radius-sm)', background: 'var(--ec-card)', border: '1px solid var(--ec-border)', color: 'var(--ec-text-1)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {['Birthday party for 30 adults', 'Baby shower at home', 'Office team dinner', 'Cultural music evening'].map(ex => (
                <button key={ex} onClick={() => setDescription(ex)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99, border: '1px solid var(--ec-border)', background: 'none', cursor: 'pointer', color: 'var(--ec-text-3)', fontFamily: 'inherit' }}>
                  {ex}
                </button>
              ))}
            </div>
            <EcButton onClick={generatePlan} disabled={!description.trim()}>
              ✨ Generate Plan
            </EcButton>
          </div>
        )}

        {/* Step 2: Generating */}
        {step === 'generating' && (
          <div style={{ ...sectionStyle, textAlign: 'center', padding: '48px 24px' }}>
            <div className="ec-spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ fontSize: 14, color: 'var(--ec-text-2)', margin: 0 }}>Generating your event plan...</p>
            <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginTop: 6 }}>This takes about 10 seconds</p>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && plan && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--ec-text-3)', margin: 0 }}>Review and edit your plan before creating the event.</p>
              <EcButton size="sm" variant="ghost" onClick={() => setStep('describe')}>← Regenerate</EcButton>
            </div>

            {/* Editable core fields */}
            <div style={sectionStyle}>
              <span style={labelStyle}>Event Details</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <EcInput label="Title" value={title} onChange={e => setTitle(e.target.value)} />
                <EcInput label="Date & Time" type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} />
                <EcInput label="Location" value={location} onChange={e => setLocation(e.target.value)} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ec-text-2)' }}>Description</label>
                  <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--ec-radius-sm)', background: 'var(--ec-card)', border: '1px solid var(--ec-border)', color: 'var(--ec-text-1)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>

            {/* Schedule */}
            {schedule.length > 0 && (
              <div style={sectionStyle}>
                <span style={labelStyle}>Program / Schedule</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {schedule.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--ec-brand)', fontWeight: 600, minWidth: 50 }}>{item.time}</span>
                      <span style={{ fontSize: 13, color: 'var(--ec-text-1)', flex: 1 }}>{item.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checklist */}
            {plan.checklist?.length > 0 && (
              <div style={sectionStyle}>
                <span style={labelStyle}>Preparation Checklist</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {plan.checklist.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: 'var(--ec-brand-subtle)', color: 'var(--ec-brand)', border: '1px solid var(--ec-brand-border)', flexShrink: 0, marginTop: 2 }}>{item.category}</span>
                      <span style={{ fontSize: 13, color: 'var(--ec-text-1)' }}>{item.item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Budget */}
            {plan.budget?.length > 0 && (
              <div style={sectionStyle}>
                <span style={labelStyle}>Budget Estimate</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {plan.budget.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < plan.budget.length - 1 ? '1px solid var(--ec-border)' : 'none' }}>
                      <span style={{ fontSize: 13, color: 'var(--ec-text-2)' }}>{item.category}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ec-text-1)' }}>{item.estimate}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invitation draft */}
            {plan.invitationDraft && (
              <div style={sectionStyle}>
                <span style={labelStyle}>Invitation Draft</span>
                <p style={{ fontSize: 13, color: 'var(--ec-text-2)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>{plan.invitationDraft}</p>
              </div>
            )}

            {/* Create button */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <EcButton variant="ghost" onClick={() => setStep('describe')}>Start over</EcButton>
              <EcButton loading={creating} onClick={createEvent}>Create Event →</EcButton>
            </div>
          </div>
        )}

        {creating && (
          <div style={{ ...sectionStyle, textAlign: 'center', padding: '48px 24px' }}>
            <div className="ec-spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ fontSize: 14, color: 'var(--ec-text-2)', margin: 0 }}>Creating your event...</p>
          </div>
        )}

      </main>
    </div>
  );
}
