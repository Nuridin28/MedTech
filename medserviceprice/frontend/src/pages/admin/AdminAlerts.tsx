import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Badge, Button, Skeleton } from '@/components/ui'
import { adminApi, ApiError } from '@/api/client'
import { useAdminKey } from '@/lib/adminAuth'
import { cn } from '@/lib/utils'
import type { Alert } from '@/api/types'

export function AdminAlerts() {
  const apiKey = useAdminKey()
  const [showAck, setShowAck] = useState(false)
  const [items, setItems] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await adminApi.alerts(apiKey, showAck))
    } finally {
      setLoading(false)
    }
  }, [apiKey, showAck])

  useEffect(() => {
    load()
  }, [load])

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn()
      setMsg(ok)
      await load()
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Ошибка')
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-headline-lg text-headline-lg text-text-main dark:text-on-surface">Алёрты</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 font-label-bold text-[13px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showAck}
              onChange={(e) => setShowAck(e.target.checked)}
              className="rounded border-outline-variant text-primary focus:ring-secondary"
            />
            Показать прочитанные
          </label>
          {!showAck && items.length > 0 && (
            <Button variant="outline" onClick={() => run(() => adminApi.ackAllAlerts(apiKey), 'Все отмечены')}>
              Отметить все
            </Button>
          )}
        </div>
      </header>

      {msg && <p className="text-success-green font-body-sm">{msg}</p>}

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <div className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-8 text-center">
          <Icon name="check_circle" className="text-4xl text-success-green mb-2" />
          <p className="text-text-subtle font-body-sm">
            {showAck ? 'Прочитанных алёртов нет.' : 'Активных алёртов нет — всё работает.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li
              key={a.id}
              className={cn(
                'flex items-start justify-between gap-3 border rounded-lg p-3',
                a.severity === 'error' ? 'border-error/40 bg-error/5' : 'border-warning-orange/40 bg-warning-orange/5',
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone={a.severity === 'error' ? 'error' : 'warning'}>{a.severity}</Badge>
                  <span className="font-mono text-[13px] text-secondary">{a.source_key}</span>
                  <span className="text-text-subtle text-[12px]">{a.kind}</span>
                  <span className="text-text-subtle text-[12px]">
                    {new Date(a.created_at).toLocaleString('ru-RU')}
                  </span>
                </div>
                <p className="text-on-surface font-body-sm mt-1">{a.message}</p>
              </div>
              {!a.acknowledged && (
                <button
                  type="button"
                  onClick={() => run(() => adminApi.ackAlert(apiKey, a.id), 'Отмечено')}
                  className="text-primary font-label-bold text-[13px] hover:underline whitespace-nowrap"
                >
                  Прочитано
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
