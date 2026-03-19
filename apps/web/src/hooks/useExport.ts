'use client';

import { useCallback, useState } from 'react';
import type { Canvas } from 'fabric';

export function useExport(fabricRef: React.MutableRefObject<Canvas | null>) {
  const [exporting, setExporting] = useState(false);

  const exportPNG = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setExporting(true);
    try {
      // Deselect all objects so selection handles don't appear in export
      canvas.discardActiveObject();
      canvas.renderAll();

      const dataUrl = canvas.toDataURL({
        format:     'png',
        quality:    1,
        multiplier: 2, // 2x for high resolution (1200x1700)
      });

      const link = document.createElement('a');
      link.download = 'invitation.png';
      link.href = dataUrl;
      link.click();
    } finally {
      setExporting(false);
    }
  }, [fabricRef]);

  const exportPDF = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setExporting(true);
    try {
      canvas.discardActiveObject();
      canvas.renderAll();

      // Dynamically import jsPDF
      const { jsPDF } = await import('jspdf');

      const dataUrl = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 });

      // A5 size in mm (148 x 210) — good for invitation cards
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit:        'mm',
        format:      'a5',
      });

      const pdfWidth  = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('invitation.pdf');
    } finally {
      setExporting(false);
    }
  }, [fabricRef]);

  return { exportPNG, exportPDF, exporting };
}
