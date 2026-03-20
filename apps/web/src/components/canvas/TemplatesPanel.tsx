'use client';

import { useState } from 'react';
import type { Canvas } from 'fabric';

interface TemplatesPanelProps {
  fabricRef:  React.MutableRefObject<Canvas | null>;
  eventTitle?: string;
  eventDate?:  string;
  eventLocation?: string;
  onClose:    () => void;
  onSave?:    () => Promise<void>;
}

const TEMPLATES = [
  {
    id: 'royal-gold',
    name: 'Royal Gold',
    preview: { bg: '#1a0a00', accent: '#D4AF37' },
    description: 'Dark royal with gold accents',
    layout: (title: string, date: string, loc: string) => ({
      background: '#1a0a00',
      objects: [
        { type:'rect', left:0, top:0, width:600, height:850, fill:'#1a0a00', opacity:1 },
        { type:'rect', left:0, top:0, width:600, height:6, fill:'#D4AF37' },
        { type:'rect', left:0, top:844, width:600, height:6, fill:'#D4AF37' },
        { type:'rect', left:40, top:30, width:520, height:1, fill:'#D4AF37', opacity:0.4 },
        { type:'rect', left:40, top:819, width:520, height:1, fill:'#D4AF37', opacity:0.4 },
        { type:'text', left:300, top:70, text:'✦  YOU ARE INVITED  ✦', fontSize:11, fill:'#D4AF37', textAlign:'center', fontFamily:'Georgia, serif' },
        { type:'text', left:300, top:130, text: title || 'Event Title', fontSize:48, fill:'#FFFFFF', textAlign:'center', fontFamily:'Georgia, serif', fontWeight:'bold' },
        { type:'rect', left:220, top:210, width:160, height:2, fill:'#D4AF37' },
        { type:'text', left:300, top:240, text:'Sacred Celebration', fontSize:18, fill:'#D4AF37', textAlign:'center', fontFamily:'Georgia, serif' },
        { type:'text', left:300, top:660, text: date || 'Date & Time', fontSize:16, fill:'#FFFFFF', textAlign:'center', fontFamily:'Georgia, serif' },
        { type:'text', left:300, top:688, text: loc || 'Location', fontSize:14, fill:'#D4AF37', textAlign:'center', fontFamily:'Georgia, serif' },
        { type:'rect', left:200, top:730, width:200, height:44, fill:'#D4AF37', rx:4 },
        { type:'text', left:300, top:752, text:'RSVP NOW', fontSize:13, fill:'#1a0a00', textAlign:'center', fontFamily:'Georgia, serif', fontWeight:'bold' },
      ]
    }),
  },
  {
    id: 'saffron-divine',
    name: 'Saffron Divine',
    preview: { bg: '#7B2D00', accent: '#FF8C00' },
    description: 'Saffron and deep maroon — spiritual',
    layout: (title: string, date: string, loc: string) => ({
      background: '#4A0000',
      objects: [
        { type:'rect', left:0, top:0, width:600, height:850, fill:'#4A0000' },
        { type:'rect', left:0, top:0, width:600, height:8, fill:'#FF8C00' },
        { type:'rect', left:0, top:842, width:600, height:8, fill:'#FF8C00' },
        { type:'rect', left:60, top:60, width:480, height:730, fill:'#000000', opacity:0.2, rx:4 },
        { type:'text', left:300, top:90, text:'ॐ', fontSize:32, fill:'#FF8C00', textAlign:'center', fontFamily:'Noto Serif Devanagari, serif' },
        { type:'text', left:300, top:150, text: title || 'Event Title', fontSize:44, fill:'#FFF3E0', textAlign:'center', fontFamily:'Noto Serif Devanagari, serif', fontWeight:'bold' },
        { type:'rect', left:180, top:225, width:240, height:2, fill:'#FF8C00', opacity:0.8 },
        { type:'text', left:300, top:250, text:'पवित्र उत्सव', fontSize:20, fill:'#FF8C00', textAlign:'center', fontFamily:'Noto Serif Devanagari, serif' },
        { type:'text', left:300, top:660, text: date || 'दिनांक', fontSize:16, fill:'#FFF3E0', textAlign:'center', fontFamily:'Noto Serif Devanagari, serif' },
        { type:'text', left:300, top:690, text: loc || 'स्थान', fontSize:14, fill:'#FF8C00', textAlign:'center', fontFamily:'Noto Serif Devanagari, serif' },
        { type:'rect', left:200, top:730, width:200, height:44, fill:'#FF8C00', rx:4 },
        { type:'text', left:300, top:752, text:'RSVP करें', fontSize:13, fill:'#4A0000', textAlign:'center', fontFamily:'Noto Serif Devanagari, serif', fontWeight:'bold' },
      ]
    }),
  },
  {
    id: 'floral-blush',
    name: 'Floral Blush',
    preview: { bg: '#2d1a1a', accent: '#E8A0A0' },
    description: 'Romantic blush and rose gold',
    layout: (title: string, date: string, loc: string) => ({
      background: '#1a0d0d',
      objects: [
        { type:'rect', left:0, top:0, width:600, height:850, fill:'#1a0d0d' },
        { type:'rect', left:0, top:0, width:600, height:5, fill:'#C4707A' },
        { type:'rect', left:0, top:845, width:600, height:5, fill:'#C4707A' },
        { type:'text', left:300, top:65, text:'~ You Are Invited ~', fontSize:13, fill:'#C4707A', textAlign:'center', fontFamily:'Georgia, serif', fontStyle:'italic' },
        { type:'text', left:300, top:130, text: title || 'Event Title', fontSize:46, fill:'#FFF0F0', textAlign:'center', fontFamily:'Playfair Display, serif', fontWeight:'bold' },
        { type:'rect', left:240, top:210, width:120, height:1, fill:'#C4707A', opacity:0.8 },
        { type:'text', left:300, top:230, text:'With Love & Joy', fontSize:16, fill:'#C4707A', textAlign:'center', fontFamily:'Georgia, serif', fontStyle:'italic' },
        { type:'text', left:300, top:660, text: date || 'Date & Time', fontSize:16, fill:'#FFF0F0', textAlign:'center', fontFamily:'Georgia, serif' },
        { type:'text', left:300, top:688, text: loc || 'Location', fontSize:14, fill:'#C4707A', textAlign:'center', fontFamily:'Georgia, serif' },
        { type:'rect', left:200, top:730, width:200, height:44, fill:'#C4707A', rx:22 },
        { type:'text', left:300, top:752, text:'RSVP', fontSize:13, fill:'#fff', textAlign:'center', fontFamily:'Georgia, serif', fontWeight:'bold' },
      ]
    }),
  },
  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    preview: { bg: '#0a0a2e', accent: '#4F8EF7' },
    description: 'Deep navy — modern corporate',
    layout: (title: string, date: string, loc: string) => ({
      background: '#050518',
      objects: [
        { type:'rect', left:0, top:0, width:600, height:850, fill:'#050518' },
        { type:'rect', left:0, top:0, width:4, height:850, fill:'#4F8EF7' },
        { type:'rect', left:596, top:0, width:4, height:850, fill:'#4F8EF7' },
        { type:'rect', left:40, top:80, width:120, height:3, fill:'#4F8EF7' },
        { type:'text', left:60, top:110, text:'INVITATION', fontSize:11, fill:'#4F8EF7', fontFamily:'Inter, sans-serif', fontWeight:'bold' },
        { type:'text', left:60, top:170, text: title || 'Event Title', fontSize:44, fill:'#FFFFFF', fontFamily:'Inter, sans-serif', fontWeight:'bold' },
        { type:'rect', left:40, top:250, width:520, height:1, fill:'#4F8EF7', opacity:0.3 },
        { type:'text', left:60, top:660, text: date || 'Date & Time', fontSize:16, fill:'#FFFFFF', fontFamily:'Inter, sans-serif' },
        { type:'text', left:60, top:686, text: loc || 'Location', fontSize:14, fill:'#4F8EF7', fontFamily:'Inter, sans-serif' },
        { type:'rect', left:40, top:730, width:180, height:44, fill:'#4F8EF7', rx:4 },
        { type:'text', left:130, top:752, text:'RSVP', fontSize:13, fill:'#fff', textAlign:'center', fontFamily:'Inter, sans-serif', fontWeight:'bold' },
      ]
    }),
  },
  {
    id: 'ivory-classic',
    name: 'Ivory Classic',
    preview: { bg: '#F5F0E8', accent: '#8B6914' },
    description: 'Light ivory — elegant print-ready',
    layout: (title: string, date: string, loc: string) => ({
      background: '#F5F0E8',
      objects: [
        { type:'rect', left:0, top:0, width:600, height:850, fill:'#F5F0E8' },
        { type:'rect', left:30, top:30, width:540, height:790, fill:'#000000', opacity:0, rx:0 },
        { type:'rect', left:30, top:30, width:540, height:2, fill:'#8B6914' },
        { type:'rect', left:30, top:818, width:540, height:2, fill:'#8B6914' },
        { type:'rect', left:30, top:30, width:2, height:790, fill:'#8B6914' },
        { type:'rect', left:568, top:30, width:2, height:790, fill:'#8B6914' },
        { type:'text', left:300, top:75, text:'~ Invitation ~', fontSize:14, fill:'#8B6914', textAlign:'center', fontFamily:'Georgia, serif', fontStyle:'italic' },
        { type:'text', left:300, top:140, text: title || 'Event Title', fontSize:44, fill:'#1a1a1a', textAlign:'center', fontFamily:'Playfair Display, serif', fontWeight:'bold' },
        { type:'rect', left:220, top:220, width:160, height:1, fill:'#8B6914' },
        { type:'text', left:300, top:240, text:'cordially invites you', fontSize:16, fill:'#555555', textAlign:'center', fontFamily:'Georgia, serif', fontStyle:'italic' },
        { type:'text', left:300, top:660, text: date || 'Date & Time', fontSize:16, fill:'#1a1a1a', textAlign:'center', fontFamily:'Georgia, serif' },
        { type:'text', left:300, top:688, text: loc || 'Location', fontSize:14, fill:'#8B6914', textAlign:'center', fontFamily:'Georgia, serif' },
        { type:'rect', left:200, top:730, width:200, height:44, fill:'#8B6914', rx:2 },
        { type:'text', left:300, top:752, text:'RSVP', fontSize:13, fill:'#fff', textAlign:'center', fontFamily:'Georgia, serif', fontWeight:'bold' },
      ]
    }),
  },
];

export function TemplatesPanel({ fabricRef, eventTitle, eventDate, eventLocation, onClose, onSave }: TemplatesPanelProps) {
  const [applying, setApplying] = useState<string | null>(null);

  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
    : '';

  async function applyTemplate(template: typeof TEMPLATES[0]) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setApplying(template.id);

    try {
      const { Rect, IText } = await import('fabric');
      const layout = template.layout(eventTitle ?? '', formattedDate, eventLocation ?? '');

      canvas.clear();
      canvas.backgroundColor = layout.background;

      for (const obj of layout.objects) {
        let fabricObj: any = null;
        if (obj.type === 'rect') {
          fabricObj = new Rect({
            left: obj.left, top: obj.top, width: obj.width, height: obj.height,
            fill: obj.fill, rx: (obj as any).rx ?? 0, ry: (obj as any).rx ?? 0,
            opacity: (obj as any).opacity ?? 1,
          });
        } else if (obj.type === 'text') {
          fabricObj = new IText((obj as any).text ?? '', {
            left: obj.left, top: obj.top,
            fontSize: (obj as any).fontSize ?? 20,
            fill: obj.fill,
            fontFamily: (obj as any).fontFamily ?? 'Georgia, serif',
            fontWeight: (obj as any).fontWeight ?? 'normal',
            fontStyle:  (obj as any).fontStyle  ?? 'normal',
            textAlign:  (obj as any).textAlign  ?? 'left',
            originX:    (obj as any).textAlign === 'center' ? 'center' : 'left',
          });
        }
        if (fabricObj) canvas.add(fabricObj);
      }

      canvas.renderAll();
      await onSave?.();
      onClose();
    } finally {
      setApplying(null);
    }
  }

  return (
    <div style={{
      position:'absolute', left:48, top:0, bottom:0, width:280,
      background:'var(--ec-surface)', borderRight:'1px solid var(--ec-border)',
      display:'flex', flexDirection:'column', zIndex:10,
      boxShadow:'4px 0 16px rgba(0,0,0,0.3)',
    }}>
      <div style={{ padding:'12px 14px 8px', borderBottom:'1px solid var(--ec-border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <p style={{ fontSize:11, fontWeight:600, color:'var(--ec-text-2)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Templates</p>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ec-text-3)', fontSize:18 }}>×</button>
      </div>

      <p style={{ fontSize:11, color:'var(--ec-text-3)', padding:'8px 14px 4px' }}>
        Click a template to apply — your event details auto-fill
      </p>

      <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {TEMPLATES.map(t => (
            <div
              key={t.id}
              onClick={() => applyTemplate(t)}
              style={{
                borderRadius:'var(--ec-radius-md)',
                border:'1px solid var(--ec-border)',
                overflow:'hidden',
                cursor: applying === t.id ? 'wait' : 'pointer',
                opacity: applying === t.id ? 0.6 : 1,
                transition:'all 0.15s',
                background:'var(--ec-surface-raised)',
              }}
            >
              {/* Color preview bar */}
              <div style={{ height:48, background: t.preview.bg, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'0 16px' }}>
                <div style={{ flex:1, height:2, background: t.preview.accent, opacity:0.6 }} />
                <span style={{ fontSize:11, color: t.preview.accent, fontWeight:600, whiteSpace:'nowrap' }}>{t.name}</span>
                <div style={{ flex:1, height:2, background: t.preview.accent, opacity:0.6 }} />
              </div>
              <div style={{ padding:'8px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:11, color:'var(--ec-text-2)' }}>{t.description}</span>
                {applying === t.id && <div className="ec-spinner" style={{ width:14, height:14 }} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
