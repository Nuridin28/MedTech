import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '@/components/ui/Icon'
import { Badge, Button, EmptyState } from '@/components/ui'
import { cn, formatPrice, formatDate } from '@/lib/utils'
import { activityStore, useActivity } from '@/lib/store'
import type { BookingDraft } from '@/lib/store'
import type { AppointmentStatus, ServiceCategory } from '@/api/types'

const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  laboratory: 'Laboratory',
  doctor_visit: 'Doctor Visit',
  diagnostics: 'Diagnostics',
  procedure: 'Procedure',
}

const CATEGORY_ICON: Record<ServiceCategory, string> = {
  laboratory: 'bloodtype',
  doctor_visit: 'stethoscope',
  diagnostics: 'radiology',
  procedure: 'medical_services',
}

type Tab = 'all' | AppointmentStatus

const TABS: { id: Tab; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'All' },
]

const STATUS_TONE: Record<AppointmentStatus, 'primary' | 'success' | 'neutral'> = {
  upcoming: 'primary',
  completed: 'success',
  cancelled: 'neutral',
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  upcoming: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

/** Format the booking time as "09:30 AM" to mirror the Stitch design. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sortBookings(list: BookingDraft[]): BookingDraft[] {
  return [...list].sort((a, b) => {
    const ta = new Date(a.datetime).getTime()
    const tb = new Date(b.datetime).getTime()
    // Soonest upcoming first; most recent past (completed/cancelled) first.
    if (a.status === 'upcoming' && b.status === 'upcoming') return ta - tb
    return tb - ta
  })
}

function AppointmentRow({ b }: { b: BookingDraft }) {
  const dimmed = b.status !== 'upcoming'
  const cancelled = b.status === 'cancelled'
  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="hover:bg-surface-container-low/50 transition-colors group"
    >
      <td className="px-6 py-5">
        <div className={cn('flex items-center gap-3', dimmed && 'opacity-70 grayscale')}>
          <div
            className={cn(
              'w-10 h-10 rounded flex items-center justify-center shrink-0',
              dimmed
                ? 'bg-surface-container text-text-subtle'
                : 'bg-primary/10 text-primary',
            )}
          >
            <Icon name={CATEGORY_ICON[b.category]} />
          </div>
          <div>
            <p className={cn('font-bold text-text-main', cancelled && 'line-through')}>
              {b.service_name}
            </p>
            <p className="text-xs text-text-subtle">{CATEGORY_LABEL[b.category]}</p>
          </div>
        </div>
      </td>
      <td className={cn('px-6 py-5', dimmed && 'text-text-subtle')}>
        <div className="flex flex-col">
          <Link
            to={`/clinic/${b.clinic_id}`}
            className="font-semibold text-text-main hover:text-primary hover:underline transition-colors w-fit"
          >
            {b.clinic_name}
          </Link>
          <span className="text-xs text-text-subtle flex items-center gap-1">
            <Icon name="location_on" className="text-[12px]" /> {b.clinic_city}
          </span>
        </div>
      </td>
      <td className={cn('px-6 py-5', dimmed && 'text-text-subtle')}>
        <div className="flex flex-col">
          <span className="font-semibold text-text-main">{formatDate(b.datetime)}</span>
          <span className="text-xs text-text-subtle">{formatTime(b.datetime)}</span>
        </div>
      </td>
      <td className={cn('px-6 py-5', dimmed && 'text-text-subtle')}>
        <span className="font-price-display text-price-display text-text-main">
          {formatPrice(b.price_kzt)}
        </span>
      </td>
      <td className="px-6 py-5">
        <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
      </td>
      <td className="px-6 py-5 text-right">
        {b.status === 'upcoming' ? (
          <div className="flex justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => activityStore.cancelBooking(b.id)}
              className="text-error hover:underline font-bold text-sm rounded outline-none focus-visible:ring-2 focus-visible:ring-error"
            >
              Cancel
            </button>
          </div>
        ) : (
          <span className="text-xs text-text-subtle">—</span>
        )}
      </td>
    </motion.tr>
  )
}

export function AppointmentsPage() {
  const { bookings } = useActivity()
  const [tab, setTab] = useState<Tab>('upcoming')

  const counts = useMemo(() => {
    return {
      upcoming: bookings.filter((b) => b.status === 'upcoming').length,
      completed: bookings.filter((b) => b.status === 'completed').length,
      cancelled: bookings.filter((b) => b.status === 'cancelled').length,
      all: bookings.length,
    }
  }, [bookings])

  const visible = useMemo(() => {
    const filtered = tab === 'all' ? bookings : bookings.filter((b) => b.status === tab)
    return sortBookings(filtered)
  }, [bookings, tab])

  const hasAny = bookings.length > 0

  return (
    <main className="p-4 md:p-8 min-h-[calc(100vh-64px)] flex flex-col gap-6 max-w-container-max mx-auto w-full">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-text-main">My Appointments</h1>
          <p className="text-text-subtle font-body-md">
            Manage your clinical visits and medical history
          </p>
        </div>
        <div className="flex gap-2">
          <div className="bg-surface-container-lowest border border-outline-variant p-3 rounded-lg flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
              <Icon name="event_available" />
            </div>
            <div>
              <p className="text-[12px] text-text-subtle leading-none">Upcoming</p>
              <p className="font-bold text-lg">{counts.upcoming}</p>
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant p-3 rounded-lg flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-text-main">
              <Icon name="history" />
            </div>
            <div>
              <p className="text-[12px] text-text-subtle leading-none">Total</p>
              <p className="font-bold text-lg">{counts.all}</p>
            </div>
          </div>
        </div>
      </div>

      {!hasAny ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm">
          <EmptyState
            icon="event_busy"
            title="No appointments yet"
            description="When you book a service through the app, it will show up here so you can manage and track your clinical visits."
            action={
              <Link to="/search">
                <Button>Find a price &amp; book</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* Status Tabs */}
          <div
            role="tablist"
            aria-label="Filter appointments by status"
            className="bg-surface-container-lowest border border-outline-variant rounded-xl p-2 flex flex-wrap items-center gap-2 shadow-sm"
          >
            {TABS.map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'px-4 py-2 rounded-lg font-body-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active
                      ? 'bg-secondary-container text-on-secondary-container font-bold'
                      : 'text-text-subtle hover:bg-surface-container-low',
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      'ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold',
                      active ? 'bg-on-secondary-container/15' : 'bg-surface-container-high',
                    )}
                  >
                    {counts[t.id]}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Appointments Table */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-6 py-4 font-label-bold text-label-bold text-text-subtle uppercase tracking-wider">
                      Service Name
                    </th>
                    <th className="px-6 py-4 font-label-bold text-label-bold text-text-subtle uppercase tracking-wider">
                      Clinic
                    </th>
                    <th className="px-6 py-4 font-label-bold text-label-bold text-text-subtle uppercase tracking-wider">
                      Date &amp; Time
                    </th>
                    <th className="px-6 py-4 font-label-bold text-label-bold text-text-subtle uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-4 font-label-bold text-label-bold text-text-subtle uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 font-label-bold text-label-bold text-text-subtle uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  <AnimatePresence initial={false}>
                    {visible.map((b) => (
                      <AppointmentRow key={b.id} b={b} />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {visible.length === 0 && (
              <div className="px-6 py-12 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center">
                  <Icon name="event_busy" className="text-2xl text-outline" />
                </div>
                <p className="text-text-subtle font-body-sm">
                  No {tab === 'all' ? '' : `${TABS.find((t) => t.id === tab)?.label.toLowerCase()} `}
                  appointments in this view.
                </p>
              </div>
            )}

            <div className="px-6 py-4 bg-surface-container-low flex justify-between items-center border-t border-outline-variant">
              <span className="text-body-sm text-text-subtle">
                Showing {visible.length} of {counts.all} appointment{counts.all === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
