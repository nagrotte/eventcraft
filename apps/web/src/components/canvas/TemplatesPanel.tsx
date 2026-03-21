'use client';

import { useEffect, useState } from 'react';
import type { Canvas } from 'fabric';

interface TemplateLayer {
  image:   string;
  x:       number;
  y:       number;
  width:   number;
  height:  number;
  zIndex:  number;
  locked:  boolean;
}

interface TextZone {
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

interface Template {
  id:           string;
  name:         string;
  category:     string;
  description:  string;
  bgColor:      string;
  canvasWidth:  number;
  canvasHeight: number;
  layers:       TemplateLayer[];
  textZones:    TextZone[];
  thumbImage:   string;
}

interface TemplatesPanelProps {
  fabricRef:      React.MutableRefObject<Canvas | null>;
  eventTitle?:    string;
  eventDate?:     string;
  eventLocation?: string;
  onClose:        () => void;
  onSave?:        () => Promise<void>;
}

const TEMPLATES_URL    = 'https://eventcraft-media-staging.s3.amazonaws.com/templates/index.json';
const TEMPLATES_BASE   = 'https://eventcraft-media-staging.s3.amazonaws.com/templates';
const CATEGORIES       = ['All', 'South Indian Traditional', 'Hindu Religious', 'Ancient Bharath', 'Festival'];

export function TemplatesPanel({ fabricRef, eventTitle, eventDate, eventLocation, onClose, onSave }: TemplatesPanelProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [applying,  setApplying]  = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState('All');
  const [error,     setError]     = useState('');

  useEffect(() => {
    fetch(TEMPLATES_URL + '?t=' + Date.now())
      .then(r => r.json())
      .then(d => setTemplates(d.templates ?? []))
      .catch(() => setError('Could not load templates — check S3 bucket is public'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeCat === 'All'
    ? templates
    : templates.filter(t => t.category === activeCat);

  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
    : '';

  async function applyTemplate(t: Template) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setApplying(t.id);

    try {
      const { FabricImage, IText, Rect } = await import('fabric');

      // Resize canvas if template has different dimensions
      if (t.canvasWidth !== (canvas as any).width || t.canvasHeight !== (canvas as any).height) {
        (canvas as any).setDimensions({ width: t.canvasWidth, height: t.canvasHeight });
      }

      canvas.clear();
      canvas.backgroundColor = t.bgColor;

      // Sort layers by zIndex
      const sortedLayers = [...t.layers].sort((a, b) => a.zIndex - b.zIndex);

      // Place each layer image
      for (const layer of sortedLayers) {
        const imageUrl = `${TEMPLATES_BASE}/${t.id}/${layer.image}`;
        try {
          const img = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });
          const scaleX = layer.width  / img.width!;
          const scaleY = layer.height / img.height!;
          img.set({
            left:       layer.x,
            top:        layer.y,
            scaleX,
            scaleY,
            selectable: !layer.locked,
            evented:    !layer.locked,
            lockMovementX: layer.locked,
            lockMovementY: layer.locked,
          });
          canvas.add(img);
        } catch {
          console.warn(`Layer image failed: ${layer.image}`);
        }
      }

      // For each text zone — add guide + placeholders
      for (const zone of t.textZones) {
        const isDark = ['#0','#1','#2'].some(p => t.bgColor.startsWith(p));
        const textColor   = isDark ? '#FFFFFF' : '#1a1a1a';
        const accentColor = '#C8A951';
        const midX        = zone.x + zone.width / 2;

        // Dashed guide rectangle
        const guide = new Rect({
          left:            zone.x,
          top:             zone.y,
          width:           zone.width,
          height:          zone.height,
          fill:            'transparent',
          stroke:          accentColor,
          strokeWidth:     1,
          strokeDashArray: [6, 4],
          opacity:         0.35,
          selectable:      false,
          evented:         false,
        });
        canvas.add(guide);

        // Placeholder texts
        const placeholders = [
          {
            text:       eventTitle    || 'Double-click to add title',
            top:        zone.y + 40,
            fontSize:   eventTitle    ? 36 : 24,
            fill:       eventTitle    ? textColor : accentColor,
            opacity:    eventTitle    ? 1    : 0.4,
            fontWeight: 'bold',
            fontFamily: 'Noto Serif Devanagari, Georgia, serif',
          },
          {
            text:       formattedDate || 'Double-click to add date',
            top:        zone.y + zone.height / 2 - 30,
            fontSize:   16,
            fill:       textColor,
            opacity:    formattedDate ? 0.9 : 0.35,
            fontWeight: 'normal',
            fontFamily: 'Georgia, serif',
          },
          {
            text:       eventLocation || 'Double-click to add location',
            top:        zone.y + zone.height / 2 + 10,
            fontSize:   14,
            fill:       accentColor,
            opacity:    eventLocation ? 0.9 : 0.35,
            fontWeight: 'normal',
            fontFamily: 'Georgia, serif',
          },
          {
            text:       'Double-click to add your message',
            top:        zone.y + zone.height - 60,
            fontSize:   13,
            fill:       textColor,
            opacity:    0.25,
            fontWeight: 'normal',
            fontFamily: 'Georgia, serif',
          },
        ];

        for (const p of placeholders) {
          canvas.add(new IText(p.text, {
            left:       midX,
            top:        p.top,
            fontSize:   p.fontSize,
            fill:       p.fill,
            opacity:    p.opacity,
            fontWeight: p.fontWeight,
            fontFamily: p.fontFamily,
            textAlign:  'center',
            originX:    'center',
          }));
        }

        // Thin accent dividers
        canvas.add(new Rect({ left: zone.x+60, top: zone.y+8,         width: zone.width-120, height:1, fill:accentColor, opacity:0.4, selectable:false, evented:false }));
        canvas.add(new Rect({ left: zone.x+60, top: zone.y+zone.height-8, width: zone.width-120, height:1, fill:accentColor, opacity:0.4, selectable:false, evented:false }));
      }

      canvas.renderAll();
      await onSave?.();
      onClose();
    } finally {
      setApplying(null);
    }
  }

  const catBtn = (cat: string): React.CSSProperties => ({
    padding:'4px 10px', borderRadius:12, fontSize:10, cursor:'pointer',
    border:`1px solid ${activeCat===cat ? 'var(--ec-brand)' : 'var(--ec-border)'}`,
    background: activeCat===cat ? 'var(--ec-brand-subtle)' : 'transparent',
    color: activeCat===cat ? 'var(--ec-brand)' : 'var(--ec-text-3)',
    fontFamily:'inherit', whiteSpace:'nowrap' as const, transition:'all 0.12s',
  });

  return (
    <div style={{ position:'absolute', left:48, top:0, bottom:0, width:300, background:'var(--ec-surface)', borderRight:'1px solid var(--ec-border)', display:'flex', flexDirection:'column', zIndex:10, boxShadow:'4px 0 16px rgba(0,0,0,0.3)' }}>

      {/* Header */}
      <div style={{ padding:'12px 14px 8px', borderBottom:'1px solid var(--ec-border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <p style={{ fontSize:11, fontWeight:600, color:'var(--ec-text-2)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Templates</p>
          <p style={{ fontSize:10, color:'var(--ec-text-3)', marginTop:2 }}>Indian · Hindu · Sanatan · Ancient Bharath</p>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ec-text-3)', fontSize:18 }}>×</button>
      </div>

      {/* Category pills */}
      <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--ec-border)', display:'flex', gap:5, overflowX:'auto', flexShrink:0 }}>
        {CATEGORIES.map(cat => (
          <button key={cat} style={catBtn(cat)} onClick={() => setActiveCat(cat)}>{cat}</button>
        ))}
      </div>

      <p style={{ fontSize:11, color:'var(--ec-text-3)', padding:'8px 14px 2px', flexShrink:0 }}>
        Click to apply · Your event details auto-fill
      </p>

      {/* Template grid */}
      <div style={{ flex:1, overflowY:'auto', padding:'6px 8px 8px' }}>
        {loading && <div style={{ display:'flex', justifyContent:'center', padding:32 }}><div className="ec-spinner" /></div>}
        {error   && <p style={{ fontSize:11, color:'var(--ec-danger)', padding:'12px 8px' }}>{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p style={{ fontSize:12, color:'var(--ec-text-3)', padding:'20px 8px', textAlign:'center' }}>No templates in this category yet</p>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {filtered.map(t => (
            <div key={t.id} onClick={() => applyTemplate(t)} style={{
              borderRadius:'var(--ec-radius-md)', border:'1px solid var(--ec-border)',
              overflow:'hidden', cursor:applying===t.id?'wait':'pointer',
              opacity:applying===t.id?0.6:1, background:'var(--ec-surface-raised)',
              transition:'all 0.15s',
            }}>
              {/* Thumbnail */}
              <div style={{ aspectRatio:'3/4', background:t.bgColor, position:'relative', overflow:'hidden' }}>
                <img
                  src={`${TEMPLATES_BASE}/${t.id}/${t.thumbImage}?t=${Date.now()}`}
                  alt={t.name}
                  style={{ width:'100%', height:'100%', objectFit:'cover' }}
                  onError={e => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) {
                      parent.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px"><span style="font-size:18px">🖼</span><span style="font-size:9px;color:#999;text-align:center;padding:0 8px">${t.name}</span></div>`;
                    }
                  }}
                />
                {applying===t.id && (
                  <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <div className="ec-spinner" style={{ width:20, height:20 }} />
                  </div>
                )}
                {/* Layer count badge */}
                <div style={{ position:'absolute', top:4, right:4, background:'rgba(0,0,0,0.6)', borderRadius:8, padding:'2px 6px', fontSize:9, color:'#fff' }}>
                  {t.layers.length}L
                </div>
              </div>
              {/* Info */}
              <div style={{ padding:'6px 8px' }}>
                <p style={{ fontSize:11, fontWeight:600, color:'var(--ec-text-1)', marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</p>
                <p style={{ fontSize:9, color:'var(--ec-text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:'8px 14px', borderTop:'1px solid var(--ec-border)', flexShrink:0 }}>
        <p style={{ fontSize:9, color:'var(--ec-text-3)', textAlign:'center' }}>
          Add templates by uploading images to S3 and updating index.json
        </p>
      </div>
    </div>
  );
}
