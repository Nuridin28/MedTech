import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Badge, Button, Skeleton } from '@/components/ui'
import { adminApi, api, ApiError } from '@/api/client'
import { useAdminKey } from '@/lib/adminAuth'
import { cn } from '@/lib/utils'
import type { LogEntry, ParseLog } from '@/api/types'

export function ParseStatusBadge({ status }: { status: ParseLog['status'] }) {
  const tone = status === 'success' ? 'success' : status === 'partial' ? 'warning' : 'error'
  return <Badge tone={tone}>{status}</Badge>
}

/** Inline catalog search to attach an unmatched raw name to a service. */
export function ResolvePicker({ onPick }: { onPick: (serviceId: string) => void }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<{ id: string; name_norm: string }[]>([])
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

const CITIES = ['Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktobe', 'Taraz', 'Pavlodar']

export function UploadCard({
  onDone,
  notify,
}: {
  onDone: () => void
  notify: (m: { kind: 'ok' | 'err'; text: string }) => void
}) {
  const apiKey = useAdminKey()
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
      notify({ kind: 'ok', text: `Файл принят (${res.source_key}) — импорт в фоне` })
      setClinic('')
      setAddress('')
      setSourceUrl('')
      setFile(null)
      onDone()
    } catch (err) {
      notify({ kind: 'err', text: err instanceof ApiError ? err.message : 'Загрузка не удалась' })
    } finally {
      setBusy(false)
    }
  }

  return (
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
        {CITIES.map((c) => (
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
  )
}

const LEVEL_TONE: Record<string, string> = {
  ERROR: 'text-error',
  CRITICAL: 'text-error',
  WARNING: 'text-warning-orange',
  INFO: 'text-on-surface-variant',
  DEBUG: 'text-text-subtle',
}

export function LogsPanel() {
  const apiKey = useAdminKey()
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
    <div>
      <div className="flex items-center justify-end gap-3 mb-3">
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
          placeholder="Источник (kdl, doq…)"
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
          Elasticsearch недоступен. Включите ELK (ELASTIC_ENABLED=true + сервис elasticsearch) —
          логи появятся здесь и в Kibana. JSON-логи при этом всё равно пишутся в stdout.
        </div>
      ) : loading && items.length === 0 ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <p className="text-text-subtle font-body-sm">Логов за выбранный период нет.</p>
      ) : (
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto rounded-lg border border-outline-variant">
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
    </div>
  )
}
