import { LogsPanel } from '@/components/admin/widgets'

export function AdminLogs() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-text-main dark:text-on-surface">
          Логи системы (ELK)
        </h1>
        <p className="text-text-subtle font-body-md">
          Структурированные логи из Elasticsearch — парсинг источников, ошибки, фоновые задачи.
        </p>
      </div>
      <section className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-xl p-5">
        <LogsPanel />
      </section>
    </div>
  )
}
