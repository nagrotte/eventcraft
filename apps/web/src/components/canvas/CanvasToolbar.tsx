'use client';

import { useState } from 'react';
import type { Canvas } from 'fabric';
import { QrConfigDialog } from '@/components/canvas/QrConfigDialog';

interface CanvasToolbarProps {
  fabricRef:         React.MutableRefObject<Canvas | null>;
  activeTool:        string;
  onToolChange:      (tool: string) => void;
  eventId?:          string;
  onToggleImages?:   () => void;
  showImages?:       boolean;
  onDeleteSelected?: () => void;
}

export function CanvasToolbar({ fabricRef, activeTool, onToolChange, eventId, onToggleImages, showImages, onDeleteSelected }: CanvasToolbarProps) {
  const [showQrDialog, setShowQrDialog] = useState(false);

  async function addText() {
    const { IText } = await import('fabric');
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = new IText('Double-click to edit', {
      left: canvas.width! / 2 - 120, top: canvas.height! / 2 - 20,
      fontSize: 24, fill: '#1a1a2e', fontFamily: 'Inter, sans-serif',
    });
    canvas.add(obj); canvas.setActiveObject(obj); canvas.renderAll();
  }

  async function addRect() {
    const { Rect } = await import('fabric');
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = new Rect({
      left: canvas.width! / 2 - 60, top: canvas.height! / 2 - 40,
      width: 120, height: 80, fill: '#6366F1', rx: 8, ry: 8,
    });
    canvas.add(obj); canvas.setActiveObject(obj); canvas.renderAll();
  }

  async function addCircle() {
    const { Circle } = await import('fabric');
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = new Circle({
      left: canvas.width! / 2 - 40, top: canvas.height! / 2 - 40,
      radius: 40, fill: '#6366F1',
    });
    canvas.add(obj); canvas.setActiveObject(obj); canvas.renderAll();
  }

  async function placeQrCode(url: string) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setShowQrDialog(false);
    const QRCode = (await import('qrcode')).default;
    const { FabricImage } = await import('fabric');
    const dataUrl = await QRCode.toDataURL(url, {
      width: 200, margin: 1,
      color: { dark: '#1a1a2e', light: '#ffffff' },
    });
    const img = await FabricImage.fromURL(dataUrl);
    img.set({ left: canvas.width! / 2 - 75, top: canvas.height! / 2 - 75, scaleX: 0.75, scaleY: 0.75 });
    canvas.add(img); canvas.setActiveObject(img); canvas.renderAll();
  }

  function bringForward() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj) { canvas.bringObjectForward(obj); canvas.renderAll(); }
  }

  function sendBackward() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj) { canvas.sendObjectBackwards(obj); canvas.renderAll(); }
  }

  const tools = [
    { id: 'select', label: '↖', title: 'Select' },
    { id: 'text',   label: 'T', title: 'Add text',      action: addText },
    { id: 'rect',   label: '▭', title: 'Add rectangle', action: addRect },
    { id: 'circle', label: '○', title: 'Add circle',    action: addCircle },
  ];

  const toolStyle = (active: boolean, danger = false): React.CSSProperties => ({
    width: 36, height: 36,
    borderRadius: 'var(--ec-radius-md)',
    border: active ? '1px solid var(--ec-brand-border)' : '1px solid transparent',
    background: active ? 'var(--ec-brand-subtle)' : 'transparent',
    color: danger ? 'var(--ec-danger)' : active ? 'var(--ec-brand)' : 'var(--ec-text-2)',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, transition: 'all 0.12s ease',
  });

  return (
    <>
      <div style={{
        width: 48, background: 'var(--ec-surface)',
        borderRight: '1px solid var(--ec-border)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '12px 0', gap: 4, flexShrink: 0,
      }}>
        {tools.map(t => (
          <button key={t.id} title={t.title} style={toolStyle(activeTool === t.id)}
            onClick={() => { onToolChange(t.id); t.action?.(); }}>
            {t.label}
          </button>
        ))}

        {/* QR with config dialog */}
        <button
          title="Add QR Code"
          style={toolStyle(false)}
          onClick={() => setShowQrDialog(true)}
        >
          ⊞
        </button>

        {/* Stock photos */}
        <button title="Stock photos" style={toolStyle(!!showImages)} onClick={onToggleImages}>
          🖼
        </button>

        <div style={{ flex: 1 }} />

        <button title="Bring forward" style={toolStyle(false)} onClick={bringForward}>↑</button>
        <button title="Send backward" style={toolStyle(false)} onClick={sendBackward}>↓</button>
        <button title="Delete selected (Del)" style={toolStyle(false, true)} onClick={onDeleteSelected}>✕</button>
      </div>

      {showQrDialog && (
        <QrConfigDialog
          eventId={eventId ?? ''}
          onPlace={placeQrCode}
          onClose={() => setShowQrDialog(false)}
        />
      )}
    </>
  );
}
