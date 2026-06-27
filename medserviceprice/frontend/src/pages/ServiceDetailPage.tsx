import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { Badge, Button, FreshnessTag, Rating, EmptyState, Skeleton } from '@/components/ui'
import { cn, formatPrice, formatDate } from '@/lib/utils'
import { useOffers, usePriceHistory } from '@/hooks/queries'
import { activityStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import type { Offer, PriceHistoryResponse } from '@/api/types'

const CATEGORY_LABEL: Record<string, string> = {
  laboratory: 'Laboratory',
  doctor_visit: 'Doctor Visit',
  diagnostics: 'Diagnostics',
  procedure: 'Procedure',
}

/** Inline SVG line/area chart for price history — no chart library. */
function PriceHistoryChart({ history }: { history: PriceHistoryResponse }) {
  const { t } = useI18n()
  const points = history.points
  if (points.length === 0) return null

  const W = 600
  const H = 220
  const PAD = 16
  const prices = points.map((p) => p.price_kzt)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || 1

  const xFor = (i: number) =>
    points.length === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (points.length - 1)
  const yFor = (price: number) => PAD + (1 - (price - min) / span) * (H - PAD * 2)

  const line = points.map((p, i) => `${xFor(i)},${yFor(p.price_kzt)}`).join(' ')
  const area = `${PAD},${H - PAD} ${line} ${xFor(points.length - 1)},${H - PAD}`

  const first = points[0].price_kzt
  const last = points[points.length - 1].price_kzt
  const trendPct = first === 0 ? 0 : Math.round(((last - first) / first) * 100)
  const trendUp = trendPct > 0
  const trendDown = trendPct < 0

  return (
    <section className="mb-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg mb-2">{t('Price History')}</h2>
          <p className="text-text-subtle">{t('How prices for this service have moved over time.')}</p>
        </div>
        {trendPct !== 0 && (
          <Badge tone={trendUp ? 'error' : 'success'}>
            <Icon name={trendUp ? 'trending_up' : 'trending_down'} className="text-[16px]" />
            {trendUp ? '+' : ''}
            {trendPct}% {trendUp ? t('increase') : trendDown ? t('decrease') : ''}
          </Badge>
        )}
      </div>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-56"
          preserveAspectRatio="none"
          role="img"
          aria-label={t('Price history line chart')}
        >
          <polygon points={area} className="fill-primary/10" />
          <polyline
            points={line}
            fill="none"
            className="stroke-primary"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p, i) => (
            <circle key={i} cx={xFor(i)} cy={yFor(p.price_kzt)} r={3} className="fill-primary" />
          ))}
        </svg>
        <div className="flex justify-between mt-4 text-text-subtle font-body-sm">
          <span>{formatDate(points[0].recorded_at)}</span>
          <span>{formatDate(points[points.length - 1].recorded_at)}</span>
        </div>
      </div>
    </section>
  )
}

/** "Subscribe to price drops" form — local state only. */
function PriceDropSubscribe() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 h-full flex flex-col justify-center">
      <div className="flex items-center gap-3 mb-3 text-secondary">
        <Icon name="notifications_active" filled />
        <h3 className="font-label-bold text-lg">{t('Track this price')}</h3>
      </div>
      <p className="text-on-surface-variant font-body-md mb-4">
        {t('Get notified by email when a clinic drops its price for this service.')}
      </p>
      {subscribed ? (
        <p className="inline-flex items-center gap-2 text-success-green font-label-bold">
          <Icon name="check_circle" filled />
          {t("You're subscribed to price drops.")}
        </p>
      ) : (
        <form
          className="flex flex-col sm:flex-row gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (email.trim()) setSubscribed(true)
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('your@email.com')}
            aria-label={t('Email for price drop alerts')}
            className="flex-1 px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-text-subtle focus-visible:ring-2 focus-visible:ring-primary outline-none"
          />
          <Button type="submit" variant="secondary">
            {t('Notify me')}
          </Button>
        </form>
      )}
    </div>
  )
}

function ClinicRow({
  offer,
  onBook,
}: {
  offer: Offer
  onBook: (o: Offer) => void
}) {
  const { t } = useI18n()
  const { clinic } = offer
  return (
    <tr
      className={cn(
        'clinic-card-hover transition-all',
        offer.is_lowest && 'bg-success-green/5',
      )}
    >
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: clinic.logo_color }}
          >
            <Icon name="medical_services" className="text-on-primary" filled />
          </div>
          <div>
            <Link
              to={`/clinic/${clinic.id}`}
              className="font-label-bold text-on-surface hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              {clinic.name}
              {clinic.verified && (
                <Icon name="verified" className="text-[16px] text-primary" filled />
              )}
            </Link>
            <p className="text-body-sm text-text-subtle">
              {clinic.city} · {clinic.address}
            </p>
            <p className="text-body-sm text-text-subtle">{clinic.working_hours}</p>
          </div>
        </div>
      </td>
      <td className="p-4">
        <Rating value={clinic.rating} count={clinic.reviews_count} />
      </td>
      <td className="p-4">
        <FreshnessTag freshnessDays={offer.freshness_days} />
      </td>
      <td className="p-4">
        <div className="flex flex-col gap-1">
          <p className="font-price-display text-price-display text-primary">
            {formatPrice(offer.price_kzt)}
          </p>
          {offer.is_lowest && <Badge tone="success">{t('Best price')}</Badge>}
        </div>
      </td>
      <td className="p-4 text-right">
        <Button variant="outline" onClick={() => onBook(offer)}>
          {t('Book')}
        </Button>
      </td>
    </tr>
  )
}

export function ServiceDetailPage() {
  const { t } = useI18n()
  const { serviceId } = useParams()
  const navigate = useNavigate()

  const offersQuery = useOffers({ service_id: serviceId, sort: 'price_asc', page_size: 50 })
  const historyQuery = usePriceHistory(serviceId)

  function handleBook(o: Offer) {
    activityStore.addBooking({
      clinic_id: o.clinic.id,
      clinic_name: o.clinic.name,
      clinic_city: o.clinic.city,
      service_id: o.service_id,
      service_name: o.service_name_norm,
      category: o.category,
      price_kzt: o.price_kzt,
      datetime: new Date(Date.now() + 2 * 86400000).toISOString(),
    })
    navigate('/appointments')
  }

  const isLoading = offersQuery.isLoading
  const data = offersQuery.data
  const items = data?.items ?? []

  // Loading
  if (isLoading) {
    return (
      <main className="pt-28 pb-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-10 w-2/3 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-12">
          <div className="lg:col-span-8 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="lg:col-span-4">
            <Skeleton className="h-56 w-full" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </main>
    )
  }

  // Empty / error
  if (offersQuery.isError || items.length === 0) {
    return (
      <main className="pt-28 pb-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <EmptyState
          icon={offersQuery.isError ? 'error' : 'search_off'}
          title={offersQuery.isError ? t('Could not load offers') : t('No offers found')}
          description={
            offersQuery.isError
              ? t('Something went wrong while fetching prices for this service. Please try again.')
              : t('We have no current price data for this service. Try searching for another one.')
          }
          action={
            <Link
              to="/search"
              className="px-6 py-2.5 rounded-lg font-label-bold bg-primary text-on-primary hover:bg-primary-container transition-all"
            >
              {t('Back to search')}
            </Link>
          }
        />
      </main>
    )
  }

  const serviceName = items[0]?.service_name_norm ?? t('Service')
  const category = items[0]?.category
  const priceMin = data?.price_min ?? Math.min(...items.map((o) => o.price_kzt))
  const priceMax = data?.price_max ?? Math.max(...items.map((o) => o.price_kzt))
  const priceAvg =
    data?.price_avg ??
    Math.round(items.reduce((s, o) => s + o.price_kzt, 0) / items.length)

  const sorted = [...items].sort((a, b) => a.price_kzt - b.price_kzt)
  const avgPct = priceMax === priceMin ? 100 : ((priceAvg - priceMin) / (priceMax - priceMin)) * 100

  return (
    <main className="pt-28 pb-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
      {/* Hero Section & Service Intro */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-12">
        <div className="lg:col-span-8">
          <nav className="flex items-center gap-2 text-text-subtle mb-4 font-body-sm">
            <Link className="hover:text-primary" to="/search">
              {t('Services')}
            </Link>
            <Icon name="chevron_right" className="text-[14px]" />
            {category && (
              <>
                <span className="capitalize">{CATEGORY_LABEL[category] ?? category}</span>
                <Icon name="chevron_right" className="text-[14px]" />
              </>
            )}
            <span className="text-on-surface">{serviceName}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h1 className="font-headline-lg text-headline-lg">{serviceName}</h1>
            {category && <Badge tone="primary">{CATEGORY_LABEL[category] ?? category}</Badge>}
          </div>
          <p className="text-on-surface-variant font-body-lg mb-8 leading-relaxed">
            {t('Compare verified prices for')} {serviceName} {t('across')} {items.length}{' '}
            {items.length === 1 ? t('clinic') : t('clinics')}{' '}
            {t(
              'in your city. All prices are sourced from public clinic data and tagged with their freshness.',
            )}
          </p>

          {/* Stats Bento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="p-6 bg-surface-container-low rounded-xl border border-outline-variant">
              <div className="flex items-center gap-3 mb-3 text-success-green">
                <Icon name="trending_down" filled />
                <h3 className="font-label-bold text-lg">{t('Lowest')}</h3>
              </div>
              <p className="font-price-display text-price-display text-on-surface">
                {formatPrice(priceMin)}
              </p>
            </div>
            <div className="p-6 bg-surface-container-low rounded-xl border border-outline-variant">
              <div className="flex items-center gap-3 mb-3 text-primary">
                <Icon name="bar_chart" filled />
                <h3 className="font-label-bold text-lg">{t('Average')}</h3>
              </div>
              <p className="font-price-display text-price-display text-on-surface">
                {formatPrice(priceAvg)}
              </p>
            </div>
            <div className="p-6 bg-surface-container-low rounded-xl border border-outline-variant">
              <div className="flex items-center gap-3 mb-3 text-warning-orange">
                <Icon name="trending_up" filled />
                <h3 className="font-label-bold text-lg">{t('Highest')}</h3>
              </div>
              <p className="font-price-display text-price-display text-on-surface">
                {formatPrice(priceMax)}
              </p>
            </div>
          </div>
        </div>

        {/* Average price insight card */}
        <div className="lg:col-span-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 h-full flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-text-subtle font-label-bold uppercase tracking-wider mb-1">
                    {t('Average Price')}
                  </h3>
                  <p className="text-primary font-price-display text-3xl">{formatPrice(priceAvg)}</p>
                </div>
                <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full font-label-bold text-xs uppercase">
                  {t('Market Insight')}
                </span>
              </div>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between font-body-sm">
                  <span className="text-text-subtle">{t('Lowest price found:')}</span>
                  <span className="text-on-surface font-label-bold">{formatPrice(priceMin)}</span>
                </div>
                <div className="flex justify-between font-body-sm">
                  <span className="text-text-subtle">{t('Highest price found:')}</span>
                  <span className="text-on-surface font-label-bold">{formatPrice(priceMax)}</span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full" style={{ width: `${avgPct}%` }} />
                </div>
                <p className="text-text-subtle font-body-sm">
                  {items.length} {items.length === 1 ? t('clinic') : t('clinics')} {t('compared')}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => handleBook(sorted[0])}
            >
              <Icon name="bolt" />
              {t('Book best offer')}
            </Button>
          </div>
        </div>
      </div>

      {/* Clinic Comparison Table */}
      <section className="mb-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
          <div>
            <h2 className="font-headline-lg text-headline-lg mb-2">
              {items.length} {items.length === 1 ? t('Clinic') : t('Clinics')} {t('for')} {serviceName}
            </h2>
            <p className="text-text-subtle">{t('Sorted by price — cheapest first.')}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b border-outline-variant bg-surface-container-low">
                <th className="p-4 font-label-bold text-text-subtle">{t('Clinic')}</th>
                <th className="p-4 font-label-bold text-text-subtle">{t('Rating')}</th>
                <th className="p-4 font-label-bold text-text-subtle">{t('Freshness')}</th>
                <th className="p-4 font-label-bold text-text-subtle">{t('Price')}</th>
                <th className="p-4 font-label-bold text-text-subtle text-right">{t('Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant bg-surface-container-lowest">
              {sorted.map((offer) => (
                <ClinicRow key={offer.offer_id} offer={offer} onBook={handleBook} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Price history chart + subscribe */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-16">
        <div className="lg:col-span-8">
          {historyQuery.data && <PriceHistoryChart history={historyQuery.data} />}
        </div>
        <div className="lg:col-span-4">
          <PriceDropSubscribe />
        </div>
      </div>
    </main>
  )
}
