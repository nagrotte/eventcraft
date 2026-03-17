'use client';

import { useEffect, useRef, useState } from 'react';
import type { Canvas } from 'fabric';

export function useCanvas(canvasElId: string) {
  const fabricRef = useRef<Canvas | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function init() {
      const el = document.getElementById(canvasElId) as HTMLCanvasElement | null;
      if (!el) return;

      // Fabric attaches _objects to the element after init — use this as guard
      if ((el as any)._fabricCanvas) return;

      const { Canvas: FabricCanvas } = await import('fabric');

      if (!active) return; // component unmounted while awaiting import

      const canvas = new FabricCanvas(canvasElId, {
        width:                  600,
        height:                 850,
        backgroundColor:        '#ffffff',
        selection:              true,
        preserveObjectStacking: true,
      });

      // Mark the element so we never double-init
      (el as any)._fabricCanvas = canvas;

      fabricRef.current = canvas;
      if (active) setReady(true);
    }

    init();

    return () => {
      active = false;
      if (fabricRef.current) {
        const el = document.getElementById(canvasElId) as any;
        if (el) delete el._fabricCanvas;
        fabricRef.current.dispose();
        fabricRef.current = null;
        setReady(false);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { fabricRef, ready };
}
