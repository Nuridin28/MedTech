import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Button, Skeleton } from '@/components/ui'
import { ParseStatusBadge, UploadCard } from '@/components/admin/widgets'
import { adminApi, ApiError } from '@/api/client'
import { useAdminKey } from '@/lib/adminAuth'
import { cn } from '@/lib/utils'
import type { ParseLog } from '@/api/types'

export function AdminSources() {
  const apiKey = useAdminKey()
  const [logs, setLogs] = useState<ParseLog[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setLogs(await adminApi.parseLogs(apiKey))
    } finally {
      setLoading(false)
    }
  }, [apiKey])

  useEffect(() => {
    load()
  }, [load])

  async function action<T>(fn: () => Promise<T>, okText: string) {
    try {
      await fn()
      setMsg({ kind: 'ok', text: okText })
      await load()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof ApiError ? e.message : 'Ошибка' })
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-headline-lg text-headline-lg text-text-main dark:text-on-surface">
        Источники и парсинг
      </h1>

      {msg && (
        <p
          className={cn(
            'font-body-sm flex items-center gap-2',
            msg.kind === 'ok' ? 'text-success-green' : 'text-error',
          )}
        >
          <Icon name={msg.kind === 'ok' ? 'check_circle' : 'error'} className="text-[16px]" />
          {msg.text}
        </p>
      )}

      {/* Actions */}
      <section className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => action(() => adminApi.runParse(apiKey), 'Парсинг поставлен в очередь')}>
          <Icon name="play_arrow" className="text-[18px]" /> Запустить парсинг всех источников
        </Button>
        <Button variant="outline" onClick={() => action(() => adminApi.runGeocode(apiKey), 'Геокодирование запущено')}>
          <Icon name="my_location" className="text-[18px]" /> Геокодировать клиники
        </Button>
        <Button variant="ghost" onClick={load}>
          <Icon name="refresh" className="text-[18px]" /> Обновить
        </Button>
      </section>

      {/* Upload */}
      <section className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-5">
        <h2 className="font-headline-md text-headline-md mb-1">Загрузить прайс-лист</h2>
        <p className="text-text-subtle font-body-sm mb-4">
          Excel / CSV / PDF / DOCX. Файл проходит через тот же конвейер, что и веб-парсеры — без кода.
        </p>
        <UploadCard onDone={load} notify={setMsg} />
      </section>

      {/* Parse logs */}
      <section className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-5">
        <h2 className="font-headline-md text-headline-md mb-4">Журнал парсинга</h2>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : logs.length === 0 ? (
          <p className="text-text-subtle font-body-sm">Логов пока нет — запустите парсинг.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-text-subtle font-label-bold">
                <tr>
                  <th className="p-2">Источник</th>
                  <th className="p-2">Статус</th>
                  <th className="p-2">Записей</th>
                  <th className="p-2">Завершён</th>
                  <th className="p-2">Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-outline-variant">
                    <td className="p-2 font-mono">{l.source_key}</td>
                    <td className="p-2">
                      <ParseStatusBadge status={l.status} />
                    </td>
                    <td className="p-2">{l.records_count}</td>
                    <td className="p-2 text-on-surface-variant whitespace-nowrap">
                      {new Date(l.finished_at).toLocaleString('ru-RU')}
                    </td>
                    <td className="p-2 text-error text-xs max-w-[260px] truncate" title={l.error_message ?? ''}>
                      {l.error_message ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
