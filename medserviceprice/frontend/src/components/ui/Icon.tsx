import { cn } from '@/lib/utils'

interface IconProps {
  name: string
  className?: string
  filled?: boolean
  /** inline font-variation override (e.g. weight) */
  style?: React.CSSProperties
  'aria-hidden'?: boolean
}

/** Material Symbols Outlined glyph — matches the icon system used across the Stitch screens. */
export function Icon({ name, className, filled, style, ...rest }: IconProps) {
  return (
    <span
      className={cn('material-symbols-outlined', filled && 'filled', className)}
      style={style}
      aria-hidden={rest['aria-hidden'] ?? true}
    >
      {name}
    </span>
  )
}
