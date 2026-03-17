'use client';

import { useEffect, useState } from 'react';
import type { Canvas, FabricObject } from 'fabric';

interface CanvasPropertiesProps {
  fabricRef: React.MutableRefObject<Canvas | null>;
  ready: boolean;
}

interface ObjProps {
  type:    string;
  x:       number;
  y:       number;
  width:   number;
  height:  number;
  fill:    string;
  opacity: number;
}

export function CanvasProperties({ fabricRef, ready }: CanvasPropertiesProps) {
  const [selected, setSelected] = useState<ObjProps | null>(null);

  useEffect(() => {
    if (!ready || !fabricRef.current) return;
    const canvas = fabricRef.current;

    function onSelect() {
      const obj = canvas.getActiveObject();
      if (!obj) { setSelected(null); return; }
      updateProps(obj);
    }

    function onModified() {
      const obj = canvas.getActiveObject();
      if (obj) updateProps(obj);
    }

    function onDeselect() { setSelected(null); }

    function updateProps(obj: FabricObject) {
      setSelected({
        type:    obj.type ?? 'object',
        x:       Math.round(obj.left ?? 0),
        y:       Math.round(obj.top ?? 0),
        width:   Math.round((obj.width ?? 0) * (obj.scaleX ?? 1)),
        height:  Math.round((obj.height ?? 0) * (obj.scaleY ?? 1)),
        fill:    typeof obj.fill === 'string' ? obj.fill : '#000000',
        opacity: Math.round((obj.opacity ?? 1) * 100),
      });
    }

    canvas.on('selection:created',  onSelect);
    canvas.on('selection:updated',  onSelect);
    canvas.on('selection:cleared',  onDeselect);
    canvas.on('object:modified',    onModified);

    return () => {
      canvas.off('selection:created',  onSelect);
      canvas.off('selection:updated',  onSelect);
      canvas.off('selection:cleared',  onDeselect);
      canvas.off('object:modified',    onModified);
    };
  }, [ready, fabricRef]);

  function updateFill(color: string) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    obj.set('fill', color);
    canvas.renderAll();
    setSelected(prev => prev ? { ...prev, fill: color } : null);
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

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--ec-text-3)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 8,
    fontWeight: 500,
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  };

  const inputStyle: React.CSSProperties = {
    width: 64,
    padding: '4px 8px',
    fontSize: 11,
    background: 'var(--ec-surface-raised)',
    border: '1px solid var(--ec-border)',
    borderRadius: 'var(--ec-radius-sm)',
    color: 'var(--ec-text-1)',
    textAlign: 'right' as const,
  };

  const propLabel: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--ec-text-2)',
  };

  return (
    <div style={{
      width: 200,
      background: 'var(--ec-surface)',
      borderLeft: '1px solid var(--ec-border)',
      flexShrink: 0,
      padding: 16,
      overflowY: 'auto',
    }}>
      <p style={labelStyle}>Properties</p>

      {!selected ? (
        <p style={{ fontSize: 12, color: 'var(--ec-text-3)' }}>
          Select an object
        </p>
      ) : (
        <>
          <p style={{ fontSize: 11, color: 'var(--ec-text-2)', marginBottom: 12, textTransform: 'capitalize' }}>
            {selected.type}
          </p>

          <div style={rowStyle}>
            <span style={propLabel}>X</span>
            <input style={inputStyle} value={selected.x} readOnly />
          </div>
          <div style={rowStyle}>
            <span style={propLabel}>Y</span>
            <input style={inputStyle} value={selected.y} readOnly />
          </div>
          <div style={rowStyle}>
            <span style={propLabel}>W</span>
            <input style={inputStyle} value={selected.width} readOnly />
          </div>
          <div style={rowStyle}>
            <span style={propLabel}>H</span>
            <input style={inputStyle} value={selected.height} readOnly />
          </div>

          <div style={{ ...rowStyle, marginTop: 16 }}>
            <span style={propLabel}>Fill</span>
            <input
              type="color"
              value={selected.fill}
              onChange={e => updateFill(e.target.value)}
              style={{ width: 40, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            />
          </div>

          <div style={rowStyle}>
            <span style={propLabel}>Opacity</span>
            <input
              type="number"
              min={0} max={100}
              value={selected.opacity}
              onChange={e => updateOpacity(Number(e.target.value))}
              style={inputStyle}
            />
          </div>
        </>
      )}

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--ec-border)' }}>
        <p style={labelStyle}>Canvas</p>
        <p style={{ fontSize: 11, color: 'var(--ec-text-3)' }}>600 × 850 px</p>
        <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginTop: 4 }}>
          {ready ? '✓ Ready' : 'Initializing...'}
        </p>
      </div>
    </div>
  );
}
