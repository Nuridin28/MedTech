import { Link, NavLink } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/theme'

const NAV = [
  { to: '/search', label: 'Clinics' },
  { to: '/map', label: 'Map' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/appointments', label: 'Appointments' },
  { to: '/favorites', label: 'Saved' },
]

/** Shared TopNavBar — lifted from the Stitch screens, wired to the router. */
export function TopNav() {
  const { theme, toggle } = useTheme()
  return (
    <header className="bg-surface-container-lowest dark:bg-dark-surface-container border-b border-outline-variant dark:border-outline sticky top-0 z-50">
      <nav className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto h-20">
        <div className="flex items-center gap-12">
          <Link
            to="/"
            className="font-display-lg text-headline-md font-bold text-primary dark:text-primary-fixed"
          >
            MedServicePrice.kz
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'font-label-bold text-label-bold h-20 flex items-center border-b-2 transition-colors',
                    isActive
                      ? 'text-primary dark:text-primary-fixed border-primary'
                      : 'text-on-surface-variant dark:text-surface-variant border-transparent hover:text-primary dark:hover:text-primary-fixed-dim',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggle}
            aria-label="Toggle dark mode"
            className="text-on-surface-variant dark:text-surface-variant hover:text-primary transition-colors"
          >
            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} />
          </button>
          <Link
            to="/records"
            aria-label="Medical records"
            className="hidden sm:inline-flex text-on-surface-variant dark:text-surface-variant hover:text-primary transition-colors"
          >
            <Icon name="folder_shared" />
          </Link>
          <Link
            to="/dashboard"
            className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-label-bold text-label-bold active:opacity-80 transition-all"
          >
            Sign In
          </Link>
        </div>
      </nav>
    </header>
  )
}
