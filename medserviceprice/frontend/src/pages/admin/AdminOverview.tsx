import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Badge, Skeleton } from '@/components/ui'
import { ParseStatusBadge } from '@/components/admin/widgets'
import { adminApi } from '@/api/client'
import { useAdminKey } from '@/lib/adminAuth'
import { cn, formatPrice } from '@/lib/utils'
import type { AdminStats } from '@/api/types'

const CATEGORY_LABEL: Record<string, string> = {
  laboratory: 'Анализы',
  doctor_visit: 'Приём врача',
  diagnostics: 'Диагностика',
  procedure: 'Процедуры',
}

function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: number | string; tone?: string }) {
  return (
    <div className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-4">
      <div className="flex items-center gap-2 text-text-subtle mb-2">
        <Icon name={icon} className={cn('text-[20px]', tone)} />
        <span className="font-label-bold text-[13px]">{label}</span>
      </div>
      <div className="font-price-display text-headline-lg text-on-surface">{value}</div>
    </div>
  )
}

function Bars({ data, fmt }: { data: Record<string, number>; fmt?: (v: number) => string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, v]) => v))
  if (entries.length === 0) return <p className="text-text-subtle font-body-sm">Нет данных.</p>
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-3">
          <span className="w-28 shrink-0 font-label-bold text-[13px] text-on-surface-variant truncate">
            {CATEGORY_LABEL[k] ?? k}
          </span>
          <div className="flex-1 h-5 bg-surface-container rounded">
            <div
              className="h-5 rounded bg-primary"
              style={{ width: `${Math.max(4, (v / max) * 100)}%` }}
            />
          </div>
          <span className="w-20 text-right font-mono text-[13px] text-on-surface">
            {fmt ? fmt(v) : v}
          </span>
        </div>
      ))}
    </div>
  )
}

export function AdminOverview() {
  const apiKey = useAdminKey()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStats(await adminApi.stats(apiKey))
    } finally {
      setLoading(false)
    }
  }, [apiKey])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !stats) {
    return (
      <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }
  if (!stats) return null

  const coverage =
    stats.active_offers > 0 ? Math.round((stats.normalized_offers / stats.active_offers) * 100) : 0

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-headline-lg text-headline-lg text-text-main dark:text-on-surface">Обзор</h1>
        <button
          onClick={load}
          className="text-primary font-label-bold text-[14px] flex items-center gap-1 hover:underline"
        >
          <Icon name="refresh" className="text-[18px]" /> Обновить
        </button>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <Kpi icon="local_hospital" label="Клиник" value={stats.clinics} />
        <Kpi icon="sell" label="Активных цен" value={stats.active_offers} />
        <Kpi icon="menu_book" label="Услуг в справочнике" value={stats.catalog_services} />
        <Kpi icon="location_city" label="Городов" value={stats.cities} />
        <Kpi icon="rule" label="В очереди разметки" value={stats.unmatched_pending} tone="text-warning-orange" />
        <Kpi
          icon="notification_important"
          label="Открытых алёртов"
          value={stats.open_alerts}
          tone={stats.open_alerts > 0 ? 'text-error' : undefined}
        />
        <Kpi icon="done_all" label="Нормализовано" value={`${coverage}%`} tone="text-success-green" />
        <Kpi icon="cloud_download" label="Источников" value={stats.sources.length} />
      </section>

      {/* Source health */}
      <section className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-5">
        <h2 className="font-headline-md text-headline-md mb-4">Состояние источников</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-text-subtle font-label-bold">
              <tr>
                <th className="p-2">Источник</th>
                <th className="p-2">Статус</th>
                <th className="p-2">Записей</th>
                <th className="p-2">Последний парс</th>
              </tr>
            </thead>
            <tbody>
              {stats.sources.map((s) => (
                <tr key={s.source_key} className="border-t border-outline-variant">
                  <td className="p-2 font-mono">
                    {s.source_key}
                    {!s.registered && (
                      <Badge tone="neutral" className="ml-2">
                        файл
                      </Badge>
                    )}
                    {s.stale && (
                      <Badge tone="warning" className="ml-2">
                        устарел
                      </Badge>
                    )}
                  </td>
                  <td className="p-2">
                    {s.last_status ? <ParseStatusBadge status={s.last_status} /> : <span className="text-text-subtle">не запускался</span>}
                  </td>
                  <td className="p-2">{s.last_records ?? '—'}</td>
                  <td className="p-2 text-on-surface-variant">
                    {s.last_finished_at ? new Date(s.last_finished_at).toLocaleString('ru-RU') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Breakdowns */}
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-5">
          <h2 className="font-headline-md text-headline-md mb-4">Цены по категориям</h2>
          <Bars data={stats.offers_by_category} />
          <h3 className="font-label-bold text-on-surface-variant mt-5 mb-2">Средняя цена</h3>
          <Bars data={stats.avg_price_by_category} fmt={(v) => formatPrice(v)} />
        </section>
        <section className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-5">
          <h2 className="font-headline-md text-headline-md mb-4">Цены по городам</h2>
          <Bars data={stats.offers_by_city} />
        </section>
      </div>
    </div>
  )
}
