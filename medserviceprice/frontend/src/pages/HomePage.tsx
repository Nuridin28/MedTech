import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '@/components/ui/Icon'
import { formatPrice } from '@/lib/utils'
import { useServiceSearch } from '@/hooks/queries'
import { useDebounce } from '@/hooks/useDebounce'

const CITIES = ['Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktobe', 'Taraz'] as const

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5, ease: 'easeOut' },
} as const

export function HomePage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [city, setCity] = useState<string>(CITIES[0])
  const [focused, setFocused] = useState(false)

  const debouncedQuery = useDebounce(query, 300)
  const { data: suggestions, isFetching } = useServiceSearch(debouncedQuery)

  const showDropdown = focused && debouncedQuery.trim().length >= 2

  function runSearch() {
    navigate(`/search?q=${encodeURIComponent(query)}&city=${city}`)
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="hero-gradient pt-16 pb-24 px-margin-mobile md:px-0">
        <div className="max-w-container-max mx-auto text-center">
          <motion.h1
            {...reveal}
            className="font-display-lg text-headline-lg md:text-display-lg text-text-main mb-6"
          >
            Compare medical prices in seconds
          </motion.h1>
          <motion.p
            {...reveal}
            transition={{ ...reveal.transition, delay: 0.05 }}
            className="font-body-lg text-body-lg text-text-subtle mb-12 max-w-2xl mx-auto"
          >
            Find the best deals for MRI, blood tests, and doctor consultations across Kazakhstan.
            Transparent pricing from 500+ verified clinics.
          </motion.p>

          {/* Massive Search Bar */}
          <div className="relative max-w-4xl mx-auto">
            <div className="bg-surface-container-lowest p-2 rounded-xl search-shadow flex flex-col md:flex-row items-center gap-2">
              <div className="flex-1 flex items-center px-4 w-full border-b md:border-b-0 md:border-r border-outline-variant">
                <Icon name="search" className="text-outline" />
                <label htmlFor="hero-search" className="sr-only">
                  Search medical services
                </label>
                <input
                  id="hero-search"
                  className="w-full border-none focus:ring-0 bg-transparent py-4 font-body-md text-body-md text-on-surface"
                  placeholder="MRI of the brain, General blood test..."
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setTimeout(() => setFocused(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runSearch()
                  }}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={showDropdown}
                  aria-controls="hero-search-suggestions"
                />
              </div>
              <div className="flex-[0.6] flex items-center px-4 w-full">
                <Icon name="location_on" className="text-outline" />
                <label htmlFor="hero-city" className="sr-only">
                  Select city
                </label>
                <select
                  id="hero-city"
                  className="w-full border-none focus:ring-0 bg-transparent py-4 font-body-md text-body-md text-on-surface"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                >
                  {CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={runSearch}
                className="w-full md:w-auto bg-primary text-on-primary px-10 py-4 rounded-lg font-label-bold text-label-bold hover:bg-primary-container transition-colors shadow-lg shadow-primary/20"
              >
                Find Best Price
              </button>
            </div>

            {/* Autocomplete dropdown */}
            {showDropdown && (
              <div
                id="hero-search-suggestions"
                role="listbox"
                className="absolute left-0 right-0 top-full mt-2 z-20 bg-surface-container-lowest rounded-xl search-shadow border border-outline-variant/40 overflow-hidden text-left"
              >
                {isFetching && (!suggestions || suggestions.length === 0) ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-text-subtle font-body-md text-body-md">
                    <Icon name="progress_activity" className="animate-spin text-outline" />
                    <span>Searching…</span>
                  </div>
                ) : suggestions && suggestions.length > 0 ? (
                  suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => navigate(`/search?service_id=${s.id}`)}
                      className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-container-low transition-colors text-left"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Icon name="search" className="text-outline shrink-0" />
                        <span className="font-body-md text-body-md text-on-surface truncate">
                          {s.name_norm}
                        </span>
                      </span>
                      <span className="flex flex-col items-end shrink-0">
                        <span className="font-label-bold text-label-bold text-primary">
                          {formatPrice(s.min_price_kzt)}
                        </span>
                        <span className="text-text-subtle text-xs">{s.offers_count} clinics</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-text-subtle font-body-md text-body-md">
                    No services found for “{debouncedQuery}”
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Links/Trust Badges */}
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-text-subtle font-label-bold text-label-bold">
            <div className="flex items-center gap-2">
              <Icon name="verified" filled className="text-success-green" />
              <span>500+ Verified Clinics</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="update" filled className="text-success-green" />
              <span>Prices Updated Daily</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="lock" filled className="text-success-green" />
              <span>Secure Booking</span>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Services Bento Grid */}
      <section className="py-20 bg-white">
        <div className="max-w-container-max mx-auto px-margin-desktop">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-text-main">Popular Services</h2>
              <p className="text-text-subtle font-body-md">
                Most requested diagnostic and analytical procedures
              </p>
            </div>
            <Link
              to="/search"
              className="text-primary font-label-bold flex items-center gap-1 hover:underline"
            >
              View all services <Icon name="arrow_forward" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter">
            {/* Diagnostic Large Card */}
            <Link
              to="/search?q=MRI%20of%20the%20brain"
              className="md:col-span-2 md:row-span-2 bg-surface-container-low rounded-xl p-8 relative overflow-hidden group cursor-pointer border border-outline-variant/30 card-hover block"
            >
              <div className="relative z-10">
                <span className="bg-secondary text-on-secondary px-3 py-1 rounded-full text-xs font-label-bold mb-4 inline-block">
                  Diagnostic
                </span>
                <h3 className="font-headline-md text-headline-md mb-2">MRI &amp; CT Scans</h3>
                <p className="text-text-subtle mb-6 max-w-xs">
                  High-precision imaging starting from 15,000 ₸. Compare 45 clinics.
                </p>
                <span className="bg-white text-text-main px-6 py-2 rounded-lg font-label-bold border border-outline-variant hover:bg-surface-container-high transition-colors inline-block">
                  Compare Prices
                </span>
              </div>
              <img
                className="absolute right-[-20px] bottom-[-20px] w-64 h-64 object-cover opacity-20 group-hover:opacity-40 transition-opacity"
                alt="A high-tech medical imaging room featuring a state-of-the-art MRI scanner in a pristine, brightly lit clinical environment."
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCftjZeJhMl12og3OukTUI1HTr-chPvfSYmP4PIyRBx8eyChgediWFWZ4ifvkGKtvYV1WYVy2RFTpJOA7vV5PkTJTv5zWYDxV7N-8-FZwg6wgZvf5whNRdao6iO2EnxFg0EBF5p_slupprZQpGoKvfXTMQExbVzPPlYXOEzZySEAcVQNdiLoTvq4eBlBwEu152xaAX2z1t4Aniz29BC9MR_pcpXQp6EHsWvXXQoJlbT0zJkLdxXq6kvdirxL76oYF0zzb_Y3tfThmve"
              />
            </Link>

            {/* Analytics Card */}
            <Link
              to="/search?q=General%20blood%20test"
              className="bg-white rounded-xl p-6 border border-outline-variant card-hover group cursor-pointer block"
            >
              <div className="bg-primary/5 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                <Icon name="biotech" className="text-primary" />
              </div>
              <h3 className="font-label-bold text-headline-md mb-1">Blood Tests</h3>
              <p className="text-text-subtle text-body-sm mb-4">Complete panels from 2,500 ₸</p>
              <span className="text-primary font-label-bold text-sm">98 labs available</span>
            </Link>

            {/* Consultation Card */}
            <Link
              to="/search?q=Specialist%20consultation"
              className="bg-white rounded-xl p-6 border border-outline-variant card-hover group cursor-pointer block"
            >
              <div className="bg-secondary/5 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-secondary/10 transition-colors">
                <Icon name="medical_services" className="text-secondary" />
              </div>
              <h3 className="font-label-bold text-headline-md mb-1">Specialists</h3>
              <p className="text-text-subtle text-body-sm mb-4">Appointments from 5,000 ₸</p>
              <span className="text-primary font-label-bold text-sm">450+ doctors</span>
            </Link>

            {/* Dental Card */}
            <Link
              to="/search?q=Dental%20hygiene"
              className="bg-white rounded-xl p-6 border border-outline-variant card-hover group cursor-pointer block"
            >
              <div className="bg-warning-orange/5 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-warning-orange/10 transition-colors">
                <Icon name="dentistry" className="text-warning-orange" />
              </div>
              <h3 className="font-label-bold text-headline-md mb-1">Dentistry</h3>
              <p className="text-text-subtle text-body-sm mb-4">Hygiene from 12,000 ₸</p>
              <span className="text-primary font-label-bold text-sm">120 dental centers</span>
            </Link>

            {/* Ultrasound Card */}
            <Link
              to="/search?q=Ultrasound%20screening"
              className="bg-white rounded-xl p-6 border border-outline-variant card-hover group cursor-pointer block"
            >
              <div className="bg-tertiary/5 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-tertiary/10 transition-colors">
                <Icon name="monitor_heart" className="text-tertiary" />
              </div>
              <h3 className="font-label-bold text-headline-md mb-1">Ultrasound</h3>
              <p className="text-text-subtle text-body-sm mb-4">Screening from 4,000 ₸</p>
              <span className="text-primary font-label-bold text-sm">215 cabinets</span>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works (Aviasales for Medicine) */}
      <section className="py-24 bg-deep-navy text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" />
        <div className="max-w-container-max mx-auto px-margin-desktop relative z-10">
          <div className="text-center mb-16">
            <h2 className="font-headline-lg text-headline-lg mb-4">
              The &quot;Aviasales&quot; of Medical Care
            </h2>
            <p className="text-surface-variant max-w-2xl mx-auto">
              We don&apos;t provide medical services. We provide transparency. Search, compare, and book
              the most affordable clinics in three easy steps.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <motion.div {...reveal} className="text-center group">
              <div className="w-20 h-20 bg-primary-container rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <Icon name="search" className="text-3xl" />
              </div>
              <h3 className="font-headline-md text-headline-md mb-3">1. Search</h3>
              <p className="text-surface-variant text-body-md px-4">
                Enter any medical procedure or laboratory test. Our database covers everything from
                general checkups to complex surgeries.
              </p>
            </motion.div>
            <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }} className="text-center group">
              <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <Icon name="compare_arrows" className="text-3xl" />
              </div>
              <h3 className="font-headline-md text-headline-md mb-3">2. Compare</h3>
              <p className="text-surface-variant text-body-md px-4">
                Sort results by price, clinic rating, or distance from your home. See real photos and
                verified patient reviews.
              </p>
            </motion.div>
            <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.2 }} className="text-center group">
              <div className="w-20 h-20 bg-success-green rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <Icon name="event_available" className="text-3xl" />
              </div>
              <h3 className="font-headline-md text-headline-md mb-3">3. Choose &amp; Book</h3>
              <p className="text-surface-variant text-body-md px-4">
                Pick the best offer and book an appointment directly through our platform. No hidden
                fees or extra charges.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* City Quick Links */}
      <section className="py-16 bg-background">
        <div className="max-w-container-max mx-auto px-margin-desktop">
          <h2 className="font-label-bold text-headline-md text-text-main mb-8 border-l-4 border-primary pl-4">
            Clinics in major cities
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {CITIES.map((c) => (
              <Link
                key={c}
                to={`/search?city=${c}`}
                className="bg-white p-4 rounded-lg border border-outline-variant hover:border-primary transition-colors text-center font-label-bold text-on-surface-variant"
              >
                {c}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
