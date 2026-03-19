'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Canvas, FabricObject } from 'fabric';

interface CanvasPropertiesProps {
  fabricRef: React.MutableRefObject<Canvas | null>;
  ready:     boolean;
}

interface ObjProps {
  type:      string;
  x:         number;
  y:         number;
  width:     number;
  height:    number;
  fill:      string;
  textColor: string;
  opacity:   number;
  isText:    boolean;
}

function toHex(color: string): string {
  if (!color || color === 'transparent') return '#000000';
  if (color.startsWith('#') && color.length === 7) return color;
  // Convert rgb(r,g,b) to hex
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (m) {
    return '#' + [m[1], m[2], m[3]]
      .map(n => parseInt(n).toString(16).padStart(2, '0'))
      .join('');
  }
  return '#000000';
}

export function CanvasProperties({ fabricRef, ready }: CanvasPropertiesProps) {
  const [selected,  setSelected]  = useState<ObjProps | null>(null);
  const [canvasBg,  setCanvasBg]  = useState('#ffffff');

  const updateProps = useCallback((obj: FabricObject) => {
    const isText = obj.type === 'i-text' || obj.type === 'text' || obj.type === 'itext';
    const fill = typeof obj.fill === 'string' ? toHex(obj.fill) : '#000000';
    setSelected({
      type:      obj.type ?? 'object',
      x:         Math.round(obj.left ?? 0),
      y:         Math.round(obj.top  ?? 0),
      width:     Math.round((obj.width  ?? 0) * (obj.scaleX ?? 1)),
      height:    Math.round((obj.height ?? 0) * (obj.scaleY ?? 1)),
      fill,
      textColor: fill,
      opacity:   Math.round((obj.opacity ?? 1) * 100),
      isText,
    });
  }, []);

  useEffect(() => {
    if (!ready || !fabricRef.current) return;
    const canvas = fabricRef.current;

    // Sync canvas background
    const bg = canvas.backgroundColor;
    if (typeof bg === 'string') setCanvasBg(toHex(bg));

    function onSelect() {
      const obj = canvas.getActiveObject();
      if (!obj) { setSelected(null); return; }
      updateProps(obj);
    }
    function onDeselect() { setSelected(null); }
    function onModified() {
      const obj = canvas.getActiveObject();
      if (obj) updateProps(obj);
    }

    canvas.on('selection:created', onSelect);
    canvas.on('selection:updated', onSelect);
    canvas.on('selection:cleared', onDeselect);
    canvas.on('object:modified',   onModified);
    canvas.on('object:scaling',    onModified);

    return () => {
      canvas.off('selection:created', onSelect);
      canvas.off('selection:updated', onSelect);
      canvas.off('selection:cleared', onDeselect);
      canvas.off('object:modified',   onModified);
      canvas.off('object:scaling',    onModified);
    };
  }, [ready, fabricRef, updateProps]);

  function updateFill(color: string) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    obj.set('fill', color);
    canvas.renderAll();
    setSelected(prev => prev ? { ...prev, fill: color, textColor: color } : null);
  }

  function updateOpacity(val: number) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    obj.set('opacity', val / 100);
    canvas.renderAll();
    setSelected(prev => prev ? { ...prev, opacity: val } : null);
  }

  function updateCanvasBg(color: string) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.backgroundColor = color;
    canvas.renderAll();
    setCanvasBg(color);
  }

  const label: React.CSSProperties = { fontSize: 12, color: 'var(--ec-text-2)' };
  const row: React.CSSProperties   = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 };
  const inp: React.CSSProperties   = { width: 64, padding: '4px 8px', fontSize: 11, background: 'var(--ec-surface-raised)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-sm)', color: 'var(--ec-text-1)', textAlign: 'right' };
  const sectionLabel: React.CSSProperties = { fontSize: 11, color: 'var(--ec-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 500 };

  return (
    <div style={{ width: 200, background: 'var(--ec-surface)', borderLeft: '1px solid var(--ec-border)', flexShrink: 0, padding: 16, overflowY: 'auto' }}>

      {/* Canvas background */}
      <p style={sectionLabel}>Canvas</p>
      <div style={row}>
        <span style={label}>Background</span>
        <input
          type="color"
          value={canvasBg}
          onChange={e => updateCanvasBg(e.target.value)}
          style={{ width: 40, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
        />
      </div>
      <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginBottom: 16 }}>600 × 850 px</p>

      <div style={{ borderTop: '1px solid var(--ec-border)', marginBottom: 16 }} />

      {/* Object properties */}
      <p style={sectionLabel}>Properties</p>

      {!selected ? (
        <p style={{ fontSize: 12, color: 'var(--ec-text-3)' }}>Select an object</p>
      ) : (
        <>
          <p style={{ fontSize: 11, color: 'var(--ec-text-2)', marginBottom: 12, textTransform: 'capitalize' }}>
            {selected.type}
          </p>

          <div style={row}><span style={label}>X</span><input style={inp} value={selected.x} readOnly /></div>
          <div style={row}><span style={label}>Y</span><input style={inp} value={selected.y} readOnly /></div>
          <div style={row}><span style={label}>W</span><input style={inp} value={selected.width} readOnly /></div>
          <div style={row}><span style={label}>H</span><input style={inp} value={selected.height} readOnly /></div>

          <div style={{ ...row, marginTop: 12 }}>
            <span style={label}>{selected.isText ? 'Text color' : 'Fill'}</span>
            <input
              type="color"
              value={selected.fill}
              onChange={e => updateFill(e.target.value)}
              style={{ width: 40, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            />
          </div>

          <div style={row}>
            <span style={label}>Opacity %</span>
            <input
              type="number" min={0} max={100}
              value={selected.opacity}
              onChange={e => updateOpacity(Number(e.target.value))}
              style={inp}
            />
          </div>
        </>
      )}
    </div>
  );
}
