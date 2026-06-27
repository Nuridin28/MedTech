import { cn } from '@/lib/utils'
import { Icon } from './Icon'
import { formatFreshness, isStale } from '@/lib/utils'

export { Icon }

/** Category / status chip (soft-filled, pill). */
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  className?: string
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-container-high text-on-surface-variant',
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary/10 text-secondary',
    success: 'bg-success-green/10 text-success-green',
    warning: 'bg-warning-orange/10 text-warning-orange',
    error: 'bg-error/10 text-error',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-label-bold font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** "Updated N days ago" tag with stale warning (TZ §7.1, §12). */
export function FreshnessTag({ freshnessDays, className }: { freshnessDays: number; className?: string }) {
  const stale = isStale(freshnessDays)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-label-bold',
        stale ? 'text-warning-orange' : 'text-text-subtle',
        className,
      )}
      title={stale ? 'Price may be outdated (older than 30 days)' : undefined}
    >
      <Icon name={stale ? 'warning' : 'update'} className="text-[14px]" filled={stale} />
      {formatFreshness(freshnessDays)}
    </span>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'

export function Button({
  variant = 'primary',
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-on-primary hover:bg-primary-container shadow-lg shadow-primary/20',
    secondary: 'bg-secondary text-on-secondary hover:opacity-90',
    outline: 'bg-surface-container-lowest text-text-main border border-outline-variant hover:bg-surface-container-high',
    ghost: 'text-primary hover:bg-primary/5',
  }
  return (
    <button
      className={cn(
        'px-6 py-2.5 rounded-lg font-label-bold text-label-bold transition-all active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/**
 * Star rating display used on clinic cards.
 * Clinic price lists don't publish ratings, so `value` may be null — we show an
 * honest "Not rated" chip instead of inventing stars.
 */
export function Rating({
  value,
  count,
  className,
}: {
  value: number | null | undefined
  count?: number
  className?: string
}) {
  if (value == null) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-sm text-text-subtle', className)}>
        <Icon name="star_border" className="text-[16px]" />
        Not rated
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', className)}>
      <Icon name="star" className="text-[16px] text-warning-orange" filled />
      <span className="font-label-bold text-on-surface">{value.toFixed(1)}</span>
      {count ? <span className="text-text-subtle">({count.toLocaleString('ru-RU')})</span> : null}
    </span>
  )
}

/** Generic empty-state block — keeps account screens honest when there's no data yet. */
export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
}: {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-5">
        <Icon name={icon} className="text-3xl text-outline" />
      </div>
      <h3 className="font-headline-md text-headline-md text-text-main mb-2">{title}</h3>
      {description && <p className="text-text-subtle max-w-md mb-6">{description}</p>}
      {action}
    </div>
  )
}

/** Skeleton shimmer block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-container-high/70', className)} />
}
