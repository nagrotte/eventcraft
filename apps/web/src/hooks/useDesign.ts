'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Canvas } from 'fabric';

interface DesignResponse {
  success: boolean;
  data:    { canvasJson: string | null };
}

export function useDesign(eventId: string, fabricRef: React.MutableRefObject<Canvas | null>, ready: boolean) {
  const queryClient  = useQueryClient();
  const loadedRef    = useRef(false);

  // ── Load ─────────────────────────────────────────────────────────────────
  const { data } = useQuery<DesignResponse>({
    queryKey: ['design', eventId],
    queryFn:  async () => {
      const res = await apiClient.get(`/events/${eventId}/design`);
      return res.data;
    },
    enabled: !!eventId,
    staleTime: Infinity,
    retry: 1,
  });

  // Hydrate canvas once — when both fabric is ready and data is loaded
  useEffect(() => {
    if (!ready || !fabricRef.current || loadedRef.current) return;
    const json = data?.data?.canvasJson;
    if (!json) return;

    loadedRef.current = true;
    try {
      fabricRef.current.loadFromJSON(JSON.parse(json)).then(() => {
        fabricRef.current?.renderAll();
      });
    } catch {
      console.warn('Failed to load canvas JSON');
    }
  }, [ready, data, fabricRef]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const { mutateAsync: saveDesign, isPending: saving } = useMutation({
    mutationFn: async (canvasJson: string) => {
      await apiClient.post(`/events/${eventId}/design`, { canvasJson });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['design', eventId] });
    }
  });

  const save = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const json = JSON.stringify(canvas.toJSON());
    await saveDesign(json);
  }, [fabricRef, saveDesign]);

  // ── Auto-save every 30s ───────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      save();
    }, 30_000);
    return () => clearInterval(interval);
  }, [ready, save]);

  return { save, saving };
}
