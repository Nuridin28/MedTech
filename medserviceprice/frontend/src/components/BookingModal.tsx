import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui'
import { cn, formatPrice } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import type { Offer } from '@/api/types'

/** Local YYYY-MM-DD for an offset of `days` from today (no UTC drift). */
function localDateKey(days = 0): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Clinic booking slots — every 30 min, 08:00–19:00. */
const SLOTS: string[] = (() => {
  const out: string[] = []
  for (let h = 8; h <= 19; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`)
    if (h !== 19) out.push(`${String(h).padStart(2, '0')}:30`)
  }
  return out
})()

/** Next 14 selectable days as {key, weekday, dayNum, monthShort}. */
function useDayOptions() {
  return useMemo(() => {
    const days = []
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() + i)
      days.push({
        key: localDateKey(i),
        weekday: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
        dayNum: d.getDate(),
        monthShort: d.toLocaleDateString('ru-RU', { month: 'short' }),
        isToday: i === 0,
      })
    }
    return days
  }, [])
}

/**
 * Date + time-slot picker for booking an appointment. Replaces the old hardcoded
 * "+2 days from now" timestamp with a real user-chosen slot, so the appointment
 * shows the actual date/time the user picked.
 */
export function BookingModal({
  offer,
  onClose,
  onConfirm,
}: {
  offer: Offer | null
  onClose: () => void
  onConfirm: (datetimeISO: string) => void
}) {
  const { t } = useI18n()
  const days = useDayOptions()
  const [date, setDate] = useState<string>(localDateKey(0))
  const [time, setTime] = useState<string | null>(null)

  // Reset selection whenever a new offer opens the modal.
  useEffect(() => {
    if (offer) {
      setDate(localDateKey(0))
      setTime(null)
    }
  }, [offer])

  // Close on Escape.
  useEffect(() => {
    if (!offer) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [offer, onClose])

  // On "today", hide slots that have already passed.
  const now = new Date()
  const isToday = date === localDateKey(0)
  const availableSlots = useMemo(
    () =>
      SLOTS.filter((s) => {
        if (!isToday) return true
        const [h, m] = s.split(':').map(Number)
        return h * 60 + m > now.getHours() * 60 + now.getMinutes()
      }),
    [date], // eslint-disable-line react-hooks/exhaustive-deps
  )

  function confirm() {
    if (!time) return
    // Build the ISO timestamp in the user's local time, then normalize to UTC.
    const iso = new Date(`${date}T${time}:00`).toISOString()
    onConfirm(iso)
  }

  return (
    <AnimatePresence>
      {offer && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={t('Book appointment')}
        >
          <motion.div
            className="bg-surface-container-lowest w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-outline-variant shadow-2xl max-h-[90vh] overflow-y-auto"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 p-6 border-b border-outline-variant">
              <div>
                <h2 className="font-headline-md text-headline-md text-text-main">
                  {t('Book appointment')}
                </h2>
                <p className="text-text-subtle font-body-sm mt-1">
                  {offer.service_name_norm} — {offer.clinic.name}
                </p>
                {offer.clinic.working_hours && (
                  <p className="text-xs text-text-subtle flex items-center gap-1 mt-1">
                    <Icon name="schedule" className="text-[14px]" /> {offer.clinic.working_hours}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('Cancel')}
                className="text-text-subtle hover:text-text-main rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon name="close" />
              </button>
            </div>

            {/* Date picker */}
            <div className="p-6 pb-2">
              <p className="font-label-bold text-label-bold text-text-subtle uppercase tracking-wider mb-3">
                {t('Choose date')}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                {days.map((d) => {
                  const active = d.key === date
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => {
                        setDate(d.key)
                        setTime(null)
                      }}
                      className={cn(
                        'flex flex-col items-center justify-center min-w-[64px] px-3 py-2 rounded-xl border transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0',
                        active
                          ? 'bg-primary text-on-primary border-primary shadow-lg shadow-primary/20'
                          : 'bg-surface-container-lowest text-text-main border-outline-variant hover:bg-surface-container-high',
                      )}
                    >
                      <span className="text-[11px] uppercase opacity-80">
                        {d.isToday ? t('Today') : d.weekday}
                      </span>
                      <span className="font-bold text-lg leading-tight">{d.dayNum}</span>
                      <span className="text-[11px] opacity-80">{d.monthShort}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Time slots */}
            <div className="p-6 pt-2">
              <p className="font-label-bold text-label-bold text-text-subtle uppercase tracking-wider mb-3">
                {t('Choose time')}
              </p>
              {availableSlots.length === 0 ? (
                <p className="text-text-subtle font-body-sm py-4 text-center">
                  {t('No slots available for this day')}
                </p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {availableSlots.map((s) => {
                    const active = s === time
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setTime(s)}
                        className={cn(
                          'py-2 rounded-lg border text-sm font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          active
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface-container-lowest text-text-main border-outline-variant hover:bg-surface-container-high',
                        )}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-4 p-6 border-t border-outline-variant bg-surface-container-low sticky bottom-0">
              <span className="font-price-display text-price-display text-text-main">
                {formatPrice(offer.price_kzt)}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  {t('Cancel')}
                </Button>
                <Button onClick={confirm} disabled={!time} className="flex items-center gap-2">
                  <Icon name="event_available" />
                  {t('Confirm booking')}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
