'use client';

import { useState, useEffect, useRef } from 'react';
import { useCanvas }        from '@/hooks/useCanvas';
import { useDesign }        from '@/hooks/useDesign';
import { useExport }        from '@/hooks/useExport';
import { CanvasToolbar }    from '@/components/canvas/CanvasToolbar';
import { CanvasProperties } from '@/components/canvas/CanvasProperties';
import { AiDesignBar, AiDesignBarRef } from '@/components/canvas/AiDesignBar';
import { ImagePanel }       from '@/components/canvas/ImagePanel';
import { TemplatesPanel }   from '@/components/canvas/TemplatesPanel';
import { EcButton }         from '@/components/ui/EcButton';

interface CanvasShellProps {
  eventId:         string;
  eventTitle?:     string;
  eventDate?:      string;
  eventLocation?:  string;
  micrositeSlug?:  string;
  organizerName?:  string;
  organizerPhone?: string;
  organizerEmail?: string;
  initialPrompt?:  string | null;
}

interface ContextMenu { x: number; y: number; }

export function CanvasShell({ eventId, eventTitle, eventDate, eventLocation, micrositeSlug, organizerName, organizerPhone, organizerEmail, initialPrompt }: CanvasShellProps) {
  const canvasId              = `canvas-${eventId}`;
  const { fabricRef, ready }  = useCanvas(canvasId);
  const { save, saving }      = useDesign(eventId, fabricRef, ready);
  const { exportPNG, exportPDF, exporting } = useExport(fabricRef);
  const [activeTool,     setActiveTool]     = useState('select');
  const [savedMsg,       setSavedMsg]       = useState('');
  const [showImages,     setShowImages]     = useState(false);
  const [showTemplates,  setShowTemplates]  = useState(false);
  const [hasDesign,      setHasDesign]      = useState(false);
  const [contextMenu,    setContextMenu]    = useState<ContextMenu | null>(null);
  const contextRef      = useRef<HTMLDivElement>(null);
  const aiBarRef        = useRef<AiDesignBarRef | null>(null);
  const promptTriggered = useRef(false);

  useEffect(() => {
    if (!ready || !initialPrompt || promptTriggered.current) return;
    if (!aiBarRef.current) return;
    promptTriggered.current = true;
    setTimeout(() => { aiBarRef.current?.triggerGenerate(initialPrompt); }, 800);
  }, [ready, initialPrompt]);

  useEffect(() => {
    if (!ready || !fabricRef.current) return;
    const canvas = fabricRef.current;
    function checkDesign() { setHasDesign(canvas.getObjects().length > 0); }
    canvas.on('object:added',   checkDesign);
    canvas.on('object:removed', checkDesign);
    checkDesign();
    return () => { canvas.off('object:added', checkDesign); canvas.off('object:removed', checkDesign); };
  }, [ready, fabricRef]);

  async function handleSave() {
    await save();
    setSavedMsg('Saved');
    setTimeout(() => setSavedMsg(''), 2000);
  }

  function deleteSelected() {
    const canvas = fabricRef.current; if (!canvas) return;
    const active = canvas.getActiveObjects(); if (active.length===0) return;
    canvas.discardActiveObject();
    active.forEach(obj => canvas.remove(obj));
    canvas.renderAll(); setContextMenu(null);
  }

  function togglePanel(panel: 'images' | 'templates') {
    if (panel === 'images')    { setShowImages(v => !v); setShowTemplates(false); }
    if (panel === 'templates') { setShowTemplates(v => !v); setShowImages(false); }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag==='INPUT' || tag==='TEXTAREA') return;
      if (e.key==='Delete' || e.key==='Backspace') {
        const canvas = fabricRef.current; if (!canvas) return;
        if ((canvas.getActiveObject() as any)?.isEditing) return;
        e.preventDefault(); deleteSelected();
      }
      if (e.key==='Escape') setContextMenu(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fabricRef]);

  useEffect(() => {
    if (!ready || !fabricRef.current) return;
    const canvas = fabricRef.current;
    const el = canvas.getElement().parentElement; if (!el) return;
    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
      const found = canvas.findTarget(e as any) as any;
      if (found) { canvas.setActiveObject(found); canvas.renderAll(); setContextMenu({ x:e.clientX, y:e.clientY }); }
    }
    el.addEventListener('contextmenu', onContextMenu);
    return () => el.removeEventListener('contextmenu', onContextMenu);
  }, [ready, fabricRef]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) setContextMenu(null);
    }
    if (contextMenu) window.addEventListener('mousedown', onClickOutside);
    return () => window.removeEventListener('mousedown', onClickOutside);
  }, [contextMenu]);

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* Top bar */}
      <div style={{ height:44, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', borderBottom:'1px solid var(--ec-border)', background:'var(--ec-surface)', flexShrink:0, gap:12 }}>
        <span style={{ fontSize:12, color:'var(--ec-text-2)' }}>{eventTitle ?? 'Canvas Editor'}</span>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {savedMsg && <span style={{ fontSize:11, color:'var(--ec-success)' }}>{savedMsg}</span>}
          {!savedMsg && saving && <span style={{ fontSize:11, color:'var(--ec-text-3)' }}>Saving...</span>}
          <EcButton size="sm" variant="ghost" onClick={exportPNG} loading={exporting}>PNG</EcButton>
          <EcButton size="sm" variant="ghost" onClick={exportPDF} loading={exporting}>PDF</EcButton>
          <EcButton size="sm" variant="secondary" onClick={handleSave} loading={saving}>Save</EcButton>
        </div>
      </div>

      {/* Main workspace */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>
        <CanvasToolbar
          fabricRef={fabricRef}
          activeTool={activeTool}
          onToolChange={setActiveTool}
          eventId={eventId}
          eventTitle={eventTitle}
          eventDate={eventDate}
          eventLocation={eventLocation}
          micrositeSlug={micrositeSlug}
          organizerName={organizerName}
          organizerPhone={organizerPhone}
          organizerEmail={organizerEmail}
          onToggleImages={() => togglePanel('images')}
          showImages={showImages}
          onToggleTemplates={() => togglePanel('templates')}
          showTemplates={showTemplates}
          onDeleteSelected={deleteSelected}
        />

        {showImages && (
          <ImagePanel
            fabricRef={fabricRef}
            eventId={eventId}
            onClose={() => setShowImages(false)}
          />
        )}

        {showTemplates && (
          <TemplatesPanel
            fabricRef={fabricRef}
            eventTitle={eventTitle}
            eventDate={eventDate}
            eventLocation={eventLocation}
            onClose={() => setShowTemplates(false)}
            onSave={handleSave}
          />
        )}

        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--ec-bg)', backgroundImage:'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize:'20px 20px', overflow:'auto', padding:40 }}>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', inset:0, boxShadow:'0 8px 48px rgba(0,0,0,0.5)', borderRadius:2, pointerEvents:'none' }} />
            <canvas id={canvasId} />
            {!ready && (
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#ffffff' }}>
                <div className="ec-spinner" />
              </div>
            )}
          </div>
        </div>

        <CanvasProperties fabricRef={fabricRef} ready={ready} />
      </div>

      <AiDesignBar
        ref={aiBarRef}
        fabricRef={fabricRef}
        eventTitle={eventTitle}
        eventDate={eventDate}
        eventLocation={eventLocation}
        onSave={handleSave}
        hasDesign={hasDesign}
      />

      {contextMenu && (
        <div ref={contextRef} style={{ position:'fixed', left:contextMenu.x, top:contextMenu.y, background:'var(--ec-surface)', border:'1px solid var(--ec-border)', borderRadius:'var(--ec-radius-md)', boxShadow:'var(--ec-shadow-lg)', zIndex:1000, minWidth:140, padding:4 }}>
          {[
            { label:'Delete',        action:deleteSelected, danger:true },
            { label:'Bring forward', action:()=>{ const c=fabricRef.current; const o=c?.getActiveObject(); if(o){c!.bringObjectForward(o);c!.renderAll();} setContextMenu(null); } },
            { label:'Send backward', action:()=>{ const c=fabricRef.current; const o=c?.getActiveObject(); if(o){c!.sendObjectBackwards(o);c!.renderAll();} setContextMenu(null); } },
            { label:'Duplicate',     action:()=>{ const c=fabricRef.current; const o=c?.getActiveObject(); if(o){ o.clone().then((cl:any)=>{ cl.set({left:(o.left??0)+10,top:(o.top??0)+10}); c!.add(cl); c!.setActiveObject(cl); c!.renderAll(); }); } setContextMenu(null); } },
          ].map(item => (
            <button key={item.label} onClick={item.action} style={{ width:'100%', padding:'8px 12px', background:'none', border:'none', borderRadius:'var(--ec-radius-sm)', color:(item as any).danger?'var(--ec-danger)':'var(--ec-text-1)', fontSize:13, cursor:'pointer', textAlign:'left' }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
