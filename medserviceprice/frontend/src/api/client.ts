import type {
  AdminStats,
  Alert,
  CatalogSuggestion,
  ChatResponse,
  ChatTurn,
  ClinicDetail,
  ClinicsMapResponse,
  ImportResponse,
  LogsQuery,
  LogsResponse,
  OffersQuery,
  OffersResponse,
  ParseLog,
  ParseRunResponse,
  PriceHistoryResponse,
  SearchMode,
  ServiceSuggestion,
  UnmatchedItem,
} from './types'

/**
 * Real API client. Talks to the FastAPI backend over `/api/*`
 * (proxied to http://localhost:8000 in dev — see vite.config.ts — and served
 * behind Nginx in production). No mock data: every value comes from the backend,
 * which serves prices scraped from real clinic price lists (TZ §5–7).
 */

const BASE = import.meta.env.VITE_API_BASE ?? ''

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const qs = params
    ? '?' +
      new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : ''
  const res = await fetch(`${BASE}/api${path}${qs}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : detail
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new ApiError(detail, res.status)
  }
  return res.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const api = {
  /** GET /api/services/search?q=&mode= */
  searchServices(q: string, mode: SearchMode = 'hybrid'): Promise<ServiceSuggestion[]> {
    return get<ServiceSuggestion[]>('/services/search', { q, mode })
  },

  /** GET /api/offers — filtered, sorted, paginated price comparison. */
  getOffers(params: OffersQuery): Promise<OffersResponse> {
    return get<OffersResponse>('/offers', params as Record<string, string | number | undefined>)
  },

  /** GET /api/clinics/{id} — clinic profile + all its offers. */
  getClinic(id: string): Promise<ClinicDetail> {
    return get<ClinicDetail>(`/clinics/${id}`)
  },

  /** GET /api/services/{id}/price-history?clinic_id= */
  getPriceHistory(serviceId: string, clinicId?: string): Promise<PriceHistoryResponse> {
    return get<PriceHistoryResponse>(`/services/${serviceId}/price-history`, { clinic_id: clinicId })
  },

  /** GET /api/clinics-map?city= — geolocated clinics for the map (TZ §3.4). */
  getClinicsMap(city?: string): Promise<ClinicsMapResponse> {
    return get<ClinicsMapResponse>('/clinics-map', { city })
  },

  /** POST /api/subscriptions — track a service/clinic price. */
  async subscribe(email: string, serviceId: string, clinicId?: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${BASE}/api/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, service_id: serviceId, clinic_id: clinicId ?? null }),
    })
    if (!res.ok) throw new ApiError('Subscription failed', res.status)
    return res.json()
  },

  /** GET /api/assistant/status — whether the AI assistant is configured/on. */
  assistantStatus(): Promise<{ enabled: boolean }> {
    return get<{ enabled: boolean }>('/assistant/status')
  },

  /** POST /api/assistant/chat — domain-scoped chatbot (validated server-side). */
  async assistantChat(message: string, history: ChatTurn[]): Promise<ChatResponse> {
    const res = await fetch(`${BASE}/api/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    })
    if (!res.ok) {
      let detail = `Request failed (${res.status})`
      try {
        const body = await res.json()
        if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : detail
      } catch {
        /* ignore */
      }
      throw new ApiError(detail, res.status)
    }
    return res.json() as Promise<ChatResponse>
  },
}

/* ---- Admin API (TZ §7.2) — all calls carry the X-API-Key header. ---- */
async function adminFetch<T>(path: string, key: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api/admin${path}`, {
    ...init,
    headers: { 'X-API-Key': key, Accept: 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : detail
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status)
  }
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>)
}

export const adminApi = {
  stats(key: string): Promise<AdminStats> {
    return adminFetch<AdminStats>('/stats', key)
  },
  parseLogs(key: string, limit = 50): Promise<ParseLog[]> {
    return adminFetch<ParseLog[]>(`/parse/logs?limit=${limit}`, key)
  },
  runParse(key: string, sources?: string[]): Promise<ParseRunResponse> {
    return adminFetch<ParseRunResponse>('/parse/run', key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources: sources ?? null }),
    })
  },
  unmatched(key: string, status = 'pending', limit = 100): Promise<UnmatchedItem[]> {
    return adminFetch<UnmatchedItem[]>(`/unmatched?status=${status}&limit=${limit}`, key)
  },
  resolveUnmatched(key: string, id: string, serviceId: string, addSynonym = true): Promise<unknown> {
    return adminFetch(`/unmatched/${id}/resolve`, key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id: serviceId, add_as_synonym: addSynonym }),
    })
  },
  aiSuggest(key: string): Promise<{ queued: boolean; task_id: string }> {
    return adminFetch('/normalization/ai-suggest', key, { method: 'POST' })
  },
  renormalize(key: string): Promise<{ queued: boolean; task_id: string }> {
    return adminFetch('/normalization/renormalize', key, { method: 'POST' })
  },
  suggestions(key: string, status = 'pending'): Promise<CatalogSuggestion[]> {
    return adminFetch<CatalogSuggestion[]>(`/normalization/suggestions?status=${status}`, key)
  },
  applySuggestion(key: string, id: string): Promise<{ ok: boolean; offers_attached: number }> {
    return adminFetch(`/normalization/suggestions/${id}/apply`, key, { method: 'POST' })
  },
  rejectSuggestion(key: string, id: string): Promise<unknown> {
    return adminFetch(`/normalization/suggestions/${id}/reject`, key, { method: 'POST' })
  },
  runGeocode(key: string): Promise<{ queued: boolean; task_id: string }> {
    return adminFetch('/geocode/run', key, { method: 'POST' })
  },
  alerts(key: string, acknowledged = false): Promise<Alert[]> {
    return adminFetch<Alert[]>(`/alerts?acknowledged=${acknowledged}`, key)
  },
  ackAlert(key: string, id: string): Promise<unknown> {
    return adminFetch(`/alerts/${id}/ack`, key, { method: 'POST' })
  },
  ackAllAlerts(key: string): Promise<{ acknowledged_count: number }> {
    return adminFetch('/alerts/ack-all', key, { method: 'POST' })
  },
  logs(key: string, params: LogsQuery = {}): Promise<LogsResponse> {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    return adminFetch<LogsResponse>(`/logs${qs ? `?${qs}` : ''}`, key)
  },
  uploadPriceFile(
    key: string,
    form: { clinic_name: string; city: string; address?: string; source_url?: string; file: File },
  ): Promise<ImportResponse> {
    const fd = new FormData()
    fd.append('clinic_name', form.clinic_name)
    fd.append('city', form.city)
    if (form.address) fd.append('address', form.address)
    if (form.source_url) fd.append('source_url', form.source_url)
    fd.append('file', form.file)
    return adminFetch<ImportResponse>('/import/upload', key, { method: 'POST', body: fd })
  },
}
