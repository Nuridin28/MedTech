import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Skeleton } from '@/components/ui'
import { ResolvePicker } from '@/components/admin/widgets'
import { adminApi, ApiError } from '@/api/client'
import { useAdminKey } from '@/lib/adminAuth'
import { cn } from '@/lib/utils'
import type { UnmatchedItem } from '@/api/types'

export function AdminNormalization() {
  const apiKey = useAdminKey()
  const [items, setItems] = useState<UnmatchedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await adminApi.unmatched(apiKey))
    } finally {
      setLoading(false)
    }
  }, [apiKey])

  useEffect(() => {
    load()
  }, [load])

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
