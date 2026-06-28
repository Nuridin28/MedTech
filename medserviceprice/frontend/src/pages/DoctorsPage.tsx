import { useEffect, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Icon } from '@/components/ui/Icon'
import { Badge, Button, EmptyState, Rating, Skeleton } from '@/components/ui'
import { api } from '@/api/client'
import { useDebounce } from '@/hooks/useDebounce'
import { cn, formatPrice } from '@/lib/utils'
import type { City, Doctor } from '@/api/types'

const CITIES: City[] = ['Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktobe', 'Taraz']

const SORTS = [
  { value: 'rating', label: 'По рейтингу' },
  { value: 'soonest', label: 'Ближайшее время' },
  { value: 'price', label: 'Дешевле' },
  { value: 'distance', label: 'Ближе ко мне' },
  { value: 'experience', label: 'Больше опыта' },
]

const WEEKDAYS = [
  { value: '', label: 'Любой день' },
  { value: '1', label: 'Понедельник' },
  { value: '2', label: 'Вторник' },
  { value: '3', label: 'Среда' },
  { value: '4', label: 'Четверг' },
  { value: '5', label: 'Пятница' },
  { value: '6', label: 'Суббота' },
  { value: '7', label: 'Воскресенье' },
]

// 07:00 … 21:00 in 30-min steps for the time pickers
const TIMES = Array.from({ length: 29 }, (_, i) => {
  const m = 7 * 60 + i * 30
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
})

function slotLabel(iso: string | null): string {
  if (!iso) return 'нет слотов'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function DoctorsPage() {
  const [city, setCity] = useState<City>('Almaty')
  const [specialty, setSpecialty] = useState<number | ''>('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('rating')
  const [weekday, setWeekday] = useState('')
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const [page, setPage] = useState(1)
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [geoMsg, setGeoMsg] = useState<string | null>(null)
  const debouncedQ = useDebounce(q, 350)

  useEffect(() => setPage(1), [city, specialty, debouncedQ, sort, weekday, timeFrom, timeTo])

  // geolocation for distance sort
  useEffect(() => {
    if (sort !== 'distance' || userLoc) return
    if (!('geolocation' in navigator)) return setGeoMsg('Геолокация недоступна')
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoMsg(null) },
      () => setGeoMsg('Доступ к геолокации отклонён'),
      { timeout: 8000, maximumAge: 300000 },
    )
  }, [sort, userLoc])

  const specsQuery = useQuery({
    queryKey: ['doctor-specialties', city],
    queryFn: () => api.getDoctorSpecialties(city),
    staleTime: 30 * 60_000,
  })

  const useDist = sort === 'distance' && userLoc != null
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['doctors', city, specialty, debouncedQ, sort, page, userLoc, weekday, timeFrom, timeTo],
    queryFn: () =>
      api.getDoctors({
        city,
        specialty: specialty || undefined,
        q: debouncedQ.trim() || undefined,
        sort,
        page,
        page_size: 15,
        user_lat: useDist ? userLoc!.lat : undefined,
        user_lng: useDist ? userLoc!.lng : undefined,
        weekday: weekday ? Number(weekday) : undefined,
        time_from: timeFrom || undefined,
        time_to: timeTo || undefined,
      }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const timeActive = Boolean(weekday || timeFrom || timeTo)

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 15))

  return (
    <main className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop py-6 lg:py-8">
      <header className="mb-6">
        <h1 className="font-headline-lg-mobile lg:font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-main dark:text-on-surface mb-1 flex items-center gap-2">
          <Icon name="stethoscope" className="text-primary" /> Приём врача
        </h1>
        <p className="text-text-subtle font-body-md">
          {isLoading ? 'Загрузка…' : `${total} врачей · живые слоты записи`}
        </p>
      </header>

      {/* Filters */}
      <section className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-4 mb-6 grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск врача по фамилии…"
            className="w-full pl-10 border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
          />
          <Icon name="search" className="absolute left-3 top-2.5 text-text-subtle text-[20px]" />
        </div>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value as City)}
          className="border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
        >
          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value ? Number(e.target.value) : '')}
          className="border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
        >
          <option value="">Все специальности</option>
          {(specsQuery.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="md:col-span-4 flex items-center gap-2 flex-wrap">
          <span className="font-label-bold text-text-subtle text-[13px]">Сортировка:</span>
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSort(s.value)}
              className={cn(
                'px-3 py-1.5 rounded-full font-label-bold text-[13px] transition-colors',
                sort === s.value ? 'bg-primary text-on-primary' : 'border border-outline-variant hover:bg-surface-container',
              )}
            >
              {s.label}
            </button>
          ))}
          {sort === 'distance' && !userLoc && (
            <span className="text-text-subtle text-[12px]">{geoMsg ?? 'определяем местоположение…'}</span>
          )}
        </div>

        {/* Convenient time */}
        <div className="md:col-span-4 flex items-center gap-2 flex-wrap border-t border-outline-variant pt-3">
          <span className="font-label-bold text-text-subtle text-[13px] flex items-center gap-1">
            <Icon name="schedule" className="text-[16px]" /> Удобное время:
          </span>
          <select
            value={weekday}
            onChange={(e) => setWeekday(e.target.value)}
            className="border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
          >
            {WEEKDAYS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
          <span className="text-text-subtle text-[13px]">с</span>
          <select
            value={timeFrom}
            onChange={(e) => setTimeFrom(e.target.value)}
            className="border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
          >
            <option value="">—</option>
            {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-text-subtle text-[13px]">до</span>
          <select
            value={timeTo}
            onChange={(e) => setTimeTo(e.target.value)}
            className="border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
          >
            <option value="">—</option>
            {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {timeActive && (
            <button
              type="button"
              onClick={() => { setWeekday(''); setTimeFrom(''); setTimeTo('') }}
              className="text-error font-label-bold text-[12px] hover:underline"
            >
              сбросить время
            </button>
          )}
        </div>
      </section>

      {/* List */}
      {isLoading && (
        <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>
      )}
      {!isLoading && isError && <EmptyState icon="error" title="Не удалось загрузить врачей" description="doq.kz недоступен — попробуйте позже." />}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyState icon="search_off" title="Врачи не найдены" description="Измените специальность, город или запрос." />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className={cn('space-y-4 transition-opacity', isFetching && 'opacity-60')}>
          {items.map((d) => <DoctorCard key={d.id} doctor={d} />)}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && total > 15 && (
        <div className="mt-10 flex justify-center items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant disabled:opacity-40">
            <Icon name="chevron_left" />
          </button>
          <span className="px-4 font-label-bold">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant disabled:opacity-40">
            <Icon name="chevron_right" />
          </button>
        </div>
      )}
    </main>
  )
}

function DoctorCard({ doctor: d }: { doctor: Doctor }) {
  const [open, setOpen] = useState(false)
  const branch = d.branches[0]
  return (
    <article className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-5">
      <div className="flex gap-4">
        <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-xl bg-surface-container-high overflow-hidden shrink-0 flex items-center justify-center">
          {d.avatar_url
            ? <img src={d.avatar_url} alt={d.name ?? ''} className="w-full h-full object-cover" loading="lazy" />
            : <Icon name="person" className="text-3xl text-outline" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h3 className="font-headline-md text-headline-md text-text-main dark:text-on-surface">{d.name}</h3>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <Rating value={d.rating} count={d.reviews_count} />
                {d.experience ? <span className="text-text-subtle font-body-sm">стаж {d.experience} лет</span> : null}
                {d.gender ? <span className="text-text-subtle font-body-sm">{d.gender}</span> : null}
              </div>
            </div>
            <div className="text-right shrink-0">
              {d.min_price_kzt != null && (
                <div className="font-price-display text-headline-md text-on-surface">от {formatPrice(d.min_price_kzt)}</div>
              )}
              <div className="text-text-subtle text-[12px] flex items-center gap-1 justify-end mt-0.5">
                <Icon name="schedule" className="text-[14px]" /> {slotLabel(d.nearest_slot)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {d.specialties.slice(0, 4).map((s) => <Badge key={s} tone="secondary">{s}</Badge>)}
            {d.specialties.length > 4 && <span className="text-text-subtle text-[12px]">+{d.specialties.length - 4}</span>}
          </div>

          {branch && (
            <div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm mt-2">
              <Icon name="location_on" className="text-[16px]" />
              <span className="truncate">{branch.name}{branch.address ? ` · ${branch.address}` : ''}</span>
            </div>
          )}

          {d.matching_slots.length > 0 && (
            <div className="mt-3 bg-success-green/5 border border-success-green/30 rounded-lg p-2.5">
              <div className="text-[12px] font-label-bold text-success-green mb-1.5 flex items-center gap-1">
                <Icon name="check_circle" className="text-[14px]" /> Подходящее время:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {d.matching_slots.slice(0, 10).map((s) => (
                  <a
                    key={s}
                    href={d.doq_url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-success-green/40 font-mono text-[12px] hover:bg-success-green hover:text-white transition-colors"
                  >
                    {new Date(s).toLocaleString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <Button variant="primary" onClick={() => setOpen((v) => !v)}>
              <Icon name="event_available" className="text-[18px]" /> {open ? 'Скрыть слоты' : 'Все слоты'}
            </Button>
            {d.doq_url && (
              <a href={d.doq_url} target="_blank" rel="noreferrer" className="text-primary font-label-bold text-[14px] hover:underline inline-flex items-center gap-1">
                <Icon name="open_in_new" className="text-[16px]" /> Профиль на doq
              </a>
            )}
          </div>
        </div>
      </div>

      {open && <SlotsPanel doctor={d} />}
    </article>
  )
}

function SlotsPanel({ doctor: d }: { doctor: Doctor }) {
  const branchIds = d.branches.map((b) => b.id).join(',')
  const { data, isLoading } = useQuery({
    queryKey: ['doctor-slots', d.id, branchIds],
    queryFn: () => api.getDoctorSlots(d.id, branchIds),
    staleTime: 60_000,
  })

  return (
    <div className="mt-4 pt-4 border-t border-outline-variant">
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !data || data.dates.length === 0 ? (
        <p className="text-text-subtle font-body-sm">Свободных слотов на ближайшие дни нет.</p>
      ) : (
        <div className="space-y-3">
          {data.dates.map((day) => (
            <div key={day.date}>
              <div className="font-label-bold text-on-surface-variant text-[13px] mb-1.5">
                {new Date(day.date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {day.slots.map((s) => (
                  <a
                    key={s.id}
                    href={d.doq_url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    title="Записаться на doq.kz"
                    className="px-3 py-1.5 rounded-lg border border-outline-variant font-mono text-[13px] hover:bg-primary hover:text-on-primary transition-colors"
                  >
                    {s.time}
                  </a>
                ))}
              </div>
            </div>
          ))}
          <p className="text-text-subtle text-[12px] flex items-center gap-1 pt-1">
            <Icon name="info" className="text-[14px]" /> Слоты — в реальном времени с doq.kz. Клик — запись на doq.
          </p>
        </div>
      )}
    </div>
  )
}
