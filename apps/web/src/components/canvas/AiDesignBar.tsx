'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import type { Canvas } from 'fabric';
import { EcButton } from '@/components/ui/EcButton';

interface AiDesignBarProps {
  fabricRef:      React.MutableRefObject<Canvas | null>;
  eventTitle?:    string;
  eventDate?:     string;
  eventLocation?: string;
  onSave?:        () => Promise<void>;
  hasDesign:      boolean;
}

export interface AiDesignBarRef {
  triggerGenerate: (prompt: string) => void;
}

const STYLE_PRESETS = [
  { label: '🏛 Royal Indian',   prompt: 'ancient Indian palace, saffron gold, divine atmosphere, Georgia serif' },
  { label: '🌸 Floral Elegant', prompt: 'luxury floral dark background, blush rose gold, romantic elegant' },
  { label: '🌙 Dark Luxury',    prompt: 'deep navy dark luxury, gold accents, modern sophisticated' },
  { label: '🎊 Festive',        prompt: 'vibrant festive celebration, rich jewel tones, joyful' },
  { label: '🕊 Minimal',        prompt: 'clean white minimal, light grey, modern sans-serif, simple elegant' },
  { label: '✨ Custom',         prompt: '' },
];

export const AiDesignBar = forwardRef<AiDesignBarRef, AiDesignBarProps>(
  ({ fabricRef, eventTitle, eventDate, eventLocation, onSave, hasDesign }, ref) => {

  const [prompt,       setPrompt]       = useState('');
  const [loading,      setLoading]      = useState(false);
  const [status,       setStatus]       = useState('');
  const [error,        setError]        = useState('');
  const [photoSource,  setPhotoSource]  = useState('');
  const [collapsed,    setCollapsed]    = useState(hasDesign);
  const [activePreset, setActivePreset] = useState<number | null>(null);

  useImperativeHandle(ref, () => ({
    triggerGenerate: (p: string) => {
      setPrompt(p);
      setCollapsed(false);
      smartGenerate(p);
    }
  }));

  async function smartGenerate(overridePrompt?: string) {
    const finalPrompt = overridePrompt ?? prompt;
    if (!finalPrompt.trim() || !fabricRef.current) return;
    setLoading(true);
    setError('');
    setPhotoSource('');
    setStatus('Generating your invitation...');

    try {
      const res = await fetch('/api/smart-generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt: finalPrompt, eventTitle, eventDate, eventLocation })
      });

      if (!res.ok) throw new Error('Generation failed');
      const { layout, photoUrl, photoSource } = await res.json();

      setPhotoSource(photoSource);
      setStatus(photoSource === 'dalle' ? 'Applying AI image...' : 'Applying design...');
      await applyLayout(layout, photoUrl);

      setStatus('Saving...');
      await onSave?.();

      setStatus(photoSource === 'dalle' ? '✨ AI image — done!' : '📷 Stock photo — done!');
      setCollapsed(true);
      setTimeout(() => setStatus(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStatus('');
    } finally {
      setLoading(false);
    }
  }

  async function applyLayout(layout: any, photoUrl: string | null) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const { Rect, Circle, IText, FabricImage } = await import('fabric');
    canvas.clear();
    canvas.backgroundColor = layout.background ?? '#1a1a3e';

    if (photoUrl) {
      try {
        const img = await FabricImage.fromURL(photoUrl, { crossOrigin: 'anonymous' });
        const scale = Math.max(canvas.width! / img.width!, canvas.height! / img.height!);
        img.set({ left: 0, top: 0, scaleX: scale, scaleY: scale, selectable: true, evented: true });
        canvas.add(img);
      } catch { console.warn('Could not load background image'); }
    }

    for (const obj of layout.objects ?? []) {
      let fabricObj: any = null;
      if (obj.type === 'rect') {
        fabricObj = new Rect({
          left: obj.left ?? 0, top: obj.top ?? 0,
          width: obj.width ?? 100, height: obj.height ?? 100,
          fill: obj.fill ?? '#000000', rx: obj.rx ?? 0, ry: obj.rx ?? 0,
          opacity: obj.opacity ?? 1,
        });
      } else if (obj.type === 'circle') {
        fabricObj = new Circle({
          left: obj.left ?? 0, top: obj.top ?? 0,
          radius: obj.radius ?? 40, fill: obj.fill ?? '#000000', opacity: obj.opacity ?? 1,
        });
      } else if (obj.type === 'text' || obj.type === 'itext') {
        fabricObj = new IText(obj.text ?? '', {
          left: obj.left ?? 0, top: obj.top ?? 0,
          fontSize: obj.fontSize ?? 20, fill: obj.fill ?? '#ffffff',
          fontFamily: obj.fontFamily ?? 'Georgia, serif',
          fontWeight: obj.fontWeight ?? 'normal',
          textAlign: obj.textAlign ?? 'left',
          opacity: obj.opacity ?? 1,
          originX: obj.textAlign === 'center' ? 'center' : 'left',
        });
      }
      if (fabricObj) canvas.add(fabricObj);
    }
    canvas.renderAll();
  }

  if (collapsed) {
    return (
      <div style={{
        padding: '8px 16px', borderTop: '1px solid var(--ec-border)',
        background: 'var(--ec-surface)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'var(--ec-brand-subtle)', border: '1px solid var(--ec-brand-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5l1.2 3.3L11.5 6 8.2 7.2 7 10.5 5.8 7.2 2.5 6l3.3-1.2L7 1.5z" fill="var(--ec-brand)"/>
          </svg>
        </div>
        <span style={{ fontSize: 12, color: 'var(--ec-text-2)', flex: 1 }}>
          {status || 'AI Design Generator'}
        </span>
        <EcButton size="sm" variant="secondary" onClick={() => setCollapsed(false)}>
          ✨ Regenerate
        </EcButton>
      </div>
    );
  }

  return (
    <div style={{
      borderTop: '2px solid var(--ec-brand-border)',
      background: 'var(--ec-surface)', flexShrink: 0, padding: '20px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--ec-brand) 0%, #4F46E5 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
          }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5l1.2 3.3L11.5 6 8.2 7.2 7 10.5 5.8 7.2 2.5 6l3.3-1.2L7 1.5z" fill="white"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ec-text-1)' }}>AI Design Generator</p>
            <p style={{ fontSize: 11, color: 'var(--ec-text-3)' }}>
              Describe your vision · AI creates the full invitation with background image
            </p>
          </div>
        </div>
        {hasDesign && (
          <button onClick={() => setCollapsed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ec-text-3)', fontSize: 18 }}>
            ×
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {STYLE_PRESETS.map((preset, i) => (
          <button key={i}
            onClick={() => { setActivePreset(i); if (preset.prompt) setPrompt(preset.prompt); }}
            style={{
              padding: '5px 12px', borderRadius: 20,
              border: `1px solid ${activePreset === i ? 'var(--ec-brand)' : 'var(--ec-border)'}`,
              background: activePreset === i ? 'var(--ec-brand-subtle)' : 'var(--ec-surface-raised)',
              color: activePreset === i ? 'var(--ec-brand)' : 'var(--ec-text-2)',
              fontSize: 12, cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit',
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); smartGenerate(); } }}
          placeholder={`Describe your invitation style...\ne.g. "ancient Indian palace at golden sunset, Sarayu river, saffron and gold, divine atmosphere"`}
          rows={2}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 'var(--ec-radius-md)',
            background: 'var(--ec-surface-raised)', border: '1px solid var(--ec-border)',
            color: 'var(--ec-text-1)', fontSize: 13, fontFamily: 'inherit',
            outline: 'none', resize: 'none', lineHeight: 1.5,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <EcButton loading={loading} onClick={() => smartGenerate()} disabled={!prompt.trim()}>
            ✨ Generate
          </EcButton>
          {hasDesign && (
            <EcButton variant="ghost" size="sm" onClick={() => smartGenerate()} disabled={!prompt.trim() || loading}>
              🔄 Regenerate
            </EcButton>
          )}
        </div>
      </div>

      {(status || error) && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && <div className="ec-spinner" style={{ width: 14, height: 14 }} />}
          {status && <span style={{ fontSize: 12, color: photoSource === 'dalle' ? 'var(--ec-brand)' : 'var(--ec-text-2)' }}>{status}</span>}
          {error  && <span style={{ fontSize: 12, color: 'var(--ec-danger)' }}>{error}</span>}
        </div>
      )}
      <p style={{ fontSize: 10, color: 'var(--ec-text-3)', marginTop: 10 }}>
        Event details (title, date, location) are automatically included · Enter to generate
      </p>
    </div>
  );
});

AiDesignBar.displayName = 'AiDesignBar';
