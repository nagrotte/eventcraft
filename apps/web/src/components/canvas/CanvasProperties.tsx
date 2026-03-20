'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Canvas, FabricObject } from 'fabric';

interface CanvasPropertiesProps {
  fabricRef: React.MutableRefObject<Canvas | null>;
  ready:     boolean;
}

interface ObjProps {
  type:       string;
  x:          number;
  y:          number;
  width:      number;
  height:     number;
  fill:       string;
  opacity:    number;
  isText:     boolean;
  fontSize:   number;
  fontFamily: string;
  fontWeight: string;
  fontStyle:  string;
  textAlign:  string;
}

const FONTS = [
  { label: 'Georgia',       value: 'Georgia, serif' },
  { label: 'Playfair',      value: 'Playfair Display, serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Inter',         value: 'Inter, sans-serif' },
  { label: 'Helvetica',     value: 'Helvetica Neue, sans-serif' },
  { label: 'Noto Sans',     value: 'Noto Sans, sans-serif' },
  { label: 'Noto Serif Devanagari', value: 'Noto Serif Devanagari, serif' },
  { label: 'Noto Sans Telugu', value: 'Noto Sans Telugu, sans-serif' },
  { label: 'Courier',       value: 'Courier New, monospace' },
];

function toHex(color: string): string {
  if (!color || color === 'transparent') return '#000000';
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) return color;
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (m) return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
  return '#000000';
}

export function CanvasProperties({ fabricRef, ready }: CanvasPropertiesProps) {
  const [selected,  setSelected]  = useState<ObjProps | null>(null);
  const [canvasBg,  setCanvasBg]  = useState('#ffffff');
  const [hexInput,  setHexInput]  = useState('');
  const [bgHexInput, setBgHexInput] = useState('');

  const updateProps = useCallback((obj: FabricObject) => {
    const isText = ['i-text','text','itext'].includes(obj.type ?? '');
    const fill   = toHex(typeof obj.fill === 'string' ? obj.fill : '#000000');
    setHexInput(fill);
    setSelected({
      type:       obj.type ?? 'object',
      x:          Math.round(obj.left  ?? 0),
      y:          Math.round(obj.top   ?? 0),
      width:      Math.round((obj.width  ?? 0) * (obj.scaleX ?? 1)),
      height:     Math.round((obj.height ?? 0) * (obj.scaleY ?? 1)),
      fill,
      opacity:    Math.round((obj.opacity ?? 1) * 100),
      isText,
      fontSize:   (obj as any).fontSize   ?? 20,
      fontFamily: (obj as any).fontFamily ?? 'Georgia, serif',
      fontWeight: (obj as any).fontWeight ?? 'normal',
      fontStyle:  (obj as any).fontStyle  ?? 'normal',
      textAlign:  (obj as any).textAlign  ?? 'left',
    });
  }, []);

  useEffect(() => {
    if (!ready || !fabricRef.current) return;
    const canvas = fabricRef.current;
    const bg = canvas.backgroundColor;
    if (typeof bg === 'string') { const h = toHex(bg); setCanvasBg(h); setBgHexInput(h); }

    const onSel    = () => { const o = canvas.getActiveObject(); o ? updateProps(o) : setSelected(null); };
    const onDesel  = () => setSelected(null);
    const onMod    = () => { const o = canvas.getActiveObject(); if (o) updateProps(o); };

    canvas.on('selection:created', onSel);
    canvas.on('selection:updated', onSel);
    canvas.on('selection:cleared', onDesel);
    canvas.on('object:modified',   onMod);
    canvas.on('object:scaling',    onMod);
    return () => {
      canvas.off('selection:created', onSel);
      canvas.off('selection:updated', onSel);
      canvas.off('selection:cleared', onDesel);
      canvas.off('object:modified',   onMod);
      canvas.off('object:scaling',    onMod);
    };
  }, [ready, fabricRef, updateProps]);

  function setObjProp(prop: string, value: any) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    obj.set(prop as any, value);
    canvas.renderAll();
    setSelected(prev => prev ? { ...prev, [prop]: value } : null);
  }

  function applyFill(color: string) {
    setObjProp('fill', color);
    setHexInput(color);
  }

  function applyBg(color: string) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.backgroundColor = color;
    canvas.renderAll();
    setCanvasBg(color);
    setBgHexInput(color);
  }

  function handleHexSubmit(val: string) {
    const clean = val.startsWith('#') ? val : '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) applyFill(clean);
  }

  function handleBgHexSubmit(val: string) {
    const clean = val.startsWith('#') ? val : '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) applyBg(clean);
  }

  const row: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, gap:8 };
  const lbl: React.CSSProperties = { fontSize:12, color:'var(--ec-text-2)', flexShrink:0 };
  const inp: React.CSSProperties = { width:56, padding:'4px 6px', fontSize:11, background:'var(--ec-surface-raised)', border:'1px solid var(--ec-border)', borderRadius:'var(--ec-radius-sm)', color:'var(--ec-text-1)', textAlign:'right' };
  const sec: React.CSSProperties = { fontSize:11, color:'var(--ec-text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8, fontWeight:500, marginTop:12 };

  const ColorRow = ({ label, color, onColor, hexVal, onHex }: { label:string; color:string; onColor:(c:string)=>void; hexVal:string; onHex:(v:string)=>void }) => (
    <div style={row}>
      <span style={lbl}>{label}</span>
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        <input type="color" value={color} onChange={e => onColor(e.target.value)}
          style={{ width:28, height:26, border:'none', background:'none', cursor:'pointer', padding:0, flexShrink:0 }} />
        <input
          value={hexVal}
          onChange={e => onHex(e.target.value)}
          onBlur={e => label === 'Background' ? handleBgHexSubmit(e.target.value) : handleHexSubmit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') label === 'Background' ? handleBgHexSubmit((e.target as HTMLInputElement).value) : handleHexSubmit((e.target as HTMLInputElement).value); }}
          placeholder="#000000"
          style={{ width:70, padding:'4px 6px', fontSize:10, background:'var(--ec-surface-raised)', border:'1px solid var(--ec-border)', borderRadius:'var(--ec-radius-sm)', color:'var(--ec-text-1)', fontFamily:'monospace' }}
        />
      </div>
    </div>
  );

  return (
    <div style={{ width:210, background:'var(--ec-surface)', borderLeft:'1px solid var(--ec-border)', flexShrink:0, padding:14, overflowY:'auto', fontSize:12 }}>

      <p style={sec}>Canvas</p>
      <ColorRow label="Background" color={canvasBg} onColor={applyBg} hexVal={bgHexInput} onHex={setBgHexInput} />
      <p style={{ fontSize:11, color:'var(--ec-text-3)', marginBottom:4 }}>600 × 850 px</p>

      <div style={{ borderTop:'1px solid var(--ec-border)', margin:'12px 0 8px' }} />
      <p style={{ ...sec, marginTop:0 }}>Properties</p>

      {!selected ? (
        <p style={{ fontSize:12, color:'var(--ec-text-3)' }}>Select an object</p>
      ) : (
        <>
          <p style={{ fontSize:11, color:'var(--ec-text-2)', marginBottom:10, textTransform:'capitalize' }}>{selected.type}</p>

          <div style={row}><span style={lbl}>X</span><input style={inp} value={selected.x} readOnly /></div>
          <div style={row}><span style={lbl}>Y</span><input style={inp} value={selected.y} readOnly /></div>
          <div style={row}><span style={lbl}>W</span><input style={inp} value={selected.width} readOnly /></div>
          <div style={row}><span style={lbl}>H</span><input style={inp} value={selected.height} readOnly /></div>

          <ColorRow
            label={selected.isText ? 'Color' : 'Fill'}
            color={selected.fill}
            onColor={applyFill}
            hexVal={hexInput}
            onHex={setHexInput}
          />

          <div style={row}>
            <span style={lbl}>Opacity</span>
            <input type="number" min={0} max={100} value={selected.opacity}
              onChange={e => setObjProp('opacity', Number(e.target.value)/100)} style={inp} />
          </div>

          {selected.isText && (
            <>
              <div style={{ borderTop:'1px solid var(--ec-border)', margin:'10px 0 8px' }} />
              <p style={{ ...sec, marginTop:0 }}>Text</p>

              {/* Font family */}
              <div style={{ marginBottom:8 }}>
                <p style={{ ...lbl, marginBottom:4 }}>Font</p>
                <select
                  value={selected.fontFamily}
                  onChange={e => setObjProp('fontFamily', e.target.value)}
                  style={{ width:'100%', padding:'5px 6px', fontSize:11, background:'var(--ec-surface-raised)', border:'1px solid var(--ec-border)', borderRadius:'var(--ec-radius-sm)', color:'var(--ec-text-1)', fontFamily:selected.fontFamily }}
                >
                  {FONTS.map(f => (
                    <option key={f.value} value={f.value} style={{ fontFamily:f.value }}>{f.label}</option>
                  ))}
                </select>
              </div>

              {/* Font size */}
              <div style={row}>
                <span style={lbl}>Size</span>
                <input type="number" min={6} max={200} value={selected.fontSize}
                  onChange={e => setObjProp('fontSize', Number(e.target.value))} style={inp} />
              </div>

              {/* Bold / Italic */}
              <div style={{ ...row, marginBottom:8 }}>
                <span style={lbl}>Style</span>
                <div style={{ display:'flex', gap:4 }}>
                  {[
                    { label:'B', prop:'fontWeight', on:'bold',   off:'normal', active: selected.fontWeight==='bold',   style:{fontWeight:'bold'} },
                    { label:'I', prop:'fontStyle',  on:'italic', off:'normal', active: selected.fontStyle==='italic',  style:{fontStyle:'italic'} },
                  ].map(btn => (
                    <button key={btn.prop}
                      onClick={() => setObjProp(btn.prop, btn.active ? btn.off : btn.on)}
                      style={{ width:26, height:26, borderRadius:4,
                        border: `1px solid ${btn.active ? 'var(--ec-brand)' : 'var(--ec-border)'}`,
                        background: btn.active ? 'var(--ec-brand-subtle)' : 'var(--ec-surface-raised)',
                        color: btn.active ? 'var(--ec-brand)' : 'var(--ec-text-2)',
                        cursor:'pointer', fontSize:12, ...btn.style }}
                    >{btn.label}</button>
                  ))}
                </div>
              </div>

              {/* Alignment */}
              <div style={{ ...row, marginBottom:0 }}>
                <span style={lbl}>Align</span>
                <div style={{ display:'flex', gap:4 }}>
                  {(['left','center','right'] as const).map(a => (
                    <button key={a}
                      onClick={() => setObjProp('textAlign', a)}
                      style={{ width:26, height:26, borderRadius:4,
                        border: `1px solid ${selected.textAlign===a ? 'var(--ec-brand)' : 'var(--ec-border)'}`,
                        background: selected.textAlign===a ? 'var(--ec-brand-subtle)' : 'var(--ec-surface-raised)',
                        color: selected.textAlign===a ? 'var(--ec-brand)' : 'var(--ec-text-2)',
                        cursor:'pointer', fontSize:10 }}
                    >{a==='left'?'L':a==='center'?'C':'R'}</button>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
