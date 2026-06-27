import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '@/components/ui/Icon'
import { Badge, Button, EmptyState, FreshnessTag, Rating, Skeleton } from '@/components/ui'
import { MapView, type MapPin } from '@/components/MapView'
import { cn, formatPrice, twoGisRouteUrl } from '@/lib/utils'
import { useOffers } from '@/hooks/queries'
import { useI18n } from '@/lib/i18n'
import { activityStore } from '@/lib/store'
import type { City, Offer, OffersQuery, ServiceCategory, SortOrder } from '@/api/types'

const CITIES: City[] = ['Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktobe', 'Taraz']

const CATEGORIES: { value: ServiceCategory; label: string }[] = [
  { value: 'laboratory', label: 'Анализы' },
  { value: 'doctor_visit', label: 'Приём врача' },
  { value: 'diagnostics', label: 'Диагностика' },
  { value: 'procedure', label: 'Процедуры' },
]

const SORTS: { value: SortOrder; label: string }[] = [
  { value: 'price_asc', label: 'Cheapest first' },
  { value: 'rating_desc', label: 'Best rating' },
  { value: 'distance', label: 'Nearest' },
  { value: 'price_desc', label: 'Most expensive' },
  { value: 'updated_desc', label: 'Recently updated' },
]

const RATINGS: { value: string; label: string }[] = [
  { value: '4.5', label: '4.5+' },
  { value: '4', label: '4.0+' },
  { value: '3.5', label: '3.5+' },
]

type ViewMode = 'list' | 'map' | 'compare'

const PAGE_SIZE = 20

/** Parse a query param into a finite number, falling back to undefined. */
function numParam(value: string | null): number | undefined {
  if (value == null || value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export function SearchResultsPage() {
  const { t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [showFilters, setShowFilters] = useState(false)
  const [view, setView] = useState<ViewMode>('list')
  const [selected, setSelected] = useState<Record<string, Offer>>({})
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)

  const q = searchParams.get('q') ?? undefined
  const serviceId = searchParams.get('service_id') ?? undefined
  const city = (searchParams.get('city') as City | null) ?? undefined
  const category = (searchParams.get('category') as ServiceCategory | null) ?? undefined
  const sort = (searchParams.get('sort') as SortOrder | null) ?? 'price_asc'
  const priceMin = numParam(searchParams.get('price_min'))
  const priceMax = numParam(searchParams.get('price_max'))
  const maxDuration = numParam(searchParams.get('max_duration_days'))
  const verifiedOnly = searchParams.get('verified_only') === '1'
  const minRating = numParam(searchParams.get('min_rating'))
  const onlineBooking = searchParams.get('online_booking') === '1'
  const page = numParam(searchParams.get('page')) ?? 1

  // "Nearest" sort needs the user's location — ask the browser when selected.
  useEffect(() => {
    if (sort !== 'distance' || userLoc) return
    if (!('geolocation' in navigator)) {
      setGeoError('Геолокация недоступна в этом браузере')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoError(null)
      },
      () => setGeoError('Доступ к геолокации отклонён — сортировка по расстоянию недоступна'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }, [sort, userLoc])

  const useDistance = sort === 'distance' && userLoc != null

  const query: OffersQuery = {
    q,
    service_id: serviceId,
    city,
    category,
    sort,
    price_min: priceMin,
    price_max: priceMax,
    max_duration_days: maxDuration,
    verified_only: verifiedOnly || undefined,
    min_rating: minRating,
    online_booking: onlineBooking || undefined,
    user_lat: useDistance ? userLoc!.lat : undefined,
    user_lng: useDistance ? userLoc!.lng : undefined,
    page,
    page_size: PAGE_SIZE,
  }

  const { data, isLoading, isError } = useOffers(query)

  function toggleCompare(o: Offer) {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[o.offer_id]) delete next[o.offer_id]
      else next[o.offer_id] = o
      return next
    })
  }
  const selectedList = Object.values(selected)

  /** Merge a patch into the URL search params (clearing empty values). */
  function patchParams(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === '') next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next)
  }

  function handleBook(o: Offer) {
    const datetime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    activityStore.addBooking({
      clinic_id: o.clinic.id,
      clinic_name: o.clinic.name,
      clinic_city: o.clinic.city,
      service_id: o.service_id,
      service_name: o.service_name_norm,
      category: o.category,
      price_kzt: o.price_kzt,
      datetime,
    })
    navigate('/appointments')
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const serviceName = items[0]?.service_name_norm ?? q ?? t('Medical service')
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const mapPins: MapPin[] = useMemo(
    () =>
      items
        .filter((o) => o.clinic.lat != null && o.clinic.lng != null)
        .map((o) => ({
          id: o.offer_id,
          name: o.clinic.name,
          lat: o.clinic.lat as number,
          lng: o.clinic.lng as number,
          badge: formatPrice(o.price_kzt).replace(/\s?₸/, ''),
          color: o.is_lowest ? '#16794d' : o.clinic.logo_color,
          popupHtml:
            `<strong>${o.clinic.name}</strong><br/>${formatPrice(o.price_kzt, o.currency)}<br/>` +
            `<a href="/clinic/${o.clinic.id}">профиль →</a>`,
        })),
    [items],
  )

  return (
    <main className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop py-6 lg:py-8">
      {/* Breadcrumbs */}
      <nav className="hidden lg:flex items-center gap-2 mb-6 text-text-subtle font-body-sm">
        <Link className="hover:text-primary" to="/">
          {t('Home')}
        </Link>
        <Icon name="chevron_right" className="text-[16px]" />
        <Link className="hover:text-primary" to="/search">
          {t('Search')}
        </Link>
        <Icon name="chevron_right" className="text-[16px]" />
        <span className="text-on-surface font-label-bold">{serviceName}</span>
      </nav>

      {/* Results header */}
      <header className="mb-6 lg:mb-10">
        <div className="flex items-center gap-2 text-on-surface-variant mb-1">
          <Icon name="location_on" className="text-[18px]" />
          <span className="font-label-bold">{city ?? t('All cities')}</span>
        </div>
        <h1 className="font-headline-lg-mobile lg:font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-main dark:text-on-surface mb-2">
          {serviceName}
        </h1>
        <p className="text-text-subtle font-body-md">
          {isLoading ? t('Searching…') : t('{n} offers found', { n: total })}
        </p>

        {/* Price summary bar */}
        {data && total > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3 bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-4 max-w-xl">
            <div>
              <p className="text-text-subtle font-body-sm mb-0.5">{t('Lowest')}</p>
              <p className="font-price-display text-success-green">{formatPrice(data.price_min)}</p>
            </div>
            <div>
              <p className="text-text-subtle font-body-sm mb-0.5">{t('Average')}</p>
              <p className="font-price-display text-on-surface">{formatPrice(data.price_avg)}</p>
            </div>
            <div>
              <p className="text-text-subtle font-body-sm mb-0.5">{t('Highest')}</p>
              <p className="font-price-display text-on-surface">{formatPrice(data.price_max)}</p>
            </div>
          </div>
        )}
      </header>

      {/* Mobile filters toggle */}
      <div className="lg:hidden mb-4">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 bg-primary-container text-on-primary-container px-4 py-2 rounded-full font-label-bold active:scale-95 transition-all"
        >
          <Icon name="tune" className="text-[18px]" />
          {t('Filters')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Sidebar filters */}
        <aside
          className={cn(
            'lg:col-span-3 space-y-6 lg:block',
            showFilters ? 'block' : 'hidden',
          )}
        >
          <div className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant p-6 rounded-xl filter-transition">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-label-bold text-on-surface">{t('Filters')}</h3>
              <button
                type="button"
                onClick={() =>
                  patchParams({
                    city: undefined,
                    category: undefined,
                    price_min: undefined,
                    price_max: undefined,
                    max_duration_days: undefined,
                    verified_only: undefined,
                    min_rating: undefined,
                    online_booking: undefined,
                    page: undefined,
                  })
                }
                className="text-primary font-label-bold text-[12px] uppercase tracking-wider hover:underline"
              >
                {t('Reset')}
              </button>
            </div>

            {/* City */}
            <div className="mb-8">
              <label htmlFor="filter-city" className="block font-label-bold mb-4">
                {t('City')}
              </label>
              <select
                id="filter-city"
                value={city ?? ''}
                onChange={(e) => patchParams({ city: e.target.value || undefined, page: undefined })}
                className="w-full border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest dark:bg-surface-dim text-on-surface focus:ring-secondary focus:border-secondary"
              >
                <option value="">{t('All cities')}</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="mb-8">
              <label htmlFor="filter-category" className="block font-label-bold mb-4">
                Категория
              </label>
              <select
                id="filter-category"
                value={category ?? ''}
                onChange={(e) => patchParams({ category: e.target.value || undefined, page: undefined })}
                className="w-full border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest dark:bg-surface-dim text-on-surface focus:ring-secondary focus:border-secondary"
              >
                <option value="">Все категории</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Price range */}
            <div className="mb-8">
              <label className="block font-label-bold mb-4">{t('Price Range (₸)')}</label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  aria-label={t('Minimum price')}
                  placeholder={t('From')}
                  defaultValue={priceMin ?? ''}
                  onBlur={(e) => patchParams({ price_min: e.target.value || undefined, page: undefined })}
                  className="w-full border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest dark:bg-surface-dim text-on-surface focus:ring-secondary focus:border-secondary"
                />
                <span className="text-outline-variant">—</span>
                <input
                  type="number"
                  aria-label={t('Maximum price')}
                  placeholder={t('To')}
                  defaultValue={priceMax ?? ''}
                  onBlur={(e) => patchParams({ price_max: e.target.value || undefined, page: undefined })}
                  className="w-full border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest dark:bg-surface-dim text-on-surface focus:ring-secondary focus:border-secondary"
                />
              </div>
            </div>

            {/* Result turnaround (real lab duration data) */}
            <div className="mb-8">
              <label htmlFor="filter-duration" className="block font-label-bold mb-4">
                Срок выполнения
              </label>
              <select
                id="filter-duration"
                value={maxDuration != null ? String(maxDuration) : ''}
                onChange={(e) => patchParams({ max_duration_days: e.target.value || undefined, page: undefined })}
                className="w-full border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest dark:bg-surface-dim text-on-surface focus:ring-secondary focus:border-secondary"
              >
                <option value="">Любой</option>
                <option value="1">За 1 день</option>
                <option value="3">До 3 дней</option>
                <option value="7">До 7 дней</option>
              </select>
            </div>

            {/* Rating */}
            <div className="mb-8">
              <label htmlFor="filter-rating" className="block font-label-bold mb-4">
                Рейтинг клиники
              </label>
              <select
                id="filter-rating"
                value={minRating != null ? String(minRating) : ''}
                onChange={(e) => patchParams({ min_rating: e.target.value || undefined, page: undefined })}
                className="w-full border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest dark:bg-surface-dim text-on-surface focus:ring-secondary focus:border-secondary"
              >
                <option value="">Любой</option>
                {RATINGS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label} ★
                  </option>
                ))}
              </select>
            </div>

            {/* Verified only + online booking */}
            <div className="mb-8 space-y-3">
              <label className="flex items-center gap-2 font-label-bold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => patchParams({ verified_only: e.target.checked ? '1' : undefined, page: undefined })}
                  className="rounded border-outline-variant text-primary focus:ring-secondary"
                />
                Только проверенные клиники
              </label>
              <label className="flex items-center gap-2 font-label-bold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlineBooking}
                  onChange={(e) => patchParams({ online_booking: e.target.checked ? '1' : undefined, page: undefined })}
                  className="rounded border-outline-variant text-primary focus:ring-secondary"
                />
                Только с онлайн-записью
              </label>
            </div>

            {/* Sort */}
            <div>
              <label htmlFor="filter-sort" className="block font-label-bold mb-4">
                {t('Sort by')}
              </label>
              <select
                id="filter-sort"
                value={sort}
                onChange={(e) => patchParams({ sort: e.target.value, page: undefined })}
                className="w-full border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest dark:bg-surface-dim text-on-surface focus:ring-secondary focus:border-secondary"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(s.label)}
                  </option>
                ))}
              </select>
              {sort === 'distance' && !userLoc && (
                <p className="mt-2 text-[12px] text-text-subtle flex items-center gap-1">
                  <Icon name="my_location" className="text-[14px]" />
                  {geoError ?? 'Определяем ваше местоположение…'}
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* Results area */}
        <div className="lg:col-span-9">
          {/* View toggle: list / map / compare (TZ §3.3–3.4) */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="inline-flex rounded-full border border-outline-variant overflow-hidden">
              {(['list', 'map', 'compare'] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setView(m)}
                  className={cn(
                    'px-4 py-1.5 font-label-bold text-[13px] flex items-center gap-1 transition-colors',
                    view === m
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:bg-surface-container',
                  )}
                >
                  <Icon
                    name={m === 'list' ? 'view_list' : m === 'map' ? 'map' : 'compare_arrows'}
                    className="text-[16px]"
                  />
                  {m === 'list'
                    ? 'Список'
                    : m === 'map'
                      ? 'Карта'
                      : `Сравнить${selectedList.length ? ` (${selectedList.length})` : ''}`}
                </button>
              ))}
            </div>
            {view !== 'compare' && (
              <span className="text-text-subtle font-body-sm hidden sm:block">
                Отметьте клиники галочкой, чтобы сравнить
              </span>
            )}
          </div>

          {/* Sort chips (desktop) */}
          {view !== 'compare' && (
          <div className="hidden lg:flex bg-surface-container-lowest dark:bg-surface-container border border-outline-variant p-4 rounded-xl mb-6 flex-wrap items-center gap-4">
            <span className="font-label-bold text-text-subtle">{t('Sort by:')}</span>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => patchParams({ sort: s.value, page: undefined })}
                  className={cn(
                    'px-4 py-1.5 rounded-full font-label-bold text-[14px] transition-colors',
                    sort === s.value
                      ? 'bg-primary-fixed text-on-primary-fixed'
                      : 'hover:bg-surface-container',
                  )}
                >
                  {t(s.label)}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl" />
              ))}
            </div>
          )}

          {/* Error */}
          {!isLoading && isError && (
            <EmptyState
              icon="error"
              title={t("Couldn't load offers")}
              description={t('Something went wrong while fetching prices. Please try again in a moment.')}
              action={
                <Button variant="primary" onClick={() => patchParams({ page: undefined })}>
                  {t('Retry')}
                </Button>
              }
            />
          )}

          {/* Empty */}
          {view !== 'compare' && !isLoading && !isError && items.length === 0 && (
            <EmptyState
              icon="search_off"
              title={t('No offers found')}
              description={t('Try adjusting your filters or searching for a different service.')}
              action={
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-lg font-label-bold"
                >
                  <Icon name="search" /> {t('New search')}
                </Link>
              }
            />
          )}

          {/* Results list */}
          {view === 'list' && !isLoading && !isError && items.length > 0 && (
            <div className="space-y-4">
              {items.map((o, i) => (
                <motion.article
                  key={o.offer_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                  className={cn(
                    'bg-surface-container-lowest dark:bg-surface-container p-6 rounded-xl relative group hover:shadow-lg transition-all duration-300',
                    o.is_lowest
                      ? 'border-2 border-secondary-container'
                      : 'border border-outline-variant',
                  )}
                >
                  {o.is_lowest && (
                    <div className="absolute -top-3 left-6">
                      <Badge tone="success">
                        <Icon name="trending_down" className="text-[14px]" />
                        {t('Best price')}
                      </Badge>
                    </div>
                  )}

                  {/* Compare toggle (TZ §3.4) */}
                  <button
                    type="button"
                    onClick={() => toggleCompare(o)}
                    aria-pressed={Boolean(selected[o.offer_id])}
                    className={cn(
                      'absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-label-bold border transition-colors z-10',
                      selected[o.offer_id]
                        ? 'bg-primary text-on-primary border-primary'
                        : 'border-outline-variant text-on-surface-variant hover:bg-surface-container',
                    )}
                  >
                    <Icon
                      name={selected[o.offer_id] ? 'check_box' : 'check_box_outline_blank'}
                      className="text-[16px]"
                    />
                    Сравнить
                  </button>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex gap-6 items-start">
                      <div
                        className="w-16 h-16 lg:w-20 lg:h-20 rounded-xl flex-shrink-0 flex items-center justify-center text-on-primary font-bold text-headline-md"
                        style={{ backgroundColor: o.clinic.logo_color }}
                        aria-hidden
                      >
                        {o.clinic.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            to={`/clinic/${o.clinic.id}`}
                            className="font-headline-md text-headline-md text-text-main dark:text-on-surface group-hover:text-primary transition-colors"
                          >
                            {o.clinic.name}
                          </Link>
                          {o.clinic.verified && (
                            <Icon name="verified" className="text-[18px] text-primary" filled />
                          )}
                          {o.clinic.has_online_booking && (
                            <Badge tone="primary" className="text-[11px]">
                              <Icon name="event_available" className="text-[13px]" />
                              Онлайн-запись
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mb-3 flex-wrap">
                          <Rating value={o.clinic.rating} count={o.clinic.reviews_count} />
                        </div>
                        <div className="flex items-center gap-2 text-on-surface-variant font-body-sm mb-1">
                          <Icon name="location_on" className="text-[18px]" />
                          <span>
                            {o.clinic.address}, {o.clinic.city}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-on-surface-variant font-body-sm">
                          <Icon name="schedule" className="text-[18px]" />
                          <span>{o.clinic.working_hours}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-3 flex-wrap">
                          <Link
                            to={`/service/${o.service_id}`}
                            className="font-label-bold text-[13px] text-primary hover:underline"
                          >
                            {o.service_name_norm}
                          </Link>
                          {o.source_url && (
                            <a
                              href={o.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-text-subtle font-label-bold text-[13px] hover:text-primary"
                            >
                              <Icon name="open_in_new" className="text-[14px]" />
                              {t('Source')}
                            </a>
                          )}
                          <a
                            href={twoGisRouteUrl({
                              name: o.clinic.name,
                              city: o.clinic.city,
                              lat: o.clinic.lat,
                              lng: o.clinic.lng,
                            })}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-text-subtle font-label-bold text-[13px] hover:text-primary"
                          >
                            <Icon name="directions" className="text-[14px]" />
                            2GIS
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-stretch md:items-end gap-3 md:min-w-[180px]">
                      <div className="text-left md:text-right">
                        <div
                          className={cn(
                            'font-price-display text-headline-lg',
                            o.is_lowest ? 'text-primary' : 'text-on-surface',
                          )}
                        >
                          {formatPrice(o.price_kzt, o.currency)}
                        </div>
                        <div className="md:flex md:justify-end mt-1">
                          <FreshnessTag freshnessDays={o.freshness_days} />
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        className="w-full justify-center"
                        onClick={() => handleBook(o)}
                      >
                        {t('Book')}
                      </Button>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          )}

          {/* Map view (TZ §3.4) */}
          {view === 'map' && !isLoading && !isError && items.length > 0 && (
            <div className="space-y-3">
              {mapPins.length === 0 ? (
                <EmptyState
                  icon="location_off"
                  title="У этих клиник пока нет координат"
                  description="Запустите геокодирование в админ-панели, чтобы клиники появились на карте."
                />
              ) : (
                <div className="border border-outline-variant rounded-xl overflow-hidden">
                  <MapView pins={mapPins} height={560} />
                </div>
              )}
              <p className="text-text-subtle font-body-sm flex items-center gap-2">
                <Icon name="info" className="text-[16px]" />
                Зелёный маркер — самая низкая цена; число в маркере — цена в ₸.
              </p>
            </div>
          )}

          {/* Compare table (TZ §3.4) */}
          {view === 'compare' && (
            selectedList.length === 0 ? (
              <EmptyState
                icon="compare_arrows"
                title="Нечего сравнивать"
                description="Вернитесь к списку и отметьте несколько клиник галочкой «Сравнить»."
                action={
                  <Button variant="primary" onClick={() => setView('list')}>
                    К списку
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto border border-outline-variant rounded-xl">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-surface-container">
                      <th className="p-3 font-label-bold text-text-subtle">Клиника</th>
                      <th className="p-3 font-label-bold text-text-subtle">Город</th>
                      <th className="p-3 font-label-bold text-text-subtle">Цена</th>
                      <th className="p-3 font-label-bold text-text-subtle">Срок</th>
                      <th className="p-3 font-label-bold text-text-subtle">Обновлено</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...selectedList]
                      .sort((a, b) => a.price_kzt - b.price_kzt)
                      .map((o, idx) => (
                        <tr key={o.offer_id} className="border-t border-outline-variant">
                          <td className="p-3">
                            <Link to={`/clinic/${o.clinic.id}`} className="font-label-bold text-primary hover:underline">
                              {o.clinic.name}
                            </Link>
                          </td>
                          <td className="p-3 text-on-surface-variant">{o.clinic.city}</td>
                          <td className="p-3">
                            <span
                              className={cn(
                                'font-price-display',
                                idx === 0 ? 'text-success-green' : 'text-on-surface',
                              )}
                            >
                              {formatPrice(o.price_kzt, o.currency)}
                            </span>
                            {idx === 0 && (
                              <Badge tone="success" className="ml-2">
                                дешевле всего
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-on-surface-variant">
                            {o.duration_days != null ? `${o.duration_days} дн.` : '—'}
                          </td>
                          <td className="p-3">
                            <FreshnessTag freshnessDays={o.freshness_days} />
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => toggleCompare(o)}
                              className="text-error font-label-bold text-[13px] hover:underline"
                            >
                              Убрать
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Pagination */}
          {view === 'list' && !isLoading && !isError && total > PAGE_SIZE && (
            <div className="mt-12 flex justify-center items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => patchParams({ page: String(page - 1) })}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={t('Previous page')}
              >
                <Icon name="chevron_left" />
              </button>
              <span className="px-4 font-label-bold text-on-surface">
                {t('Page')} {page} {t('of')} {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => patchParams({ page: String(page + 1) })}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={t('Next page')}
              >
                <Icon name="chevron_right" />
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
