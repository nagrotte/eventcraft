'use client';

import { useState } from 'react';
import { useCanvas } from '@/hooks/useCanvas';
import { CanvasToolbar }   from '@/components/canvas/CanvasToolbar';
import { CanvasProperties } from '@/components/canvas/CanvasProperties';

interface CanvasShellProps {
  eventId: string;
}

export function CanvasShell({ eventId }: CanvasShellProps) {
  const canvasId = `canvas-${eventId}`;
  const { fabricRef, ready } = useCanvas(canvasId);
  const [activeTool, setActiveTool] = useState('select');

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      overflow: 'hidden',
      background: 'var(--ec-bg)',
    }}>

      <CanvasToolbar
        fabricRef={fabricRef}
        activeTool={activeTool}
        onToolChange={setActiveTool}
      />

      {/* Canvas area */}
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
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#ffffff',
            }}>
              <div className="ec-spinner" />
            </div>
          )}
        </div>
      </div>

      <CanvasProperties fabricRef={fabricRef} ready={ready} />

    </div>
  );
}
