import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Badge, Button, Skeleton } from '@/components/ui'
import { adminApi, api, ApiError } from '@/api/client'
import { cn } from '@/lib/utils'
import type { Alert, LogEntry, ParseLog, ServiceSuggestion, UnmatchedItem } from '@/api/types'

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
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const refresh = useCallback(
    async (k: string) => {
      setLoading(true)
      setMsg(null)
      try {
        const [l, u, a] = await Promise.all([
          adminApi.parseLogs(k),
          adminApi.unmatched(k),
          adminApi.alerts(k),
        ])
        setLogs(l)
        setUnmatched(u)
        setAlerts(a)
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
          {/* Alerts banner */}
          {alerts.length > 0 && (
            <section className="border border-error/40 bg-error/5 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <h2 className="font-headline-md text-headline-md text-error flex items-center gap-2">
                  <Icon name="notification_important" className="text-[22px]" filled />
                  Алёрты ({alerts.length})
                </h2>
                <Button
                  variant="outline"
                  onClick={() => action(() => adminApi.ackAllAlerts(key), 'Все алёрты отмечены прочитанными')}
                >
                  Отметить все
                </Button>
              </div>
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start justify-between gap-3 bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-lg p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone={a.severity === 'error' ? 'error' : 'warning'}>{a.severity}</Badge>
                        <span className="font-mono text-[13px] text-secondary">{a.source_key}</span>
                        <span className="text-text-subtle text-[12px]">
                          {new Date(a.created_at).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <p className="text-on-surface font-body-sm mt-1">{a.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => action(() => adminApi.ackAlert(key, a.id), 'Алёрт отмечен')}
                      className="text-primary font-label-bold text-[13px] hover:underline whitespace-nowrap"
                    >
                      Прочитано
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

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

          {/* System logs (ELK) */}
          <LogsCard apiKey={key} />

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

const LEVEL_TONE: Record<string, string> = {
  ERROR: 'text-error',
  CRITICAL: 'text-error',
  WARNING: 'text-warning-orange',
  INFO: 'text-on-surface-variant',
  DEBUG: 'text-text-subtle',
}

function LogsCard({ apiKey }: { apiKey: string }) {
  const [level, setLevel] = useState('')
  const [source, setSource] = useState('')
  const [q, setQ] = useState('')
  const [since, setSince] = useState('60')
  const [auto, setAuto] = useState(false)
  const [items, setItems] = useState<LogEntry[]>([])
  const [available, setAvailable] = useState<boolean | null>(null)
  const [kibana, setKibana] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.logs(apiKey, {
        level: level || undefined,
        source: source || undefined,
        q: q || undefined,
        since_minutes: Number(since),
        limit: 200,
      })
      setItems(res.items)
      setAvailable(res.available)
      setKibana(res.kibana_url ?? null)
    } catch {
      setAvailable(false)
    } finally {
      setLoading(false)
    }
  }, [apiKey, level, source, q, since])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!auto) return
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [auto, load])

  return (
    <section className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h2 className="font-headline-md text-headline-md">Логи системы (ELK)</h2>
        <div className="flex items-center gap-3">
          {kibana && (
            <a
              href={kibana}
              target="_blank"
              rel="noreferrer"
              className="text-primary font-label-bold text-[13px] inline-flex items-center gap-1 hover:underline"
            >
              <Icon name="open_in_new" className="text-[14px]" /> Kibana
            </a>
          )}
          <label className="flex items-center gap-1.5 font-label-bold text-[13px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
              className="rounded border-outline-variant text-primary focus:ring-secondary"
            />
            Авто-обновление
          </label>
        </div>
      </div>
      <p className="text-text-subtle font-body-sm mb-4">
        Структурированные логи из Elasticsearch — парсинг источников, ошибки, фоновые задачи.
      </p>

      {/* Filters */}
      <div className="grid sm:grid-cols-4 gap-2 mb-4">
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
        >
          <option value="">Все уровни</option>
          {['INFO', 'WARNING', 'ERROR', 'CRITICAL', 'DEBUG'].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Источник (kdl, doq, invitro…)"
          className="border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по тексту"
          className="border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
        />
        <select
          value={since}
          onChange={(e) => setSince(e.target.value)}
          className="border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary"
        >
          <option value="15">15 мин</option>
          <option value="60">1 час</option>
          <option value="360">6 часов</option>
          <option value="1440">24 часа</option>
          <option value="10080">7 дней</option>
        </select>
      </div>

      {available === false ? (
        <div className="text-text-subtle font-body-sm border border-dashed border-outline-variant rounded-lg p-4">
          Elasticsearch недоступен. Включите ELK (`ELASTIC_ENABLED=true` + сервис `elasticsearch`
          в docker-compose) — логи появятся здесь и в Kibana. JSON-логи при этом всё равно пишутся в stdout.
        </div>
      ) : loading && items.length === 0 ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <p className="text-text-subtle font-body-sm">Логов за выбранный период нет.</p>
      ) : (
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto rounded-lg border border-outline-variant">
          <table className="w-full text-left text-[13px] font-mono">
            <thead className="sticky top-0 bg-surface-container">
              <tr className="text-text-subtle">
                <th className="p-2 whitespace-nowrap">Время</th>
                <th className="p-2">Уровень</th>
                <th className="p-2">Источник</th>
                <th className="p-2">Сообщение</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l, i) => (
                <tr key={i} className="border-t border-outline-variant align-top">
                  <td className="p-2 whitespace-nowrap text-text-subtle">
                    {l['@timestamp'] ? new Date(l['@timestamp']).toLocaleTimeString('ru-RU') : '—'}
                  </td>
                  <td className={cn('p-2 font-bold', LEVEL_TONE[l.level ?? 'INFO'] ?? 'text-on-surface')}>
                    {l.level}
                  </td>
                  <td className="p-2 text-secondary">{l.source_key ?? l.logger ?? '—'}</td>
                  <td className="p-2 text-on-surface break-all">
                    {l.message}
                    {l.exception && (
                      <pre className="mt-1 text-[11px] text-error whitespace-pre-wrap">{l.exception}</pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
