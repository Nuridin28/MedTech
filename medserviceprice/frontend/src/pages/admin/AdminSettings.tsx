import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui'
import { adminApi } from '@/api/client'
import { useAdminAuth, useAdminKey } from '@/lib/adminAuth'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

function Row({ icon, title, desc, action }: { icon: string; title: string; desc: string; action: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-outline-variant last:border-0">
      <div className="flex items-start gap-3 min-w-0">
        <Icon name={icon} className="text-[22px] text-primary mt-0.5" />
        <div>
          <div className="font-label-bold text-on-surface">{title}</div>
          <div className="text-text-subtle font-body-sm">{desc}</div>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

export function AdminSettings() {
  const { logout } = useAdminAuth()
  const apiKey = useAdminKey()
  const [kibana, setKibana] = useState<string | null>(null)

  useEffect(() => {
    adminApi.logs(apiKey, { limit: 1 }).then((r) => setKibana(r.kibana_url ?? null)).catch(() => {})
  }, [apiKey])

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="font-headline-lg text-headline-lg text-text-main dark:text-on-surface">Настройки</h1>

      {/* Account */}
      <section className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-5">
        <h2 className="font-headline-md text-headline-md mb-2">Доступ</h2>
        <Row
          icon="key"
          title="Admin API key"
          desc="Ключ хранится в этом браузере. Чтобы сменить — выйдите и войдите с новым ключом."
          action={
            <Button variant="outline" onClick={logout}>
              <Icon name="logout" className="text-[18px]" /> Выйти / сменить ключ
            </Button>
          }
        />
      </section>

      {/* Quick links */}
      <section className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-5">
        <h2 className="font-headline-md text-headline-md mb-2">Инструменты</h2>
        <Row
          icon="description"
          title="API-документация (Swagger)"
          desc="Интерактивная документация всех эндпоинтов."
          action={
            <a
              href={`${API_BASE}/docs`}
              target="_blank"
              rel="noreferrer"
              className="text-primary font-label-bold text-[14px] inline-flex items-center gap-1 hover:underline"
            >
              Открыть <Icon name="open_in_new" className="text-[16px]" />
            </a>
          }
        />
        <Row
          icon="analytics"
          title="Kibana"
          desc={kibana ? 'Глубокий анализ логов и дашборды.' : 'ELK выключен (ELASTIC_ENABLED=false).'}
          action={
            kibana ? (
              <a
                href={kibana}
                target="_blank"
                rel="noreferrer"
                className="text-primary font-label-bold text-[14px] inline-flex items-center gap-1 hover:underline"
              >
                Открыть <Icon name="open_in_new" className="text-[16px]" />
              </a>
            ) : (
              <span className="text-text-subtle font-body-sm">недоступно</span>
            )
          }
        />
      </section>

      {/* Config note */}
      <section className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-5">
        <h2 className="font-headline-md text-headline-md mb-2">Конфигурация</h2>
        <p className="text-text-subtle font-body-sm">
          Операционные настройки задаются через переменные окружения (<code className="font-mono">.env</code>)
          и применяются при перезапуске:
        </p>
        <ul className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-body-sm text-on-surface-variant font-mono text-[13px]">
          <li>ENABLE_SEMANTIC — семантический поиск</li>
          <li>STALE_AFTER_DAYS — отсечка устаревших цен</li>
          <li>SOURCE_STALE_HOURS — порог алёрта источника</li>
          <li>ALERT_EMAIL — почта для алёртов</li>
          <li>PLACES_PROVIDER — рейтинги/отзывы</li>
          <li>ELASTIC_ENABLED — отправка логов в ELK</li>
          <li>SMTP_HOST — рассылка подписок</li>
          <li>ADMIN_API_KEY — ключ этой панели</li>
        </ul>
      </section>
    </div>
  )
}
