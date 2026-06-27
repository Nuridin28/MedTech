import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '@/components/ui/Icon'
import { Badge, Button, EmptyState } from '@/components/ui'
import { formatDate, formatPrice } from '@/lib/utils'
import { useActivity } from '@/lib/store'
import { useI18n } from '@/lib/i18n'

export function DashboardPage() {
  const { t } = useI18n()
  const { favoriteClinicIds, bookings, recentSearches } = useActivity()

  const upcoming = bookings.filter((b) => b.status === 'upcoming')
  const upcomingPreview = upcoming.slice(0, 3)
  const nextAppointment = upcoming[0]
  const potentialSpend = upcoming.reduce((sum, b) => sum + b.price_kzt, 0)
  const recentPreview = recentSearches.slice(0, 5)

  const hasActivity =
    upcoming.length > 0 || favoriteClinicIds.length > 0 || recentSearches.length > 0

  return (
    <main className="pt-24 px-gutter pb-gutter min-h-screen bg-surface font-body-md text-text-main">
      <div className="max-w-container-max mx-auto">
        {/* Page header */}
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-text-main mb-1">{t('Health Overview')}</h1>
            <p className="font-body-md text-body-md text-text-subtle">
              {t('Your clinical summary, built from your own activity.')}
            </p>
          </div>
          <div className="text-right">
            <Badge tone="success">{t('Verified Account')}</Badge>
          </div>
        </header>

        {!hasActivity && (
          <div className="glass-card rounded-xl mb-6">
            <EmptyState
              icon="health_metrics"
              title={t('Welcome to your dashboard')}
              description={t('Search for a medical service to compare prices, save the clinics you like, and book appointments. Everything you do shows up here.')}
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link to="/search">
                    <Button>{t('Find a price')}</Button>
                  </Link>
                  <Link to="/">
                    <Button variant="outline">{t('Browse home')}</Button>
                  </Link>
                </div>
              }
            />
          </div>
        )}

        {/* Bento Grid Summary */}
        <div className="bento-grid">
          {/* Upcoming Appointment Card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="col-span-12 lg:col-span-5 glass-card rounded-xl p-6 hover:shadow-lg transition-shadow duration-300"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="bg-primary-container/10 p-3 rounded-lg">
                <Icon name="event_upcoming" filled className="text-primary text-3xl" />
              </div>
              {nextAppointment && (
                <Link
                  to="/appointments"
                  className="font-label-bold text-label-bold text-primary underline cursor-pointer"
                >
                  {t('View Details')}
                </Link>
              )}
            </div>
            <p className="font-label-bold text-label-bold text-text-subtle uppercase tracking-wider mb-2">
              {t('Next Appointment')}
            </p>
            {nextAppointment ? (
              <>
                <h3 className="font-headline-lg text-headline-lg text-text-main mb-1">
                  {formatDate(nextAppointment.datetime)}
                </h3>
                <p className="font-body-md text-body-md text-text-subtle mb-4">
                  {nextAppointment.service_name} — {nextAppointment.clinic_name}
                </p>
                <div className="flex items-center gap-2 text-primary font-label-bold">
                  <Icon name="payments" filled className="text-sm" />
                  <span>{formatPrice(nextAppointment.price_kzt)}</span>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-headline-lg text-headline-lg text-text-main mb-1">{t('No appointments')}</h3>
                <p className="font-body-md text-body-md text-text-subtle mb-4">
                  {t("You don't have any upcoming visits booked.")}
                </p>
                <Link
                  to="/search"
                  className="inline-flex items-center gap-2 text-primary font-label-bold underline"
                >
                  <Icon name="add_circle" className="text-sm" />
                  <span>{t('Find a price')}</span>
                </Link>
              </>
            )}
          </motion.div>

          {/* Potential Spend Card */}
          <div className="col-span-12 md:col-span-6 lg:col-span-4 glass-card rounded-xl p-6 hover:shadow-lg transition-shadow duration-300">
            <div className="flex justify-between items-start mb-6">
              <div className="bg-secondary-container/20 p-3 rounded-lg">
                <Icon name="payments" filled className="text-secondary text-3xl" />
              </div>
              <Icon name="trending_up" className="text-text-subtle" />
            </div>
            <p className="font-label-bold text-label-bold text-text-subtle uppercase tracking-wider mb-2">
              {t('Upcoming Spend')}
            </p>
            <h3 className="font-price-display text-price-display text-text-main">
              {formatPrice(potentialSpend)}
            </h3>
            <p className="mt-4 font-body-sm text-body-sm text-text-subtle">
              {upcoming.length === 0
                ? t('No upcoming costs.')
                : `${t('Across')} ${upcoming.length} ${upcoming.length === 1 ? t('upcoming appointment') : t('upcoming appointments')}.`}
            </p>
          </div>

          {/* Saved Clinics Card */}
          <div className="col-span-12 md:col-span-6 lg:col-span-3 glass-card rounded-xl p-6 hover:shadow-lg transition-shadow duration-300">
            <div className="flex justify-between items-start mb-6">
              <div className="bg-tertiary-fixed p-3 rounded-lg">
                <Icon name="local_hospital" filled className="text-tertiary text-3xl" />
              </div>
            </div>
            <p className="font-label-bold text-label-bold text-text-subtle uppercase tracking-wider mb-2">
              {t('Saved Clinics')}
            </p>
            <h3 className="font-headline-lg text-headline-lg text-text-main mb-4">
              {favoriteClinicIds.length}{' '}
              {favoriteClinicIds.length === 1 ? t('Clinic') : t('Clinics')}
            </h3>
            {favoriteClinicIds.length > 0 ? (
              <Link
                to="/favorites"
                className="inline-flex items-center gap-1 text-primary font-label-bold text-label-bold underline"
              >
                <span>{t('View saved')}</span>
                <Icon name="chevron_right" className="text-sm" />
              </Link>
            ) : (
              <p className="font-body-sm text-body-sm text-text-subtle">
                {t('Save a clinic to compare it later.')}
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="col-span-12 lg:col-span-4 bg-primary rounded-xl p-6 text-on-primary">
            <h3 className="font-headline-md text-headline-md mb-6">{t('Quick Actions')}</h3>
            <div className="space-y-4">
              <Link
                to="/search"
                className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 p-4 rounded-lg transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Icon name="add_circle" />
                  <span className="font-label-bold text-label-bold">{t('Find a Price')}</span>
                </div>
                <Icon name="chevron_right" className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              <Link
                to="/appointments"
                className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 p-4 rounded-lg transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Icon name="calendar_today" />
                  <span className="font-label-bold text-label-bold">{t('My Appointments')}</span>
                </div>
                <Icon name="chevron_right" className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              <Link
                to="/records"
                className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 p-4 rounded-lg transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Icon name="description" />
                  <span className="font-label-bold text-label-bold">{t('Medical Records')}</span>
                </div>
                <Icon name="chevron_right" className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>
          </div>

          {/* Upcoming Appointments preview (real activity) */}
          <div className="col-span-12 lg:col-span-8 glass-card rounded-xl overflow-hidden">
            <div className="p-6 border-b border-outline-variant flex justify-between items-center">
              <h3 className="font-headline-md text-headline-md">{t('Upcoming Appointments')}</h3>
              <Link to="/appointments" className="text-text-subtle hover:text-primary">
                <Icon name="more_horiz" />
              </Link>
            </div>
            {upcomingPreview.length > 0 ? (
              <>
                <div className="divide-y divide-outline-variant">
                  {upcomingPreview.map((b) => (
                    <Link
                      key={b.id}
                      to="/appointments"
                      className="p-4 hover:bg-surface-container-low transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-lg">
                          <Icon name="event_upcoming" filled className="text-primary" />
                        </div>
                        <div>
                          <h4 className="font-label-bold text-label-bold">{b.service_name}</h4>
                          <p className="font-body-sm text-body-sm text-text-subtle">{b.clinic_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-label-bold text-label-bold text-text-main">
                          {formatPrice(b.price_kzt)}
                        </p>
                        <p className="font-body-sm text-body-sm text-text-subtle">
                          {formatDate(b.datetime)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  to="/appointments"
                  className="block w-full py-4 bg-surface-container-low text-primary font-label-bold text-center hover:bg-surface-container-high transition-colors"
                >
                  {t('View All Appointments')}
                </Link>
              </>
            ) : (
              <div className="p-6 flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 bg-surface-container-high flex items-center justify-center rounded-lg">
                  <Icon name="calendar_today" className="text-outline" />
                </div>
                <p className="font-body-sm text-body-sm text-text-subtle max-w-sm">
                  {t('No upcoming appointments yet. Compare prices and book your first visit.')}
                </p>
                <Link to="/search">
                  <Button>{t('Find a price')}</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Recent Searches (real activity) */}
          <div className="col-span-12 glass-card rounded-xl p-8 relative overflow-hidden flex flex-col gap-6">
            <div className="max-w-2xl">
              <h3 className="font-headline-lg text-headline-lg text-text-main mb-2">{t('Recent Searches')}</h3>
              <p className="font-body-md text-body-md text-text-subtle">
                {t('Pick up where you left off — re-run any of your latest searches.')}
              </p>
            </div>
            {recentPreview.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {recentPreview.map((s, i) => (
                  <Link
                    key={`${s.q}-${s.at}-${i}`}
                    to={`/search?q=${encodeURIComponent(s.q)}`}
                    className="inline-flex items-center gap-2 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant px-4 py-2 rounded-full font-label-bold text-label-bold text-text-main transition-colors"
                  >
                    <Icon name="search" className="text-sm text-text-subtle" />
                    <span>{s.q}</span>
                    {s.city && <span className="text-text-subtle">· {s.city}</span>}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-text-subtle">
                <Icon name="search_off" />
                <span className="font-body-sm text-body-sm">
                  {t('No searches yet.')}{' '}
                  <Link to="/search" className="text-primary font-label-bold underline">
                    {t('Start one now')}
                  </Link>
                  .
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
