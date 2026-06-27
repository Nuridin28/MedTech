import { useState, useRef, useEffect } from 'react'
import { LANGS, useI18n } from '@/lib/i18n'
import { Icon } from './Icon'
import { cn } from '@/lib/utils'

/** RU / KZ / EN language picker for the top nav. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-on-surface-variant dark:text-surface-variant hover:text-primary transition-colors font-label-bold text-label-bold"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change language"
      >
        <Icon name="language" className="text-[20px]" />
        <span>{current.label}</span>
        <Icon name="expand_more" className="text-[16px]" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-2 w-40 bg-surface-container-lowest dark:bg-dark-surface-container border border-outline-variant rounded-lg shadow-lg overflow-hidden z-50"
        >
          {LANGS.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === lang}>
              <button
                onClick={() => {
                  setLang(l.code)
                  setOpen(false)
                }}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-2.5 text-left text-body-sm hover:bg-surface-container-high transition-colors',
                  l.code === lang ? 'text-primary font-label-bold' : 'text-on-surface',
                )}
              >
                <span>{l.native}</span>
                <span className="text-text-subtle text-xs">{l.label}</span>
                {l.code === lang && <Icon name="check" className="text-[18px] text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
