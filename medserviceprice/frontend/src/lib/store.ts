/**
 * Local user-activity store (favorites, bookings, recent searches).
 *
 * The account-area screens (dashboard, appointments, favorites, records) are not
 * part of the TZ's public API. Rather than fabricate medical data, we persist the
 * user's *own real actions* (clinics they saved, appointments they booked, searches
 * they ran) in localStorage and render them against real clinic/service data from
 * the backend. Empty states are honest: no fake history.
 */

import { useSyncExternalStore } from 'react'
import type { Appointment, City, ServiceCategory } from '@/api/types'

const KEY = 'msp.activity.v1'

export interface BookingDraft {
  id: string
  clinic_id: string
  clinic_name: string
  clinic_city: City
  service_id: string
  service_name: string
  category: ServiceCategory
  price_kzt: number
  datetime: string
  created_at: string
  status: Appointment['status']
}

export interface RecentSearch {
  q: string
  service_id?: string
  city?: City
  at: string
}

interface Activity {
  favoriteClinicIds: string[]
  bookings: BookingDraft[]
  recentSearches: RecentSearch[]
}

const EMPTY: Activity = { favoriteClinicIds: [], bookings: [], recentSearches: [] }

function read(): Activity {
  if (typeof localStorage === 'undefined') return EMPTY
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Activity>) }
  } catch {
    return EMPTY
  }
}

const listeners = new Set<() => void>()
let snapshot: Activity = read()

function emit() {
  for (const l of listeners) l()
}

function write(next: Activity) {
  snapshot = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full / unavailable — keep in-memory snapshot */
  }
  emit()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export const activityStore = {
  get: () => snapshot,

  toggleFavorite(clinicId: string) {
    const cur = snapshot.favoriteClinicIds
    const next = cur.includes(clinicId)
      ? cur.filter((id) => id !== clinicId)
      : [...cur, clinicId]
    write({ ...snapshot, favoriteClinicIds: next })
  },

  isFavorite: (clinicId: string) => snapshot.favoriteClinicIds.includes(clinicId),

  addBooking(b: Omit<BookingDraft, 'id' | 'created_at' | 'status'>) {
    const booking: BookingDraft = {
      ...b,
      id: genId(),
      created_at: new Date().toISOString(),
      status: 'upcoming',
    }
    write({ ...snapshot, bookings: [booking, ...snapshot.bookings] })
    return booking
  },

  cancelBooking(id: string) {
    write({
      ...snapshot,
      bookings: snapshot.bookings.map((b) =>
        b.id === id ? { ...b, status: 'cancelled' as const } : b,
      ),
    })
  },

  recordSearch(s: RecentSearch) {
    const deduped = snapshot.recentSearches.filter((r) => r.q !== s.q)
    write({ ...snapshot, recentSearches: [s, ...deduped].slice(0, 10) })
  },
}

/** React binding. */
export function useActivity(): Activity {
  return useSyncExternalStore(subscribe, activityStore.get, () => EMPTY)
}
