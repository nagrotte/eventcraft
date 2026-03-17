'use client';

import { useState } from 'react';
import type { Canvas } from 'fabric';
import { EcButton } from '@/components/ui/EcButton';

interface AiDesignBarProps {
  fabricRef: React.MutableRefObject<Canvas | null>;
  eventTitle?: string;
}

interface AiObject {
  type:        string;
  left?:       number;
  top?:        number;
  width?:      number;
  height?:     number;
  radius?:     number;
  fill?:       string;
  text?:       string;
  fontSize?:   number;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?:  string;
  rx?:         number;
  ry?:         number;
  opacity?:    number;
}

interface AiLayout {
  background: string;
  objects:    AiObject[];
}

export function AiDesignBar({ fabricRef, eventTitle }: AiDesignBarProps) {
  const [prompt,    setPrompt]    = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  async function generate() {
    if (!prompt.trim() || !fabricRef.current) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/ai-design', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt, eventTitle })
      });

      if (!response.ok) throw new Error('Generation failed');
      const { layout } = await response.json() as { layout: AiLayout };
      await applyLayout(layout);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  async function applyLayout(layout: AiLayout) {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const { Rect, Circle, IText, FabricText } = await import('fabric');

    // Clear canvas
    canvas.clear();
    canvas.backgroundColor = layout.background ?? '#ffffff';

    for (const obj of layout.objects) {
      let fabricObj = null;

      if (obj.type === 'rect') {
        fabricObj = new Rect({
          left:    obj.left   ?? 0,
          top:     obj.top    ?? 0,
          width:   obj.width  ?? 100,
          height:  obj.height ?? 100,
          fill:    obj.fill   ?? '#000000',
          rx:      obj.rx     ?? 0,
          ry:      obj.ry     ?? 0,
          opacity: obj.opacity ?? 1,
          selectable: obj.type !== 'rect' || (obj.left ?? 0) !== 0,
        });
      } else if (obj.type === 'circle') {
        fabricObj = new Circle({
          left:    obj.left   ?? 0,
          top:     obj.top    ?? 0,
          radius:  obj.radius ?? 40,
          fill:    obj.fill   ?? '#000000',
          opacity: obj.opacity ?? 1,
        });
      } else if (obj.type === 'text' || obj.type === 'itext') {
        fabricObj = new IText(obj.text ?? '', {
          left:       obj.left       ?? 0,
          top:        obj.top        ?? 0,
          fontSize:   obj.fontSize   ?? 20,
          fill:       obj.fill       ?? '#000000',
          fontFamily: obj.fontFamily ?? 'Inter, sans-serif',
          fontWeight: obj.fontWeight ?? 'normal',
          textAlign:  (obj.textAlign as any) ?? 'left',
          opacity:    obj.opacity    ?? 1,
          originX:    obj.textAlign === 'center' ? 'center' : 'left',
        });
      }

      if (fabricObj) canvas.add(fabricObj);
    }

    canvas.renderAll();
  }

  return (
    <div style={{
      padding: '10px 16px',
      borderTop: '1px solid var(--ec-border)',
      background: 'var(--ec-surface)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0,
    }}>
      {/* AI icon */}
      <div style={{
        width: 28, height: 28,
        borderRadius: '50%',
        background: 'var(--ec-brand-subtle)',
        border: '1px solid var(--ec-brand-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1.5l1.2 3.3L11.5 6 8.2 7.2 7 10.5 5.8 7.2 2.5 6l3.3-1.2L7 1.5z"
            fill="var(--ec-brand)" />
        </svg>
      </div>

      <input
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && generate()}
        placeholder='Describe your design... e.g. "elegant birthday invite, gold and navy, serif fonts"'
        style={{
          flex: 1,
          height: 34,
          padding: '0 14px',
          borderRadius: 20,
          background: 'var(--ec-surface-raised)',
          border: '1px solid var(--ec-brand-border)',
          color: 'var(--ec-text-1)',
          fontSize: 12,
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />

      {error && (
        <span style={{ fontSize: 11, color: 'var(--ec-danger)', flexShrink: 0 }}>{error}</span>
      )}

      <EcButton
        size="sm"
        loading={loading}
        onClick={generate}
        disabled={!prompt.trim()}
      >
        Generate
      </EcButton>
    </div>
  );
}
