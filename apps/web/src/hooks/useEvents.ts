import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';

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
  designJson?:      string;
  schedule?:        string;
  organizerName?:   string;
  organizerPhone?:  string;
  organizerEmail?:  string;
  galleryUrl?:      string;
  reminderSchedule?: string;
}

export interface CreateEventInput {
  title:        string;
  eventDate:    string;
  description?: string;
  location?:    string;
  capacity?:    number;
}

export function useEvents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['events', user?.sub],
    queryFn:  async () => {
      const res = await apiClient.get('/events');
      return res.data.data.items as EventEntity[];
    },
    enabled: !!user
  });
}

export function useEvent(eventId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['events', user?.sub, eventId],
    queryFn:  async () => {
      const res = await apiClient.get(`/events/${eventId}`);
      return res.data.data as EventEntity;
    },
    enabled: !!eventId && !!user
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateEventInput) => {
      const res = await apiClient.post('/events', input);
      return res.data.data as EventEntity;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events', user?.sub] })
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (eventId: string) => {
      await apiClient.delete(`/events/${eventId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events', user?.sub] })
  });
}
