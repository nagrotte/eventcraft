'use client';

import { useState } from 'react';
import type { Canvas } from 'fabric';
import { QrConfigDialog } from '@/components/canvas/QrConfigDialog';

interface CanvasToolbarProps {
  fabricRef:          React.MutableRefObject<Canvas | null>;
  activeTool:         string;
  onToolChange:       (tool: string) => void;
  eventId?:           string;
  eventTitle?:        string;
  eventDate?:         string;
  eventLocation?:     string;
  micrositeSlug?:     string;
  organizerName?:     string;
  organizerPhone?:    string;
  organizerEmail?:    string;
  onToggleImages?:    () => void;
  showImages?:        boolean;
  onToggleTemplates?: () => void;
  showTemplates?:     boolean;
  onDeleteSelected?:  () => void;
}

type QrPlacement = 'center' | 'bottom-left' | 'bottom-right' | 'bottom-both';

export function CanvasToolbar({
  fabricRef, activeTool, onToolChange, eventId,
  eventTitle, eventDate, eventLocation,
  micrositeSlug, organizerName, organizerPhone, organizerEmail,
  onToggleImages, showImages,
  onToggleTemplates, showTemplates,
  onDeleteSelected
}: CanvasToolbarProps) {
  const [showQrDialog,     setShowQrDialog]     = useState(false);
  const [showQrPlacement,  setShowQrPlacement]  = useState(false);
  const [pendingQrUrl,     setPendingQrUrl]      = useState('');
  const [pendingQrLabel,   setPendingQrLabel]    = useState('RSVP');

  async function addText() {
    const { IText } = await import('fabric');
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = new IText('Double-click to edit', {
      left: canvas.width! / 2 - 120, top: canvas.height! / 2 - 20,
      fontSize: 24, fill: '#ffffff', fontFamily: 'Georgia, serif',
    });
    canvas.add(obj); canvas.setActiveObject(obj); canvas.renderAll();
  }

  async function addRect() {
    const { Rect } = await import('fabric');
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = new Rect({ left: canvas.width!/2-60, top: canvas.height!/2-40, width:120, height:80, fill:'#6366F1', rx:8, ry:8 });
    canvas.add(obj); canvas.setActiveObject(obj); canvas.renderAll();
  }

  async function addCircle() {
    const { Circle } = await import('fabric');
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = new Circle({ left: canvas.width!/2-40, top: canvas.height!/2-40, radius:40, fill:'#6366F1' });
    canvas.add(obj); canvas.setActiveObject(obj); canvas.renderAll();
  }

  // Generate a high-quality QR data URL (512x512, black on white)
  async function generateQrDataUrl(url: string): Promise<string> {
    const QRCode = (await import('qrcode')).default;
    return QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });
  }

  // Place a single QR with premium cream card — label is dynamic based on QR type
  async function placeQrAt(
    canvas: Canvas,
    dataUrl: string,
    left: number,
    top: number,
    scale: number,
    label: string,
  ) {
    const { FabricImage, Rect, IText, Line, Group } = await import('fabric');
    const img = await FabricImage.fromURL(dataUrl);

    const qrW   = img.width!  * scale;
    const qrH   = img.height! * scale;
    const pad    = 10;
    const cardW  = qrW + pad * 2;
    const labelH = 26;

    // Cream card background
    const bg = new Rect({
      left: 0, top: 0,
      width: cardW, height: qrH + pad * 2 + labelH,
      fill: '#f5f0e8',
      rx: 10, ry: 10,
      shadow: 'rgba(0,0,0,0.25) 0px 4px 10px',
    });

    // QR — always black on white, scannable
    img.set({ left: pad, top: pad, scaleX: scale, scaleY: scale });

    // Thin divider between QR and label
    const divider = new Line([pad, qrH + pad * 2, cardW - pad, qrH + pad * 2], {
      stroke: 'rgba(0,0,0,0.1)',
      strokeWidth: 1,
      selectable: false,
    });

    // Dynamic label — uppercase, letter-spaced, dark brown
    const lbl = new IText(label.toUpperCase(), {
      left: cardW / 2,
      top: qrH + pad * 2 + labelH / 2,
      fontSize: 10,
      fill: '#5a4a2a',
      fontFamily: 'Georgia, serif',
      fontWeight: 'bold',
      charSpacing: 120,
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
    });

    const group = new Group([bg, img, divider, lbl], { left, top });
    canvas.add(group);
    canvas.setActiveObject(group);
  }

  async function handleQrPlacement(placement: QrPlacement) {
    const canvas = fabricRef.current;
    if (!canvas || !pendingQrUrl) return;
    setShowQrPlacement(false);

    const dataUrl = await generateQrDataUrl(pendingQrUrl);
    const scale   = 0.18; // 512 * 0.18 ≈ 92px
    const qrSize  = 512 * scale + 20; // with padding

    const cw = canvas.width!;
    const ch = canvas.height!;

    switch (placement) {
      case 'center':
        await placeQrAt(canvas, dataUrl, cw/2 - qrSize/2, ch/2 - qrSize/2, scale, pendingQrLabel);
        break;
      case 'bottom-left':
        await placeQrAt(canvas, dataUrl, 40, ch - qrSize - 40, scale, pendingQrLabel);
        break;
      case 'bottom-right':
        await placeQrAt(canvas, dataUrl, cw - qrSize - 40, ch - qrSize - 40, scale, pendingQrLabel);
        break;
      case 'bottom-both':
        await placeQrAt(canvas, dataUrl, 40,               ch - qrSize - 40, scale, pendingQrLabel);
        await placeQrAt(canvas, dataUrl, cw - qrSize - 40, ch - qrSize - 40, scale, pendingQrLabel);
        break;
    }

    canvas.renderAll();
    setPendingQrUrl('');
    setPendingQrLabel('RSVP');
  }

  function handleQrConfigDone(url: string, label: string) {
    setShowQrDialog(false);
    setPendingQrUrl(url);
    setPendingQrLabel(label);
    setShowQrPlacement(true);
  }

  function bringForward() {
    const canvas = fabricRef.current; if (!canvas) return;
    const obj = canvas.getActiveObject(); if (obj) { canvas.bringObjectForward(obj); canvas.renderAll(); }
  }

  function sendBackward() {
    const canvas = fabricRef.current; if (!canvas) return;
    const obj = canvas.getActiveObject(); if (obj) { canvas.sendObjectBackwards(obj); canvas.renderAll(); }
  }

  const tools = [
    { id:'select', label:'↖', title:'Select' },
    { id:'text',   label:'T', title:'Add text',      action: addText },
    { id:'rect',   label:'▭', title:'Add rectangle', action: addRect },
    { id:'circle', label:'○', title:'Add circle',    action: addCircle },
  ];

  const s = (active: boolean, danger = false): React.CSSProperties => ({
    width:36, height:36, borderRadius:'var(--ec-radius-md)',
    border: active ? '1px solid var(--ec-brand-border)' : '1px solid transparent',
    background: active ? 'var(--ec-brand-subtle)' : 'transparent',
    color: danger ? 'var(--ec-danger)' : active ? 'var(--ec-brand)' : 'var(--ec-text-2)',
    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:14, transition:'all 0.12s ease',
  });

  const PLACEMENTS: { id: QrPlacement; label: string; desc: string; icon: string }[] = [
    { id: 'bottom-left',  label: 'Bottom Left',  desc: 'Single QR, bottom-left corner',  icon: '↙' },
    { id: 'bottom-right', label: 'Bottom Right', desc: 'Single QR, bottom-right corner', icon: '↘' },
    { id: 'bottom-both',  label: 'Both Corners', desc: 'Two QR codes, bottom corners',   icon: '↙↘' },
    { id: 'center',       label: 'Center',       desc: 'Place in the middle of canvas',   icon: '⊕' },
  ];

  return (
    <>
      <div style={{ width:48, background:'var(--ec-surface)', borderRight:'1px solid var(--ec-border)', display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 0', gap:4, flexShrink:0 }}>
        {tools.map(t => (
          <button key={t.id} title={t.title} style={s(activeTool===t.id)}
            onClick={() => { onToolChange(t.id); (t as any).action?.(); }}>
            {t.label}
          </button>
        ))}
        <button title="Add QR Code" style={s(false)} onClick={() => setShowQrDialog(true)}>⊞</button>
        <button title="Stock photos & upload" style={s(!!showImages)} onClick={onToggleImages}>🖼</button>
        <button title="Templates" style={s(!!showTemplates)} onClick={onToggleTemplates}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="8" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="1" y="8" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="8" y="8" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </button>
        <div style={{ flex:1 }} />
        <button title="Bring forward" style={s(false)} onClick={bringForward}>↑</button>
        <button title="Send backward" style={s(false)} onClick={sendBackward}>↓</button>
        <button title="Delete (Del)" style={s(false,true)} onClick={onDeleteSelected}>✕</button>
      </div>

      {/* QR Config Dialog */}
      {showQrDialog && (
        <QrConfigDialog
          eventId={eventId ?? ''}
          eventTitle={eventTitle}
          eventDate={eventDate}
          eventLocation={eventLocation}
          micrositeSlug={micrositeSlug}
          organizerName={organizerName}
          organizerPhone={organizerPhone}
          organizerEmail={organizerEmail}
          onPlace={handleQrConfigDone}
          onClose={() => setShowQrDialog(false)}
        />
      )}

      {/* QR Placement Dialog */}
      {showQrPlacement && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.65)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000,
        }}>
          <div style={{
            background:'var(--ec-surface)', border:'1px solid var(--ec-border)',
            borderRadius:'var(--ec-radius-xl)', padding:28, width:380,
            boxShadow:'var(--ec-shadow-lg)',
          }}>
            <h2 style={{ fontSize:16, fontWeight:600, color:'var(--ec-text-1)', marginBottom:6 }}>
              Place QR Code
            </h2>
            <p style={{ fontSize:12, color:'var(--ec-text-3)', marginBottom:18 }}>
              Choose where to place the QR code on the canvas. It will have a soft rounded background for a premium look.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
              {PLACEMENTS.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleQrPlacement(p.id)}
                  style={{
                    padding:'12px 16px', borderRadius:'var(--ec-radius-md)',
                    border:'1px solid var(--ec-border)',
                    background:'var(--ec-surface-raised)',
                    cursor:'pointer', display:'flex', alignItems:'center', gap:14,
                    transition:'all 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--ec-brand)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--ec-border)')}
                >
                  <span style={{ fontSize:20, width:28, textAlign:'center' }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--ec-text-1)', marginBottom:2 }}>{p.label}</div>
                    <div style={{ fontSize:11, color:'var(--ec-text-3)' }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button
                onClick={() => { setShowQrPlacement(false); setPendingQrUrl(''); }}
                style={{ padding:'8px 16px', borderRadius:'var(--ec-radius-md)', border:'1px solid var(--ec-border)', background:'none', color:'var(--ec-text-2)', cursor:'pointer', fontSize:13 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
