import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'

import { Icon } from '@/components/ui/Icon'
import { Badge, Button, Rating, EmptyState, Skeleton } from '@/components/ui'
import { cn, formatPrice } from '@/lib/utils'
import { useActivity, activityStore } from '@/lib/store'
import { api } from '@/api/client'
import type { ClinicDetail } from '@/api/types'

type SortKey = 'name' | 'rating'

/** Cheapest offer across a clinic's services. */
function cheapestPrice(clinic: ClinicDetail): number | null {
  if (!clinic.services.length) return null
  return clinic.services.reduce((min, s) => (s.price_kzt < min ? s.price_kzt : min), clinic.services[0].price_kzt)
}

function ClinicSkeletonCard() {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden flex flex-col">
      <div className="h-32 bg-surface-container-high" />
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-14" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

function ClinicCard({ clinic }: { clinic: ClinicDetail }) {
  const cheapest = cheapestPrice(clinic)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
      className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden hover:shadow-lg transition-all flex flex-col"
    >
      {/* Header banner with accent color + unsave button */}
      <div className="h-32 relative" style={{ backgroundColor: clinic.logo_color }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            aria-hidden
            className="font-display-lg text-4xl font-bold text-on-secondary/90 select-none"
          >
            {clinic.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <button
            type="button"
            onClick={() => activityStore.toggleFavorite(clinic.id)}
            aria-label={`Remove ${clinic.name} from saved clinics`}
            className="bg-white/90 backdrop-blur p-2 rounded-full text-error hover:bg-error-container transition-colors focus-visible:ring-2 focus-visible:ring-primary outline-none"
          >
            <Icon name="favorite" filled />
          </button>
        </div>
      </div>

      <div className="p-6 flex flex-col flex-grow">
        <div className="flex justify-between items-start gap-3 mb-2">
          <Link
            to={`/clinic/${clinic.id}`}
            className="font-headline-md text-headline-md text-text-main hover:text-primary transition-colors"
          >
            {clinic.name}
          </Link>
          <Rating value={clinic.rating} count={clinic.reviews_count} className="shrink-0" />
        </div>

        {clinic.verified && (
          <div className="mb-3">
            <Badge tone="primary">
              <Icon name="verified" className="text-[14px]" filled />
              Verified
            </Badge>
          </div>
        )}

        <p className="text-text-subtle text-body-sm mb-1">
          {clinic.city}
          {clinic.address ? `, ${clinic.address}` : ''}
        </p>
        <p className="flex items-center gap-1 text-text-subtle text-body-sm mb-4">
          <Icon name="schedule" className="text-[16px]" />
          {clinic.working_hours}
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          {cheapest != null && (
            <span className="bg-surface-container-low text-text-subtle text-[11px] font-label-bold px-2 py-1 rounded uppercase tracking-wider">
              From {formatPrice(cheapest)}
            </span>
          )}
          <span className="bg-surface-container-low text-text-subtle text-[11px] font-label-bold px-2 py-1 rounded uppercase tracking-wider">
            {clinic.services.length} {clinic.services.length === 1 ? 'service' : 'services'}
          </span>
        </div>

        <Link
          to={`/clinic/${clinic.id}`}
          className="mt-auto w-full text-center border-2 border-secondary text-secondary py-2 rounded-lg font-label-bold text-label-bold hover:bg-secondary hover:text-on-secondary transition-all block"
        >
          View Clinic Profile
        </Link>
      </div>
    </motion.div>
  )
}

export function FavoritesPage() {
  const { favoriteClinicIds } = useActivity()
  const [sort, setSort] = useState<SortKey>('name')

  const results = useQueries({
    queries: favoriteClinicIds.map((id) => ({
      queryKey: ['clinic', id],
      queryFn: () => api.getClinic(id),
      staleTime: 5 * 60_000,
    })),
  })

  const isLoading = results.some((r) => r.isLoading)

  const loaded = results.map((r) => r.data).filter((c): c is ClinicDetail => c != null)
  const fingerprint = loaded.map((c) => c.id).join(',')

  const clinics = useMemo(() => {
    const sorted = [...loaded]
    if (sort === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    }
    return sorted
    // `loaded` is rederived each render; `fingerprint` captures its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, sort])

  const savedCount = favoriteClinicIds.length

  return (
    <main className="flex-grow p-8 max-w-[1200px] mx-auto w-full">
      <header className="mb-8">
        <h1 className="font-headline-lg text-headline-lg text-text-main mb-2">Saved Clinics &amp; Favorites</h1>
        <p className="text-text-subtle font-body-md">
          Manage your preferred medical providers and compare their prices in one place.
        </p>
      </header>

      {savedCount === 0 ? (
        <EmptyState
          icon="favorite_border"
          title="No saved clinics yet"
          description="Tap the heart on any clinic to keep it here. Saved clinics make it easy to track prices and rebook quickly."
          action={
            <Link to="/search">
              <Button variant="primary">
                <span className="inline-flex items-center gap-2">
                  <Icon name="search" className="text-[18px]" />
                  Browse clinics
                </span>
              </Button>
            </Link>
          }
        />
      ) : (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="font-headline-md text-headline-md text-text-main">
              {savedCount} {savedCount === 1 ? 'saved clinic' : 'saved clinics'}
            </h2>

            <div className="flex items-center gap-2" role="group" aria-label="Sort saved clinics">
              <span className="text-text-subtle text-body-sm">Sort by</span>
              {(['name', 'rating'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={sort === key}
                  onClick={() => setSort(key)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-label-bold font-label-bold transition-colors capitalize outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    sort === key
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'text-text-subtle hover:bg-surface-container-high',
                  )}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isLoading ? (
              favoriteClinicIds.map((id) => <ClinicSkeletonCard key={id} />)
            ) : (
              <AnimatePresence mode="popLayout">
                {clinics.map((clinic) => (
                  <ClinicCard key={clinic.id} clinic={clinic} />
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>
      )}
    </main>
  )
}
