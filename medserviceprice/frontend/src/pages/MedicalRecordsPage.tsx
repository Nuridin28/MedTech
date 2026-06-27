import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { Badge, Button, EmptyState } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { useActivity } from '@/lib/store'
import type { BookingDraft } from '@/lib/store'
import type { ServiceCategory } from '@/api/types'

const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  laboratory: 'Laboratory',
  doctor_visit: 'Doctor Visit',
  diagnostics: 'Diagnostics',
  procedure: 'Procedure',
}

const CATEGORY_ICON: Record<ServiceCategory, string> = {
  laboratory: 'lab_panel',
  doctor_visit: 'stethoscope',
  diagnostics: 'ecg',
  procedure: 'pill',
}

type CategoryFilter = ServiceCategory | 'all'

/** Group key like "OCTOBER 2024" from an ISO datetime. */
function monthKey(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    .toUpperCase()
}

export function MedicalRecordsPage() {
  const { t } = useI18n()
  const { bookings } = useActivity()
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')

  // Real, honest source: the user's own completed visits. Their results would
  // live here once a clinic EHR sync exists — which it does not yet in this MVP.
  const completed = useMemo(
    () =>
      bookings
        .filter((b) => b.status === 'completed')
        .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()),
    [bookings],
  )

  // Categories actually present, for the filter tabs.
  const presentCategories = useMemo(() => {
    const set = new Set<ServiceCategory>()
    for (const b of completed) set.add(b.category)
    return Array.from(set)
  }, [completed])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return completed.filter((b) => {
      const matchesQuery = q === '' || b.service_name.toLowerCase().includes(q)
      const matchesCategory = activeCategory === 'all' || b.category === activeCategory
      return matchesQuery && matchesCategory
    })
  }, [completed, query, activeCategory])

  // Group filtered records by month for the timeline layout.
  const groups = useMemo(() => {
    const map = new Map<string, BookingDraft[]>()
    for (const b of filtered) {
      const key = monthKey(b.datetime)
      const arr = map.get(key)
      if (arr) arr.push(b)
      else map.set(key, [b])
    }
    return Array.from(map.entries())
  }, [filtered])

  const hasRecords = completed.length > 0

  return (
    <main className="md:ml-64 mt-16 p-gutter min-h-[calc(100vh-64px)] flex flex-col">
      {/* Page Header & Action */}
      <div className="max-w-container-max mx-auto w-full mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-text-main">{t('Medical Records')}</h1>
          <p className="text-text-subtle font-body-md mt-1">
            {t('Results from your completed appointments, in one secure place.')}
          </p>
        </div>
        <Link
          to="/appointments"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded-lg font-label-bold shadow-md hover:bg-secondary-container hover:text-on-secondary-container transition-all active:scale-[0.98]"
        >
          <Icon name="calendar_today" filled />
          {t('View Appointments')}
        </Link>
      </div>

      {/* Honesty banner: records sync is not wired up in this MVP */}
      <div className="max-w-container-max mx-auto w-full mb-8">
        <div className="bg-primary-fixed text-on-primary-fixed border border-outline-variant rounded-xl p-4 md:px-6 flex items-start gap-4">
          <div className="w-10 h-10 shrink-0 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
            <Icon name="info" filled />
          </div>
          <div>
            <p className="font-label-bold text-label-bold">{t('Records sync is not connected yet')}</p>
            <p className="font-body-sm mt-1">
              {t(
                "Live document sync with clinics requires EHR integration and isn't available in this preview. The entries below are generated from your completed appointments — their actual results will appear here once sync is enabled.",
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Stats / quick-access row */}
      <div className="max-w-container-max mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
            <Icon name="folder_zip" filled />
          </div>
          <div>
            <p className="text-text-subtle text-[12px] font-label-bold uppercase tracking-wider">
              {t('Completed Visits')}
            </p>
            <p className="font-headline-md text-headline-md">{completed.length}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed">
            <Icon name="verified_user" filled />
          </div>
          <div>
            <p className="text-text-subtle text-[12px] font-label-bold uppercase tracking-wider">
              {t('Storage Status')}
            </p>
            <p className="font-headline-md text-headline-md text-success-green">
              {t('Securely Encrypted')}
            </p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed">
            <Icon name="sync" filled />
          </div>
          <div>
            <p className="text-text-subtle text-[12px] font-label-bold uppercase tracking-wider">
              {t('Results Sync')}
            </p>
            <p className="font-headline-md text-headline-md text-warning-orange">{t('Pending')}</p>
          </div>
        </div>
      </div>

      {hasRecords && (
        <>
          {/* Search + category filter bar */}
          <div className="max-w-container-max mx-auto w-full mb-8 flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle">
                <Icon name="search" />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('Search records...')}
                aria-label="Search records by title"
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-body-sm outline-none"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                aria-pressed={activeCategory === 'all'}
                className={cn(
                  'px-4 py-2 rounded-full font-label-bold text-label-bold whitespace-nowrap transition-colors',
                  activeCategory === 'all'
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'bg-surface-container-low text-text-subtle hover:bg-surface-container-high',
                )}
              >
                {t('All')}
              </button>
              {presentCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  aria-pressed={activeCategory === cat}
                  className={cn(
                    'px-4 py-2 rounded-full font-label-bold text-label-bold whitespace-nowrap transition-colors',
                    activeCategory === cat
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-surface-container-low text-text-subtle hover:bg-surface-container-high',
                  )}
                >
                  {t(CATEGORY_LABEL[cat])}
                </button>
              ))}
            </div>
          </div>

          {/* Records timeline list */}
          <div className="max-w-container-max mx-auto w-full flex-1">
            {groups.length === 0 ? (
              <div className="text-center py-16 text-text-subtle font-body-md">
                {t('No records match your search.')}
              </div>
            ) : (
              groups.map(([key, items]) => (
                <div key={key} className="mb-10">
                  <div className="flex items-center gap-4 mb-4">
                    <h2 className="font-label-bold text-label-bold text-text-subtle bg-surface-container-high px-3 py-1 rounded-full">
                      {key}
                    </h2>
                    <div className="h-[1px] flex-1 bg-outline-variant" />
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {items.map((b) => (
                      <RecordCard key={b.id} booking={b} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {!hasRecords && (
        <div className="max-w-container-max mx-auto w-full flex-1">
          <EmptyState
            icon="folder_off"
            title={t('No records yet')}
            description={t('Your results will appear here after completed appointments.')}
            action={
              <Link to="/appointments">
                <Button variant="primary">{t('View Appointments')}</Button>
              </Link>
            }
          />
        </div>
      )}
    </main>
  )
}

/** A single record entry, derived from one completed booking. */
function RecordCard({ booking }: { booking: BookingDraft }) {
  const { t } = useI18n()
  const [showNote, setShowNote] = useState(false)

  return (
    <div className="record-card bg-surface-container-lowest border border-outline-variant rounded-xl p-4 md:px-6 transition-all duration-300 group">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary-fixed transition-colors">
            <Icon name={CATEGORY_ICON[booking.category]} filled />
          </div>
          <div>
            <h3 className="font-headline-md text-[16px] text-text-main group-hover:text-primary transition-colors">
              {booking.service_name}
            </h3>
            <p className="text-text-subtle font-body-sm flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                to={`/clinic/${booking.clinic_id}`}
                className="hover:text-primary hover:underline transition-colors"
              >
                {booking.clinic_name}
              </Link>
              <span aria-hidden>•</span>
              <span>{formatDate(booking.datetime)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Badge tone="primary">{t(CATEGORY_LABEL[booking.category])}</Badge>
          <Badge tone="warning">
            <Icon name="schedule" className="text-[14px]" filled />
            {t('Results pending')}
          </Badge>
          <button
            type="button"
            onClick={() => setShowNote((v) => !v)}
            aria-expanded={showNote}
            className="flex-1 md:flex-none px-4 py-2 border border-outline text-text-main rounded-lg font-label-bold text-sm hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2"
          >
            <Icon name={showNote ? 'expand_less' : 'info'} className="text-[18px]" filled />
            {t('Why pending?')}
          </button>
        </div>
      </div>

      {showNote && (
        <div className="mt-4 pt-4 border-t border-outline-variant text-text-subtle font-body-sm">
          {t("Results for this visit aren't downloadable yet. Once")} {booking.clinic_name}{' '}
          {t('is connected to the records sync, the report and any lab files will appear here automatically. No documents are fabricated in this preview.')}
        </div>
      )}
    </div>
  )
}
