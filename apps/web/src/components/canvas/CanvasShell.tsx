'use client';

import { useState } from 'react';
import { useCanvas }        from '@/hooks/useCanvas';
import { useDesign }        from '@/hooks/useDesign';
import { CanvasToolbar }    from '@/components/canvas/CanvasToolbar';
import { CanvasProperties } from '@/components/canvas/CanvasProperties';
import { AiDesignBar }      from '@/components/canvas/AiDesignBar';
import { EcButton }         from '@/components/ui/EcButton';

interface CanvasShellProps {
  eventId:    string;
  eventTitle?: string;
}

export function CanvasShell({ eventId, eventTitle }: CanvasShellProps) {
  const canvasId             = `canvas-${eventId}`;
  const { fabricRef, ready } = useCanvas(canvasId);
  const { save, saving }     = useDesign(eventId, fabricRef, ready);
  const [activeTool, setActiveTool] = useState('select');
  const [savedMsg,   setSavedMsg]   = useState('');

  async function handleSave() {
    await save();
    setSavedMsg('Saved');
    setTimeout(() => setSavedMsg(''), 2000);
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid var(--ec-border)',
        background: 'var(--ec-surface)',
        flexShrink: 0,
        gap: 12,
      }}>
        <span style={{ fontSize: 12, color: 'var(--ec-text-2)' }}>Canvas Editor</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {savedMsg && (
            <span style={{ fontSize: 11, color: 'var(--ec-success)' }}>{savedMsg}</span>
          )}
          {!savedMsg && saving && (
            <span style={{ fontSize: 11, color: 'var(--ec-text-3)' }}>Saving...</span>
          )}
          <EcButton size="sm" variant="secondary" onClick={handleSave} loading={saving}>
            Save
          </EcButton>
        </div>
      </div>

      {/* Main workspace */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        <CanvasToolbar
          fabricRef={fabricRef}
          activeTool={activeTool}
          onToolChange={setActiveTool}
        />

        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--ec-bg)',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          overflow: 'auto',
          padding: 40,
        }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              boxShadow: '0 8px 48px rgba(0,0,0,0.5)',
              borderRadius: 2,
              pointerEvents: 'none',
            }} />
            <canvas id={canvasId} />
            {!ready && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#ffffff',
              }}>
                <div className="ec-spinner" />
              </div>
            )}
          </div>
        </div>

        <CanvasProperties fabricRef={fabricRef} ready={ready} />
      </div>

      {/* AI bar at bottom */}
      <AiDesignBar fabricRef={fabricRef} eventTitle={eventTitle} />

    </div>
  );
}
