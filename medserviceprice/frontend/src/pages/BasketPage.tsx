import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { Badge, Button, EmptyState, Rating, Skeleton } from '@/components/ui'
import { useServiceSearch } from '@/hooks/queries'
import { useDebounce } from '@/hooks/useDebounce'
import { api } from '@/api/client'
import { cn, formatPrice } from '@/lib/utils'
import type { BasketResponse, City, ServiceSuggestion } from '@/api/types'

const CITIES: City[] = ['Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktobe', 'Taraz']
type Picked = { id: string; name: string }

export function BasketPage() {
  const [picked, setPicked] = useState<Picked[]>([])
  const [city, setCity] = useState<City | ''>('')
  const [q, setQ] = useState('')
  const debounced = useDebounce(q, 250)
  const { data: hits } = useServiceSearch(debounced, 'hybrid')

  const [result, setResult] = useState<BasketResponse | null>(null)
  const [loading, setLoading] = useState(false)

  function add(s: ServiceSuggestion) {
    if (!picked.some((p) => p.id === s.id)) setPicked((p) => [...p, { id: s.id, name: s.name_norm }])
    setQ('')
  }
  function remove(id: string) {
    setPicked((p) => p.filter((x) => x.id !== id))
  }

  async function calc() {
    if (picked.length === 0) return
    setLoading(true)
    try {
      setResult(await api.basketCheapest(picked.map((p) => p.id), city || undefined))
    } finally {
      setLoading(false)
    }
  }

  const savings =
    result?.best_single_total != null && result?.best_split_total != null
      ? Math.max(0, result.best_single_total - result.best_split_total)
      : 0

  return (
    <main className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop py-6 lg:py-8">
      <header className="mb-6">
        <h1 className="font-headline-lg-mobile lg:font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-main dark:text-on-surface mb-1 flex items-center gap-2">
          <Icon name="shopping_basket" className="text-primary" /> Чек-ап: дешевле всего пакетом
        </h1>
        <p className="text-text-subtle font-body-md">
          Добавьте несколько услуг — найдём клинику, где весь набор стоит дешевле всего.
        </p>
      </header>

      {/* Builder */}
      <section className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-5 mb-6">
        <div className="grid lg:grid-cols-[1fr_220px] gap-3">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Добавить услугу (ОАК, глюкоза, ТТГ…)"
              className="w-full pl-10 border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
            />
            <Icon name="search" className="absolute left-3 top-2.5 text-text-subtle text-[20px]" />
            {debounced.trim().length >= 2 && hits && hits.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-lg shadow-lg max-h-72 overflow-y-auto">
                {hits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => add(h)}
                    className="w-full text-left px-4 py-2.5 hover:bg-surface-container flex items-center justify-between gap-2"
                  >
                    <span className="font-label-bold text-on-surface">{h.name_norm}</span>
                    {h.min_price_kzt != null && (
                      <span className="text-text-subtle font-body-sm">от {formatPrice(h.min_price_kzt)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value as City | '')}
            className="border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
          >
            <option value="">Все города</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Picked chips */}
        {picked.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {picked.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 bg-primary-container text-on-primary-container px-3 py-1.5 rounded-full font-label-bold text-[13px]"
              >
                {p.name}
                <button type="button" onClick={() => remove(p.id)} aria-label="remove">
                  <Icon name="close" className="text-[16px]" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <Button variant="primary" disabled={picked.length === 0 || loading} onClick={calc}>
            <Icon name="calculate" className="text-[18px]" /> Найти дешевле всего
          </Button>
          {picked.length > 0 && (
            <button onClick={() => setPicked([])} className="text-text-subtle font-label-bold text-[13px] hover:text-error">
              Очистить
            </button>
          )}
        </div>
      </section>

      {/* Results */}
      {loading && <Skeleton className="h-64 w-full rounded-xl" />}

      {!loading && result && result.options.length === 0 && (
        <EmptyState
          icon="search_off"
          title="Не нашли клиник с этими услугами"
          description="Попробуйте другой город или меньше услуг в наборе."
        />
      )}

      {!loading && result && result.options.length > 0 && (
        <>
          {/* Savings banner */}
          {result.best_single_total != null && (
            <div className="bg-success-green/10 border border-success-green/30 rounded-xl p-4 mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <p className="text-text-subtle font-body-sm">Лучшая клиника — весь набор</p>
                <p className="font-price-display text-headline-md text-success-green">
                  {formatPrice(result.best_single_total)}
                </p>
              </div>
              {result.best_split_total != null && (
                <div>
                  <p className="text-text-subtle font-body-sm">Если собирать по разным</p>
                  <p className="font-price-display text-headline-md text-on-surface">
                    {formatPrice(result.best_split_total)}
                  </p>
                </div>
              )}
              {savings > 0 ? (
                <p className="text-text-subtle font-body-sm">
                  Сэкономить раздельной сдачей: <b className="text-on-surface">{formatPrice(savings)}</b> — но это
                  поездки в разные клиники.
                </p>
              ) : (
                <p className="text-success-green font-label-bold">Одна клиника — и дешевле, и удобнее ✓</p>
              )}
            </div>
          )}

          <div className="space-y-4">
            {result.options.map((o, i) => {
              const full = o.covered === o.total_requested
              return (
                <article
                  key={o.clinic.id}
                  className={cn(
                    'bg-surface-container-lowest dark:bg-surface-container p-5 rounded-xl border',
                    i === 0 && full ? 'border-2 border-success-green' : 'border-outline-variant',
                  )}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link to={`/clinic/${o.clinic.id}`} className="font-headline-md text-headline-md hover:text-primary">
                          {o.clinic.name}
                        </Link>
                        {o.clinic.verified && <Icon name="verified" className="text-[18px] text-primary" filled />}
                        {i === 0 && full && <Badge tone="success">лучший выбор</Badge>}
                        {!full && (
                          <Badge tone="warning">
                            покрывает {o.covered}/{o.total_requested}
                          </Badge>
                        )}
                      </div>
                      <Rating value={o.clinic.rating} count={o.clinic.reviews_count} />
                      <div className="mt-3 space-y-1">
                        {o.lines.map((l) => (
                          <div key={l.offer_id} className="flex justify-between gap-4 text-body-sm max-w-md">
                            <span className="text-on-surface-variant truncate">{l.service_name_norm}</span>
                            <span className="font-mono text-on-surface">{formatPrice(l.price_kzt)}</span>
                          </div>
                        ))}
                        {o.missing.length > 0 && (
                          <p className="text-warning-orange text-[12px] mt-1">
                            нет: {o.missing.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-left md:text-right shrink-0">
                      <p className="text-text-subtle font-body-sm">Итого за набор</p>
                      <p className={cn('font-price-display text-headline-lg', full ? 'text-success-green' : 'text-on-surface')}>
                        {formatPrice(o.total_price)}
                      </p>
                      <Link to={`/clinic/${o.clinic.id}`} className="text-primary font-label-bold text-[13px] hover:underline">
                        К клинике →
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}
