import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface EventEntity {
  eventId:      string;
  userId:       string;
  title:        string;
  description?: string;
  eventDate:    string;
  endDate?:     string;
  location?:    string;
  address?:     string;
  capacity?:    number;
  status:       string;
  micrositeSlug?: string;
  tags:         string[];
  createdAt:    string;
  updatedAt:    string;
}

export interface CreateEventInput {
  title:        string;
  eventDate:    string;
  description?: string;
  location?:    string;
  capacity?:    number;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn:  async () => {
      const res = await apiClient.get('/events');
      return res.data.data.items as EventEntity[];
    }
  });
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: ['events', eventId],
    queryFn:  async () => {
      const res = await apiClient.get(`/events/${eventId}`);
      return res.data.data as EventEntity;
    },
    enabled: !!eventId
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEventInput) => {
      const res = await apiClient.post('/events', input);
      return res.data.data as EventEntity;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] })
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      await apiClient.delete(`/events/${eventId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] })
  });
}
