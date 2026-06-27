import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '@/components/ui/Icon'
import { Badge, Button, FreshnessTag, Rating, EmptyState, Skeleton } from '@/components/ui'
import { MapView } from '@/components/MapView'
import { cn, formatPrice, twoGisRouteUrl } from '@/lib/utils'
import { useClinic } from '@/hooks/queries'
import { activityStore, useActivity } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import type { ClinicDetail } from '@/api/types'

type ClinicService = ClinicDetail['services'][number]
type Category = ClinicService['category']

const CATEGORY_ORDER: Category[] = ['laboratory', 'diagnostics', 'doctor_visit', 'procedure']

const CATEGORY_LABELS: Record<Category, string> = {
  laboratory: 'Laboratory',
  diagnostics: 'Diagnostics',
  doctor_visit: 'Doctor visit',
  procedure: 'Procedure',
}

const CATEGORY_TONES: Record<
  Category,
  'primary' | 'secondary' | 'success' | 'warning'
> = {
  laboratory: 'secondary',
  diagnostics: 'primary',
  doctor_visit: 'success',
  procedure: 'warning',
}

function durationLabel(days: number | null): string {
  if (days == null || days <= 0) return 'Same day'
  return days === 1 ? '1 day' : `${days} days`
}

export function ClinicProfilePage() {
  const { clinicId } = useParams()
  const { t } = useI18n()
  const { data: clinic, isLoading, isError } = useClinic(clinicId)
  const activity = useActivity()
  const [filter, setFilter] = useState('')

  const fav = Boolean(clinicId && activity.favoriteClinicIds.includes(clinicId))

  const grouped = useMemo(() => {
    if (!clinic) return [] as Array<{ category: Category; items: ClinicService[] }>
    const needle = filter.trim().toLowerCase()
    const matched = needle
      ? clinic.services.filter((s) => s.service_name_norm.toLowerCase().includes(needle))
      : clinic.services
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: matched.filter((s) => s.category === category),
    })).filter((g) => g.items.length > 0)
  }, [clinic, filter])

  if (isLoading) {
    return (
      <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8">
        <Skeleton className="h-64 w-full rounded-xl mb-8" />
        <div className="flex flex-col lg:flex-row gap-gutter">
          <div className="lg:w-2/3 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="lg:w-1/3">
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        </div>
      </main>
    )
  }

  if (isError || !clinic) {
    return (
      <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8">
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant">
          <EmptyState
            icon="error"
            title={t('Clinic not found')}
            description={t("We couldn't load this clinic. It may have been removed or the link is incorrect.")}
            action={
              <Link to="/search">
                <Button variant="primary">{t('Back to search')}</Button>
              </Link>
            }
          />
        </div>
      </main>
    )
  }

  const totalServices = clinic.services.length
  const visibleCount = grouped.reduce((acc, g) => acc + g.items.length, 0)

  return (
    <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8">
      {/* Clinic Header Section */}
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6 mb-8"
      >
        <div className="flex flex-col md:flex-row gap-8">
          {/* Photo / logo avatar */}
          <div className="flex-shrink-0 flex items-center gap-4 md:flex-col md:items-start">
            {clinic.photo_url ? (
              <img
                src={clinic.photo_url}
                alt={`${clinic.name} photo`}
                className="w-28 h-28 md:w-32 md:h-32 rounded-xl object-cover border border-outline-variant shrink-0"
                loading="lazy"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-xl flex items-center justify-center border border-outline-variant text-on-primary shrink-0"
                style={{ backgroundColor: clinic.logo_color }}
              >
                <Icon name="medical_services" className="text-4xl" />
              </div>
            )}
          </div>

          {/* Basic info */}
          <div className="flex-grow flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-text-main">
                  {clinic.name}
                </h1>
                {clinic.verified && (
                  <Badge tone="success">
                    <Icon name="verified" className="text-[16px]" filled /> {t('Verified')}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <Rating value={clinic.rating} count={clinic.reviews_count} />
                <span className="flex items-center gap-1 text-text-subtle font-body-sm">
                  <Icon name="location_city" className="text-[18px]" /> {clinic.city}
                </span>
              </div>

              <div className="flex items-start gap-2 text-text-subtle">
                <Icon name="location_on" className="mt-0.5 text-[20px]" />
                <span className="font-body-md">{clinic.address}</span>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-text-subtle font-body-sm">
                <span className="flex items-center gap-2">
                  <Icon name="phone_iphone" className="text-[18px] text-primary" />
                  <a className="hover:text-primary transition-colors" href={`tel:${clinic.phone}`}>
                    {clinic.phone}
                  </a>
                </span>
                <span className="flex items-center gap-2">
                  <Icon name="schedule" className="text-[18px] text-primary" />
                  {clinic.working_hours}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {clinic.source_url && (
                  <Link
                    to={clinic.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary font-label-bold hover:underline"
                  >
                    <Icon name="open_in_new" className="text-[18px]" /> {t('Visit source')}
                  </Link>
                )}
                {clinic.socials?.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t('Social link')}
                    className="text-on-surface-variant hover:text-primary transition-colors"
                  >
                    <Icon name="public" className="text-[20px]" />
                  </a>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <Button
                variant={fav ? 'secondary' : 'outline'}
                onClick={() => clinicId && activityStore.toggleFavorite(clinicId)}
                aria-pressed={fav}
                className="flex items-center gap-2"
              >
                <Icon name={fav ? 'favorite' : 'favorite_border'} filled={fav} />
                {fav ? t('Saved') : t('Save clinic')}
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Ratings & Reviews (from official Places API; off until a key is set) */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-headline-md text-headline-md text-text-main">{t('Ratings & Reviews')}</h2>
          {clinic.rating != null && <Rating value={clinic.rating} count={clinic.reviews_count} />}
        </div>
        {clinic.reviews && clinic.reviews.length > 0 ? (
          <ul className="space-y-4">
            {clinic.reviews.map((r, i) => (
              <li key={i} className="border-b border-outline-variant/60 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-label-bold text-on-surface">{r.author_alias ?? t('Anonymous')}</span>
                  {r.rating != null && <Rating value={r.rating} />}
                  <Badge tone="neutral" className="ml-auto">{r.source}</Badge>
                </div>
                {r.text && <p className="text-body-sm text-text-subtle">{r.text}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-start gap-3 text-text-subtle bg-surface-container-low rounded-lg p-4">
            <Icon name="reviews" className="text-primary text-[22px] mt-0.5" />
            <p className="text-body-sm">
              {t(
                "Ratings & reviews are sourced from an official Places API (2GIS/Google) and appear here once a provider key is configured. We don't scrape review platforms.",
              )}
            </p>
          </div>
        )}
      </section>

      {/* Main Content & Sidebar */}
      <div className="flex flex-col lg:flex-row gap-gutter">
        {/* Left Column: Services */}
        <div className="lg:w-2/3">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="font-headline-md text-headline-md text-text-main">
                  {t('Services & Prices')}
                </h2>
                <div className="relative w-full sm:w-64">
                  <label htmlFor="service-filter" className="sr-only">
                    {t('Search service')}
                  </label>
                  <input
                    id="service-filter"
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={t('Search service...')}
                    className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-lg text-body-sm focus:ring-2 focus:ring-secondary outline-none"
                  />
                  <Icon
                    name="search"
                    className="absolute left-3 top-2.5 text-text-subtle text-[20px]"
                  />
                </div>
              </div>

              {grouped.length === 0 ? (
                <EmptyState
                  icon="search_off"
                  title={t('No services match your search')}
                  description={
                    totalServices > 0
                      ? t('Try a different service name.')
                      : t('This clinic has no listed services yet.')
                  }
                />
              ) : (
                <div className="space-y-8">
                  {grouped.map((group) => (
                    <section key={group.category}>
                      <h3 className="font-label-bold text-on-surface-variant uppercase tracking-wider text-xs mb-3">
                        {CATEGORY_LABELS[group.category]}
                      </h3>
                      <div className="space-y-4">
                        {group.items.map((s) => (
                          <div
                            key={s.offer_id}
                            className="group border border-outline-variant p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-primary/30 hover:bg-primary-fixed/5 transition-all"
                          >
                            <div className="flex-grow min-w-0">
                              <Link
                                to={`/service/${s.service_id}`}
                                className="font-label-bold text-on-surface text-lg hover:text-primary transition-colors"
                              >
                                {s.service_name_norm}
                              </Link>
                              <div className="flex flex-wrap items-center gap-3 mt-2">
                                <Badge tone={CATEGORY_TONES[s.category]}>
                                  {CATEGORY_LABELS[s.category]}
                                </Badge>
                                <span className="text-body-sm text-text-subtle flex items-center gap-1">
                                  <Icon name="schedule" className="text-[16px]" />
                                  {durationLabel(s.duration_days)}
                                </span>
                                <FreshnessTag freshnessDays={s.freshness_days} />
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-price-display font-price-display text-text-main">
                                {formatPrice(s.price_kzt)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}

              {totalServices > 0 && (
                <p className="mt-8 text-center text-text-subtle text-body-sm">
                  {t('Showing')} {visibleCount} {t('of')} {totalServices} {t('services')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Contact & Map */}
        <div className="lg:w-1/3">
          <div className="sticky top-24 space-y-6">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              {clinic.lat != null && clinic.lng != null ? (
                <MapView
                  height={200}
                  pins={[
                    {
                      id: clinic.id,
                      name: clinic.name,
                      lat: clinic.lat,
                      lng: clinic.lng,
                      color: clinic.logo_color,
                      badge: '',
                      popupHtml: `<strong>${clinic.name}</strong><br/>${clinic.address ?? clinic.city}`,
                    },
                  ]}
                />
              ) : null}

              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Icon name="location_on" className="text-primary" />
                  <div>
                    <div className="font-label-bold text-on-surface">{clinic.address}</div>
                    <div className="text-xs text-text-subtle">{clinic.city}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Icon name="phone_iphone" className="text-primary" />
                  <div>
                    <a
                      className="font-label-bold text-on-surface hover:text-primary transition-colors"
                      href={`tel:${clinic.phone}`}
                    >
                      {clinic.phone}
                    </a>
                    <div className="text-xs text-text-subtle">{t('Reception')}</div>
                  </div>
                </div>
                {clinic.has_online_booking && clinic.source_url && (
                  <a
                    href={clinic.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-success-green text-white font-label-bold hover:opacity-90 transition-colors"
                  >
                    <Icon name="event_available" className="text-[18px]" /> Записаться онлайн
                  </a>
                )}
                <a
                  href={twoGisRouteUrl({
                    name: clinic.name,
                    city: clinic.city,
                    lat: clinic.lat,
                    lng: clinic.lng,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-on-primary font-label-bold hover:bg-primary-container transition-colors"
                >
                  <Icon name="directions" className="text-[18px]" /> Маршрут в 2GIS
                </a>
                <hr className="border-outline-variant" />
                <div className="flex justify-between items-center">
                  <span className="font-label-bold text-on-surface">{t('Working hours')}</span>
                  <Icon name="info" className="text-text-subtle text-[18px]" />
                </div>
                <p className="text-body-sm text-text-subtle">{clinic.working_hours}</p>

                {clinic.source_url && (
                  <Link
                    to={clinic.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      'mt-2 w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg',
                      'border border-dashed border-outline text-primary font-label-bold',
                      'hover:bg-surface-container-low transition-colors',
                    )}
                  >
                    <Icon name="open_in_new" className="text-[18px]" /> {t('Visit source')}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
