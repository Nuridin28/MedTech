/**
 * API contract types — mirror the FastAPI/Pydantic shapes from the TZ (§4, §7).
 * The mock client returns these exact shapes so a real backend can drop in later.
 */

export type ServiceCategory = 'laboratory' | 'doctor_visit' | 'diagnostics' | 'procedure'

export type City = 'Almaty' | 'Astana' | 'Shymkent' | 'Karaganda' | 'Aktobe' | 'Taraz'

export type SearchMode = 'lexical' | 'semantic' | 'hybrid'

export type SortOrder = 'price_asc' | 'price_desc' | 'updated_desc' | 'rating_desc' | 'distance'

/** services_catalog row (normalized service position). */
export interface Service {
  id: string
  name_norm: string
  synonyms: string[]
  category: ServiceCategory
  /** convenience field the search endpoint adds for UI rendering */
  offers_count?: number
  min_price_kzt?: number
}

/** A search suggestion returned by /api/services/search. */
export interface ServiceSuggestion {
  id: string
  name_norm: string
  category: ServiceCategory
  /** relevance score 0..1 (hybrid of trigram + semantic) */
  score: number
  offers_count: number
  min_price_kzt: number
}

/** clinics row. */
export interface Clinic {
  id: string
  name: string
  city: City
  address: string
  phone: string
  working_hours: string
  lat?: number
  lng?: number
  source_url?: string
  /** clinic price lists don't publish ratings → may be null */
  rating: number | null
  reviews_count: number
  /** primary photo (from JSON-LD/og or official Places API) — may be null */
  photo_url?: string | null
  /** social links from the clinic's structured data */
  socials?: string[]
  /** logo / accent used by the cards */
  logo_color: string
  verified: boolean
  /** clinic accepts online booking (e.g. listed on doq.kz) */
  has_online_booking?: boolean
}

/** A review from an official Places API (2GIS/Google). */
export interface ClinicReview {
  source: string
  author_alias?: string | null
  rating?: number | null
  text?: string | null
  published_at?: string | null
  url?: string | null
}

/** A single price offer (clinic × service × price) as returned by /api/offers. */
export interface Offer {
  offer_id: string
  clinic: Pick<Clinic, 'id' | 'name' | 'city' | 'address' | 'working_hours' | 'lat' | 'lng' | 'rating' | 'reviews_count' | 'logo_color' | 'verified' | 'has_online_booking'>
  service_id: string
  service_name_norm: string
  category: ServiceCategory
  price_kzt: number
  currency: 'KZT' | 'USD'
  duration_days: number | null
  source_url?: string
  parsed_at: string
  /** computed on the backend — days since parsed_at */
  freshness_days: number
  /** computed on the backend — true if this is the cheapest in the result set */
  is_lowest: boolean
}

export interface OffersResponse {
  items: Offer[]
  total: number
  page: number
  page_size: number
  /** aggregate stats the results header shows */
  price_min: number
  price_max: number
  price_avg: number
}

export interface OffersQuery {
  service_id?: string
  q?: string
  city?: City
  category?: ServiceCategory
  price_min?: number
  price_max?: number
  max_duration_days?: number
  verified_only?: boolean
  min_rating?: number
  online_booking?: boolean
  user_lat?: number
  user_lng?: number
  sort?: SortOrder
  page?: number
  page_size?: number
}

/** A point in /api/services/{id}/price-history. */
export interface PriceHistoryPoint {
  recorded_at: string
  price_kzt: number
}

export interface PriceHistoryResponse {
  service_id: string
  clinic_id: string | null
  service_name_norm: string
  points: PriceHistoryPoint[]
}

/** Clinic detail bundle for /api/clinics/{id}. */
export interface ClinicDetail extends Clinic {
  services: Array<{
    offer_id: string
    service_id: string
    service_name_norm: string
    category: ServiceCategory
    price_kzt: number
    duration_days: number | null
    freshness_days: number
  }>
  reviews?: ClinicReview[]
}

/* ---- Account-area view models (dashboard / appointments / favorites / records) ---- */

export type AppointmentStatus = 'upcoming' | 'completed' | 'cancelled'

export interface Appointment {
  id: string
  clinic_name: string
  clinic_city: City
  service_name: string
  category: ServiceCategory
  datetime: string
  price_kzt: number
  status: AppointmentStatus
  logo_color: string
}

export interface MedicalRecord {
  id: string
  title: string
  clinic_name: string
  category: ServiceCategory
  issued_at: string
  doctor: string
  status: 'ready' | 'pending'
  file_size: string
}

export interface DashboardStats {
  total_saved_kzt: number
  searches_count: number
  upcoming_appointments: number
  tracked_services: number
}

/* ---- Basket / check-up ---- */
export interface BasketLine {
  service_id: string
  service_name_norm: string
  price_kzt: number
  offer_id: string
}

export interface BasketOption {
  clinic: Offer['clinic']
  covered: number
  total_requested: number
  total_price: number
  lines: BasketLine[]
  missing: string[]
}

export interface BasketResponse {
  requested: number
  options: BasketOption[]
  best_single_total: number | null
  best_split_total: number | null
}

/* ---- Map (TZ §3.4) ---- */
export interface ClinicPin {
  id: string
  name: string
  city: string
  address: string | null
  lat: number
  lng: number
  verified: boolean
  offers_count: number
}

export interface ClinicsMapResponse {
  items: ClinicPin[]
}

/* ---- AI assistant ---- */
export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  reply: string
  /** 'answered' | 'refused_offtopic' | 'blocked_input' | 'blocked_output' */
  decision: string
}

/* ---- Admin (TZ §7.2) ---- */
export interface ParseLog {
  id: string
  source_key: string
  status: 'success' | 'partial' | 'failed'
  records_count: number
  error_message: string | null
  started_at: string | null
  finished_at: string
}

export interface UnmatchedItem {
  id: string
  service_name_raw: string
  source_key: string
  suggested_id: string | null
  match_score: number | null
  status: string
  created_at: string
}

export interface ParseRunResponse {
  queued: string[]
  task_ids: string[]
}

export interface ImportResponse {
  ok: boolean
  source_key: string
  task_id: string
  filename: string
}

/* ---- Admin dashboard ---- */
export interface SourceHealth {
  source_key: string
  registered: boolean
  last_status: 'success' | 'partial' | 'failed' | null
  last_records: number | null
  last_finished_at: string | null
  stale: boolean
}

export interface AdminStats {
  clinics: number
  catalog_services: number
  active_offers: number
  normalized_offers: number
  unmatched_pending: number
  open_alerts: number
  cities: number
  sources: SourceHealth[]
  offers_by_category: Record<string, number>
  offers_by_city: Record<string, number>
  avg_price_by_category: Record<string, number>
}

/* ---- AI catalog suggestions ---- */
export interface CatalogSuggestion {
  id: string
  proposed_name_norm: string
  category: string
  synonyms: string[]
  sample_count: number
  status: string
  created_at: string
}

/* ---- Operational alerts ---- */
export interface Alert {
  id: string
  source_key: string
  severity: 'error' | 'warning' | 'info'
  kind: string
  message: string
  acknowledged: boolean
  created_at: string
}

/* ---- ELK logs ---- */
export interface LogEntry {
  '@timestamp'?: string | null
  level?: string | null
  logger?: string | null
  message?: string | null
  source_key?: string | null
  exception?: string | null
}

export interface LogsResponse {
  available: boolean
  items: LogEntry[]
  kibana_url?: string | null
}

export interface LogsQuery {
  level?: string
  source?: string
  q?: string
  since_minutes?: number
  limit?: number
}
