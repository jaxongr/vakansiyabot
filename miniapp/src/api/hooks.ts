import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { Category, Me, Page, Region, VacancyDetail, VacancyListItem } from './types';

export interface VacancyFilters {
  regionId?: string;
  categoryId?: string;
  employmentType?: string;
  salaryMin?: number;
  q?: string;
}

export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    queryFn: async () => (await api.get<{ data: Region[] }>('/regions')).data.data,
    staleTime: Infinity,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get<{ data: Category[] }>('/categories')).data.data,
    staleTime: Infinity,
  });
}

export function useVacancies(filters: VacancyFilters) {
  return useInfiniteQuery({
    queryKey: ['vacancies', filters],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set('cursor', pageParam as string);
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== '') params.set(k, String(v));
      });
      params.set('limit', '20');
      return (await api.get<Page<VacancyListItem>>(`/vacancies?${params}`)).data;
    },
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
}

export function useVacancy(id: string) {
  return useQuery({
    queryKey: ['vacancy', id],
    queryFn: async () => (await api.get<{ data: VacancyDetail }>(`/vacancies/${id}`)).data.data,
    enabled: Boolean(id),
  });
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<{ data: Me }>('/me')).data.data,
    retry: false,
  });
}

export function useSetRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (regionId: string) => (await api.patch('/me', { regionId })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useSaved() {
  return useQuery({
    queryKey: ['saved'],
    queryFn: async () => (await api.get<{ data: VacancyListItem[] }>('/me/saved')).data.data,
  });
}

export function useToggleSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, saved }: { id: string; saved: boolean }) => {
      if (saved) await api.delete(`/me/saved/${id}`);
      else await api.post(`/me/saved/${id}`);
      return !saved;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  });
}
