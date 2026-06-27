import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Badge, Button, Skeleton } from '@/components/ui'
import { ResolvePicker } from '@/components/admin/widgets'
import { adminApi, ApiError } from '@/api/client'
import { useAdminKey } from '@/lib/adminAuth'
import { cn } from '@/lib/utils'
import type { CatalogSuggestion, UnmatchedItem } from '@/api/types'

const CAT_LABEL: Record<string, string> = {
  laboratory: 'Анализы',
  doctor_visit: 'Приём',
  diagnostics: 'Диагностика',
  procedure: 'Процедуры',
}

export function AdminNormalization() {
  const apiKey = useAdminKey()
  const [items, setItems] = useState<UnmatchedItem[]>([])
  const [suggestions, setSuggestions] = useState<CatalogSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, s] = await Promise.all([adminApi.unmatched(apiKey), adminApi.suggestions(apiKey)])
      setItems(u)
      setSuggestions(s)
    } finally {
      setLoading(false)
    }
  }, [apiKey])

  useEffect(() => {
    load()
  }, [load])

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true)
    try {
      await fn()
      setMsg({ kind: 'ok', text: ok })
      await load()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof ApiError ? e.message : 'Ошибка' })
    } finally {
      setBusy(false)
    }
  }

  async function resolve(item: UnmatchedItem, serviceId: string) {
    try {
      await adminApi.resolveUnmatched(apiKey, item.id, serviceId)
      setMsg({ kind: 'ok', text: `«${item.service_name_raw}» привязано` })
      await load()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof ApiError ? e.message : 'Ошибка' })
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="font-headline-lg text-headline-lg text-text-main dark:text-on-surface">
        Очередь нормализации{' '}
        <span className="text-text-subtle font-headline-md">({items.length})</span>
      </h1>
      <p className="text-text-subtle font-body-md">
        Названия услуг, которые не привязались к справочнику автоматически. Привяжите вручную — система
        запомнит синоним.
      </p>

      {msg && (
        <p
          className={cn(
            'font-body-sm flex items-center gap-2',
            msg.kind === 'ok' ? 'text-success-green' : 'text-error',
          )}
        >
          <Icon name={msg.kind === 'ok' ? 'check_circle' : 'error'} className="text-[16px]" /> {msg.text}
        </p>
      )}

      {/* AI catalog suggestions */}
      <section className="bg-primary/5 border border-primary/30 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <h2 className="font-headline-md text-headline-md flex items-center gap-2">
            <Icon name="auto_awesome" className="text-primary text-[22px]" />
            AI-предложения каталога
            {suggestions.length > 0 && (
              <span className="text-text-subtle font-headline-md">({suggestions.length})</span>
            )}
          </h2>
          <div className="flex gap-2 flex-wrap">
            <Button variant="primary" disabled={busy} onClick={() => run(() => adminApi.aiSuggest(apiKey), 'AI-анализ запущен — обновите через ~10–20 с')}>
              <Icon name="auto_awesome" className="text-[18px]" /> Сгенерировать (AI)
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => run(() => adminApi.renormalize(apiKey), 'Перенормализация запущена')}>
              <Icon name="sync" className="text-[18px]" /> Перенормализовать
            </Button>
            <Button variant="ghost" onClick={load}>
              <Icon name="refresh" className="text-[18px]" /> Обновить
            </Button>
          </div>
        </div>
        <p className="text-text-subtle font-body-sm mb-4">
          ИИ кластеризует очередь в новые позиции каталога. Подтвердите — и их синонимы сразу привяжут свои цены.
        </p>

        {suggestions.length === 0 ? (
          <p className="text-text-subtle font-body-sm">
            Предложений нет. Нажмите «Сгенерировать (AI)» — ИИ разберёт очередь и предложит позиции.
          </p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-lg p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-label-bold text-on-surface">{s.proposed_name_norm}</span>
                    <Badge tone="secondary">{CAT_LABEL[s.category] ?? s.category}</Badge>
                    <span className="text-text-subtle text-[12px]">{s.sample_count} цен</span>
                  </div>
                  <p className="text-text-subtle font-body-sm mt-1 truncate">
                    объединяет: {s.synonyms.join(' · ')}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => adminApi.applySuggestion(apiKey, s.id), `«${s.proposed_name_norm}» добавлено в каталог`)}
                    className="text-success-green font-label-bold text-[13px] hover:underline"
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => adminApi.rejectSuggestion(apiKey, s.id), 'Отклонено')}
                    className="text-error font-label-bold text-[13px] hover:underline"
                  >
                    Отклонить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="font-headline-md text-headline-md pt-2">Ручная очередь</h2>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <div className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-8 text-center">
          <Icon name="task_alt" className="text-4xl text-success-green mb-2" />
          <p className="text-text-subtle font-body-sm">Очередь пуста — всё нормализовано.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((u) => (
            <li
              key={u.id}
              className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-lg p-3"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className="font-label-bold text-on-surface">{u.service_name_raw}</span>
                  <span className="ml-2 text-text-subtle font-body-sm font-mono">
                    {u.source_key}
                    {u.match_score != null && ` · score ${u.match_score.toFixed(0)}`}
                  </span>
                </div>
              </div>
              <ResolvePicker onPick={(serviceId) => resolve(u, serviceId)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
