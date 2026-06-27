import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { useI18n } from '@/lib/i18n'

export function NotFoundPage() {
  const { t } = useI18n()
  return (
    <div className="max-w-container-max mx-auto px-margin-desktop py-32 text-center">
      <Icon name="error" className="text-6xl text-outline mb-4" />
      <h1 className="font-headline-lg text-headline-lg text-text-main mb-3">{t('Page not found')}</h1>
      <p className="text-text-subtle mb-8">{t("The page you're looking for doesn't exist.")}</p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-lg font-label-bold"
      >
        <Icon name="home" /> {t('Back to search')}
      </Link>
    </div>
  )
}
