import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { OffersQuery, SearchMode } from '@/api/types'

/**
 * TanStack Query hooks. Each maps to a real backend endpoint (TZ §7).
 * Caching/dedup/loading states are handled by the query client.
 */

export function useServiceSearch(q: string, mode: SearchMode = 'hybrid') {
  return useQuery({
    queryKey: ['services', 'search', q, mode],
    queryFn: () => api.searchServices(q, mode),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  })
}

export function useOffers(params: OffersQuery) {
  return useQuery({
    queryKey: ['offers', params],
    queryFn: () => api.getOffers(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    // Always enabled: with no service_id/q it browses ALL offers across clinics
    // (the "Clinics" tab landing), narrowable by city/category filters.
    enabled: true,
  })
}

export function useClinic(id: string | undefined) {
  return useQuery({
    queryKey: ['clinic', id],
    queryFn: () => api.getClinic(id!),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  })
}

export function usePriceHistory(serviceId: string | undefined, clinicId?: string) {
  return useQuery({
    queryKey: ['price-history', serviceId, clinicId],
    queryFn: () => api.getPriceHistory(serviceId!, clinicId),
    enabled: Boolean(serviceId),
    staleTime: 10 * 60_000,
  })
}

export function useClinicsMap(city?: string) {
  return useQuery({
    queryKey: ['clinics-map', city],
    queryFn: () => api.getClinicsMap(city),
    staleTime: 5 * 60_000,
  })
}
