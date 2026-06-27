import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Badge, Button, Skeleton } from '@/components/ui'
import { adminApi, api, ApiError } from '@/api/client'
import { cn } from '@/lib/utils'
import type { ParseLog, ServiceSuggestion, UnmatchedItem } from '@/api/types'

const KEY_STORAGE = 'msp_admin_key'

function StatusBadge({ status }: { status: ParseLog['status'] }) {
  const tone = status === 'success' ? 'success' : status === 'partial' ? 'warning' : 'error'
  return <Badge tone={tone}>{status}</Badge>
}

/** Inline catalog search to attach an unmatched raw name to a service. */
function ResolvePicker({ onPick }: { onPick: (serviceId: string) => void }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<ServiceSuggestion[]>([])
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([])
      return
    }
    let live = true
    api.searchServices(q, 'hybrid').then((r) => live && setHits(r)).catch(() => setHits([]))
    return () => {
      live = false
    }
  }, [q])
  return (
    <div className="mt-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Найти услугу в справочнике…"
        className="w-full border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
      />
      {hits.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onPick(h.id)}
              className="px-2.5 py-1 rounded-full border border-outline-variant text-[12px] font-label-bold hover:bg-primary hover:text-on-primary transition-colors"
            >
              {h.name_norm}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AdminPage() {
  const [key, setKey] = useState(() => localStorage.getItem(KEY_STORAGE) ?? '')
  const [authed, setAuthed] = useState(false)
  const [logs, setLogs] = useState<ParseLog[]>([])
  const [unmatched, setUnmatched] = useState<UnmatchedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const refresh = useCallback(
    async (k: string) => {
      setLoading(true)
      setMsg(null)
      try {
        const [l, u] = await Promise.all([adminApi.parseLogs(k), adminApi.unmatched(k)])
        setLogs(l)
        setUnmatched(u)
        setAuthed(true)
        localStorage.setItem(KEY_STORAGE, k)
      } catch (e) {
        setAuthed(false)
        setMsg({ kind: 'err', text: e instanceof ApiError ? e.message : 'Ошибка запроса' })
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (key) refresh(key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function action<T>(fn: () => Promise<T>, okText: string) {
    try {
      await fn()
      setMsg({ kind: 'ok', text: okText })
      await refresh(key)
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof ApiError ? e.message : 'Ошибка' })
    }
  }

  return (
    <main className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop py-6 lg:py-8 space-y-8">
      <header>
        <h1 className="font-headline-lg-mobile lg:font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-main dark:text-on-surface mb-1">
          Админ-панель
        </h1>
        <p className="text-text-subtle font-body-md">
          Запуск парсинга, очередь нормализации, загрузка прайс-листов (TZ §7.2).
        </p>
      </header>

      {/* API key */}
      <section className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-5">
        <label className="block font-label-bold mb-2">Admin API key</label>
        <div className="flex gap-2 flex-wrap">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="X-API-Key из .env"
            className="flex-1 min-w-[220px] border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
          />
          <Button variant="primary" onClick={() => refresh(key)} disabled={!key || loading}>
            Войти
          </Button>
        </div>
        {msg && (
          <p
            className={cn(
              'mt-3 font-body-sm flex items-center gap-2',
              msg.kind === 'ok' ? 'text-success-green' : 'text-error',
            )}
          >
            <Icon name={msg.kind === 'ok' ? 'check_circle' : 'error'} className="text-[16px]" />
            {msg.text}
          </p>
        )}
      </section>

      {authed && (
        <>
          {/* Actions */}
          <section className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => action(() => adminApi.runParse(key), 'Парсинг поставлен в очередь')}>
              <Icon name="play_arrow" className="text-[18px]" /> Запустить парсинг всех источников
            </Button>
            <Button variant="outline" onClick={() => action(() => adminApi.runGeocode(key), 'Геокодирование запущено')}>
              <Icon name="my_location" className="text-[18px]" /> Геокодировать клиники
            </Button>
            <Button variant="ghost" onClick={() => refresh(key)}>
              <Icon name="refresh" className="text-[18px]" /> Обновить
            </Button>
          </section>

          {/* Upload price file */}
          <UploadCard apiKey={key} onDone={() => refresh(key)} setMsg={setMsg} />

          {/* Unmatched queue */}
          <section className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-5">
            <h2 className="font-headline-md text-headline-md mb-1">
              Очередь нормализации
              <span className="ml-2 text-text-subtle font-body-md">({unmatched.length})</span>
            </h2>
            <p className="text-text-subtle font-body-sm mb-4">
              Названия услуг, которые не привязались к справочнику автоматически. Привяжите вручную.
            </p>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : unmatched.length === 0 ? (
              <p className="text-text-subtle font-body-sm">Очередь пуста — всё нормализовано.</p>
            ) : (
              <ul className="space-y-3">
                {unmatched.map((u) => (
                  <li key={u.id} className="border border-outline-variant rounded-lg p-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <span className="font-label-bold text-on-surface">{u.service_name_raw}</span>
                        <span className="ml-2 text-text-subtle font-body-sm">
                          {u.source_key}
                          {u.match_score != null && ` · score ${u.match_score.toFixed(0)}`}
                        </span>
                      </div>
                    </div>
                    <ResolvePicker
                      onPick={(serviceId) =>
                        action(
                          () => adminApi.resolveUnmatched(key, u.id, serviceId),
                          `«${u.service_name_raw}» привязано`,
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
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
                  <thead>
                    <tr className="text-text-subtle font-label-bold">
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
                        <td className="p-2 font-label-bold">{l.source_key}</td>
                        <td className="p-2">
                          <StatusBadge status={l.status} />
                        </td>
                        <td className="p-2">{l.records_count}</td>
                        <td className="p-2 text-on-surface-variant">
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
        </>
      )}
    </main>
  )
}

function UploadCard({
  apiKey,
  onDone,
  setMsg,
}: {
  apiKey: string
  onDone: () => void
  setMsg: (m: { kind: 'ok' | 'err'; text: string }) => void
}) {
  const [clinic, setClinic] = useState('')
  const [city, setCity] = useState('Almaty')
  const [address, setAddress] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !clinic || !city) return
    setBusy(true)
    try {
      const res = await adminApi.uploadPriceFile(apiKey, {
        clinic_name: clinic,
        city,
        address: address || undefined,
        source_url: sourceUrl || undefined,
        file,
      })
      setMsg({ kind: 'ok', text: `Файл принят (${res.source_key}) — импорт в фоне` })
      setClinic('')
      setAddress('')
      setSourceUrl('')
      setFile(null)
      onDone()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof ApiError ? e.message : 'Загрузка не удалась' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-5">
      <h2 className="font-headline-md text-headline-md mb-1">Загрузить прайс-лист (3-й источник)</h2>
      <p className="text-text-subtle font-body-sm mb-4">
        Excel / CSV / PDF / DOCX. Файл проходит через тот же конвейер, что и веб-парсеры — без написания кода (TZ §3.1).
      </p>
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
        <input
          required
          value={clinic}
          onChange={(e) => setClinic(e.target.value)}
          placeholder="Название клиники *"
          className="border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
        />
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
        >
          {['Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktobe', 'Taraz', 'Pavlodar'].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Адрес (для карты)"
          className="border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
        />
        <input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="URL источника (необязательно)"
          className="border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
        />
        <input
          required
          type="file"
          accept=".xlsx,.xls,.csv,.pdf,.docx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="sm:col-span-2 font-body-sm text-on-surface-variant"
        />
        <div className="sm:col-span-2">
          <Button variant="primary" type="submit" disabled={busy || !file || !clinic}>
            <Icon name="upload_file" className="text-[18px]" /> {busy ? 'Загрузка…' : 'Импортировать'}
          </Button>
        </div>
      </form>
    </section>
  )
}
