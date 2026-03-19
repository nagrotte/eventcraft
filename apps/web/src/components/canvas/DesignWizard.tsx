'use client';

import { useState } from 'react';
import { EcButton } from '@/components/ui/EcButton';

interface WizardProps {
  eventTitle?:    string;
  eventDate?:     string;
  eventLocation?: string;
  onComplete:     (prompt: string) => void;
  onSkip:         () => void;
}

interface Choice {
  emoji: string;
  label: string;
  value: string;
}

const STEPS = [
  {
    id:       'type',
    question: 'What kind of event is this?',
    choices:  [
      { emoji: '🛕', label: 'Cultural / Spiritual', value: 'cultural spiritual religious ceremony' },
      { emoji: '🎂', label: 'Birthday / Celebration', value: 'birthday celebration festive joyful' },
      { emoji: '💍', label: 'Wedding / Anniversary', value: 'wedding anniversary romantic elegant' },
      { emoji: '🎓', label: 'Lecture / Conference', value: 'professional conference lecture formal' },
      { emoji: '🎉', label: 'Party / Social',        value: 'party social gathering fun vibrant' },
      { emoji: '🍽',  label: 'Dinner / Gala',         value: 'dinner gala formal luxury evening' },
    ] as Choice[],
  },
  {
    id:       'mood',
    question: 'What mood should the invitation feel?',
    choices:  [
      { emoji: '✨', label: 'Divine & Sacred',    value: 'divine sacred spiritual golden saffron' },
      { emoji: '👑', label: 'Royal & Grand',      value: 'royal grand majestic opulent gold' },
      { emoji: '🌸', label: 'Soft & Romantic',    value: 'soft romantic floral blush rose gold' },
      { emoji: '🌙', label: 'Dark & Luxurious',   value: 'dark luxury deep navy sophisticated' },
      { emoji: '☀️', label: 'Bright & Festive',   value: 'bright festive vibrant colorful joyful' },
      { emoji: '🕊',  label: 'Clean & Minimal',   value: 'clean minimal white modern simple' },
    ] as Choice[],
  },
  {
    id:       'style',
    question: 'Pick a visual style',
    choices:  [
      { emoji: '🏛', label: 'Classical Indian',  value: 'ancient Indian palace temple architecture saffron gold Georgia serif' },
      { emoji: '🌺', label: 'Floral & Nature',   value: 'luxury floral botanical dark background elegant' },
      { emoji: '🎨', label: 'Modern Design',     value: 'modern contemporary clean geometric sans-serif' },
      { emoji: '🖼', label: 'Vintage Classic',   value: 'vintage classic ornate decorative serif typography' },
      { emoji: '🌅', label: 'Scenic Landscape',  value: 'scenic landscape golden hour sunset dramatic sky' },
      { emoji: '💫', label: 'Abstract Artistic', value: 'abstract artistic textured painterly expressive' },
    ] as Choice[],
  },
];

export function DesignWizard({ eventTitle, eventDate, eventLocation, onComplete, onSkip }: WizardProps) {
  const [step,    setStep]    = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [picked,  setPicked]  = useState<number | null>(null);

  const currentStep = STEPS[step];
  const isLast      = step === STEPS.length - 1;

  function selectChoice(i: number) {
    setPicked(i);
  }

  function next() {
    const newAnswers = [...answers];
    if (picked !== null) {
      newAnswers[step] = currentStep.choices[picked].value;
    }
    setAnswers(newAnswers);

    if (isLast) {
      const prompt = newAnswers.filter(Boolean).join(', ');
      onComplete(prompt);
    } else {
      setStep(s => s + 1);
      setPicked(null);
    }
  }

  function skipStep() {
    if (isLast) {
      const prompt = answers.filter(Boolean).join(', ');
      onComplete(prompt || 'elegant sophisticated invitation');
    } else {
      setStep(s => s + 1);
      setPicked(null);
    }
  }

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      background:     'rgba(0,0,0,0.75)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      zIndex:         3000,
      padding:        24,
    }}>
      <div style={{
        background:   'var(--ec-surface)',
        border:       '1px solid var(--ec-border)',
        borderRadius: 'var(--ec-radius-xl)',
        width:        '100%',
        maxWidth:     520,
        boxShadow:    'var(--ec-shadow-lg)',
        overflow:     'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding:         '20px 24px 0',
          borderBottom:    'none',
        }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                height:       3,
                flex:         1,
                borderRadius: 2,
                background:   i <= step ? 'var(--ec-brand)' : 'var(--ec-border)',
                transition:   'background 0.3s ease',
              }} />
            ))}
          </div>

          {/* Event context */}
          {eventTitle && (
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          8,
              marginBottom: 16,
              padding:      '8px 12px',
              background:   'var(--ec-surface-raised)',
              borderRadius: 'var(--ec-radius-md)',
              border:       '1px solid var(--ec-border)',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="3" width="12" height="10" rx="2" stroke="var(--ec-brand)" strokeWidth="1.2"/>
                <path d="M4 1v3M10 1v3M1 6h12" stroke="var(--ec-brand)" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 12, color: 'var(--ec-text-2)' }}>
                <strong style={{ color: 'var(--ec-text-1)' }}>{eventTitle}</strong>
                {eventDate && ` · ${new Date(eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                {eventLocation && ` · ${eventLocation}`}
              </span>
            </div>
          )}

          <h2 style={{
            fontSize:     20,
            fontWeight:   600,
            color:        'var(--ec-text-1)',
            marginBottom: 4,
            letterSpacing: '-0.02em',
          }}>
            {currentStep.question}
          </h2>
          <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginBottom: 20 }}>
            Step {step + 1} of {STEPS.length} · Choose one or skip
          </p>
        </div>

        {/* Choices grid */}
        <div style={{
          padding:             '0 24px',
          display:             'grid',
          gridTemplateColumns: '1fr 1fr',
          gap:                 10,
          marginBottom:        20,
        }}>
          {currentStep.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => selectChoice(i)}
              style={{
                padding:      '14px 16px',
                borderRadius: 'var(--ec-radius-lg)',
                border:       `1.5px solid ${picked === i ? 'var(--ec-brand)' : 'var(--ec-border)'}`,
                background:   picked === i ? 'var(--ec-brand-subtle)' : 'var(--ec-surface-raised)',
                cursor:       'pointer',
                textAlign:    'left',
                transition:   'all 0.12s ease',
                display:      'flex',
                alignItems:   'center',
                gap:          10,
                fontFamily:   'inherit',
              }}
            >
              <span style={{ fontSize: 22 }}>{choice.emoji}</span>
              <span style={{
                fontSize:   13,
                fontWeight: picked === i ? 600 : 400,
                color:      picked === i ? 'var(--ec-brand)' : 'var(--ec-text-1)',
              }}>
                {choice.label}
              </span>
              {picked === i && (
                <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" fill="var(--ec-brand)"/>
                    <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{
          padding:        '16px 24px 20px',
          borderTop:      '1px solid var(--ec-border)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            10,
        }}>
          <button
            onClick={onSkip}
            style={{
              background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 12,
              color: 'var(--ec-text-3)', fontFamily: 'inherit',
              padding: '4px 0',
            }}
          >
            Skip all → go to canvas
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <EcButton variant="ghost" size="sm" onClick={skipStep}>
              Skip this step
            </EcButton>
            <EcButton
              onClick={next}
              disabled={picked === null}
            >
              {isLast ? '✨ Generate Design' : 'Next →'}
            </EcButton>
          </div>
        </div>
      </div>
    </div>
  );
}
