import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { EmptyState, Skeleton } from '@/components/ui'
import { MapView, type MapPin } from '@/components/MapView'
import { useClinicsMap } from '@/hooks/queries'
import type { City } from '@/api/types'

const CITIES: City[] = ['Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktobe', 'Taraz']

export function MapPage() {
  const [city, setCity] = useState<City | ''>('')
  const { data, isLoading, isError } = useClinicsMap(city || undefined)

  const pins: MapPin[] = useMemo(
    () =>
      (data?.items ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        lat: c.lat,
        lng: c.lng,
        badge: String(c.offers_count),
        color: c.verified ? '#0052cc' : '#7b2600',
        popupHtml:
          `<strong>${c.name}</strong><br/>${c.address ?? c.city}<br/>` +
          `${c.offers_count} цен · <a href="/clinic/${c.id}">профиль →</a>`,
      })),
    [data],
  )

  return (
    <main className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop py-6 lg:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg-mobile lg:font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-main dark:text-on-surface mb-1">
            Карта клиник
          </h1>
          <p className="text-text-subtle font-body-md">
            {isLoading ? 'Загрузка…' : `${pins.length} клиник на карте`}
          </p>
        </div>
        <label className="flex items-center gap-2">
          <span className="font-label-bold text-text-subtle">Город</span>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value as City | '')}
            className="border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest dark:bg-surface-dim text-on-surface focus:ring-secondary focus:border-secondary"
          >
            <option value="">Все города</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </header>

      {isLoading && <Skeleton className="h-[520px] w-full rounded-xl" />}

      {!isLoading && isError && (
        <EmptyState icon="error" title="Не удалось загрузить карту" description="Попробуйте позже." />
      )}

      {!isLoading && !isError && pins.length === 0 && (
        <EmptyState
          icon="location_off"
          title="Нет клиник с координатами"
          description="Запустите геокодирование в админ-панели (или дождитесь ночного запуска), чтобы клиники появились на карте."
          action={
            <Link to="/admin" className="text-primary font-label-bold hover:underline">
              Открыть админ-панель →
            </Link>
          }
        />
      )}

      {!isLoading && !isError && pins.length > 0 && (
        <div className="border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <MapView pins={pins} height={560} />
        </div>
      )}

      <p className="mt-4 text-text-subtle font-body-sm flex items-center gap-2">
        <Icon name="info" className="text-[16px]" />
        Синие маркеры — проверенные клиники (из официальных прайс-листов); число в маркере — количество цен.
      </p>
    </main>
  )
}
