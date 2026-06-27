import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'

/** Shared Footer — from the Stitch design. */
export function Footer() {
  return (
    <footer className="bg-surface-container-low dark:bg-dark-surface-container border-t border-outline-variant dark:border-outline">
      <div className="w-full py-12 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto flex flex-col md:flex-row justify-between gap-8">
        <div className="md:max-w-xs">
          <div className="font-display-lg text-headline-md font-bold text-text-main dark:text-dark-on-surface mb-4">
            MedServicePrice.kz
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant dark:text-surface-variant">
            © 2026 MedServicePrice.kz. The "Aviasales" of medical care in Kazakhstan. All prices are
            collected from public clinic price lists for informational purposes only.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
          <FooterCol
            title="Platform"
            links={[
              { label: 'Find prices', to: '/search' },
              { label: 'For Clinics', to: '/dashboard' },
              { label: 'Saved clinics', to: '/favorites' },
            ]}
          />
          <FooterCol
            title="Account"
            links={[
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'Appointments', to: '/appointments' },
              { label: 'Medical records', to: '/records' },
            ]}
          />
          <div className="col-span-2 md:col-span-1">
            <div className="font-label-bold text-label-bold text-primary mb-4">Follow Us</div>
            <div className="flex gap-4 text-on-surface-variant dark:text-surface-variant">
              <a href="#" aria-label="Telegram" className="hover:text-primary transition-colors">
                <Icon name="send" />
              </a>
              <a href="#" aria-label="Website" className="hover:text-primary transition-colors">
                <Icon name="language" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <div className="font-label-bold text-label-bold text-primary mb-4">{title}</div>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="font-label-bold text-label-bold text-text-subtle hover:text-primary transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
