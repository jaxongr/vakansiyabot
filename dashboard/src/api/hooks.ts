import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export interface Overview {
  daily: { day: string; count: number }[];
  byRegion: { regionId: string; name: string; count: number }[];
  byCategory: { categoryId: string; name: string; count: number }[];
  totals: { vacancies: number; resumes: number; rawSources: number; duplicatePercent: number };
  components: Record<string, { status: string; message?: string }>;
}

export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: async () => (await api.get<{ data: Overview }>('/stats/overview')).data.data,
    refetchInterval: 30_000,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get('/system/health')).data.data,
    refetchInterval: 15_000,
  });
}

export function useChannels(cursor?: string) {
  return useQuery({
    queryKey: ['channels', cursor],
    queryFn: async () =>
      (await api.get(`/channels?limit=50${cursor ? `&cursor=${cursor}` : ''}`)).data,
  });
}

export function useChannelMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['channels'] });
  return {
    add: useMutation({
      mutationFn: async (username: string) => (await api.post('/channels', { username })).data,
      onSuccess: invalidate,
    }),
    setStatus: useMutation({
      mutationFn: async ({ id, status }: { id: string; status: string }) =>
        (await api.patch(`/channels/${id}`, { status })).data,
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => (await api.delete(`/channels/${id}`)).data,
      onSuccess: invalidate,
    }),
  };
}

export function useWebSources() {
  return useQuery({
    queryKey: ['web-sources'],
    queryFn: async () => (await api.get('/web-sources?limit=50')).data,
  });
}

export function useWebSourceMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['web-sources'] });
  return {
    add: useMutation({
      mutationFn: async (body: { type: string; name: string; url: string; intervalMin: number }) =>
        (await api.post('/web-sources', body)).data,
      onSuccess: invalidate,
    }),
    scrape: useMutation({
      mutationFn: async (id: string) => (await api.post(`/web-sources/${id}/scrape`)).data,
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => (await api.delete(`/web-sources/${id}`)).data,
      onSuccess: invalidate,
    }),
  };
}

export function useVacancies(params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, limit: '30' }).toString();
  return useQuery({
    queryKey: ['vacancies', params],
    queryFn: async () => (await api.get(`/vacancies?${qs}`)).data,
  });
}

export function useVacancyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      (await api.patch(`/vacancies/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vacancies'] }),
  });
}

export function useDedupReview() {
  return useQuery({
    queryKey: ['dedup'],
    queryFn: async () => (await api.get('/dedup/review?limit=50')).data,
  });
}

export function useDedupResolve() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'merge' | 'separate' }) =>
      (await api.post(`/dedup/review/${id}`, { action })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dedup'] }),
  });
}

export function useRefs() {
  const regions = useQuery({
    queryKey: ['regions'],
    queryFn: async () => (await api.get('/regions')).data.data,
    staleTime: Infinity,
  });
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/categories')).data.data,
    staleTime: Infinity,
  });
  return { regions, categories };
}
