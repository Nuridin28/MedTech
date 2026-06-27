/**
 * Tiny className combiner (clsx-like) without an extra dependency.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Format a KZT amount the way the design shows it: "2 500 ₸". */
export function formatPrice(value: number, currency: 'KZT' | 'USD' = 'KZT'): string {
  if (currency === 'USD') {
    return `$${value.toLocaleString('en-US')}`
  }
  return `${Math.round(value).toLocaleString('ru-RU').replace(/,/g, ' ')} ₸`
}

/** Humanize a freshness window into the design's "Updated N days ago" copy. */
export function formatFreshness(freshnessDays: number): string {
  if (freshnessDays <= 0) return 'Updated today'
  if (freshnessDays === 1) return 'Updated yesterday'
  return `Updated ${freshnessDays} days ago`
}

/** Per TZ §7.1 — data older than 30 days is no longer considered current. */
export const STALE_AFTER_DAYS = 30
export function isStale(freshnessDays: number): boolean {
  return freshnessDays > STALE_AFTER_DAYS
}

/** Format an ISO date string as "15 Jan 2025". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * 2GIS route link (TZ §3.4). With coordinates we open a route to the point
 * (2GIS asks for the start); without coords we fall back to a 2GIS search by
 * name + city so the link always works.
 */
export function twoGisRouteUrl(opts: {
  name: string
  city?: string | null
  lat?: number | null
  lng?: number | null
}): string {
  if (opts.lat != null && opts.lng != null) {
    return `https://2gis.kz/directions/points/%7C${opts.lng}%2C${opts.lat}`
  }
  const q = encodeURIComponent([opts.name, opts.city].filter(Boolean).join(', '))
  return `https://2gis.kz/search/${q}`
}
