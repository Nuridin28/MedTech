import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DICT } from './i18n-dict'

export type Lang = 'ru' | 'kk' | 'en'
export const LANGS: { code: Lang; label: string; native: string }[] = [
  { code: 'ru', label: 'RU', native: 'Русский' },
  { code: 'kk', label: 'KZ', native: 'Қазақша' },
  { code: 'en', label: 'EN', native: 'English' },
]

interface I18nCtx {
  lang: Lang
  setLang: (l: Lang) => void
  /** Translate by English source string. Falls back to the key (English) when a
   *  translation is missing. Supports `{var}` interpolation. */
  t: (key: string, vars?: Record<string, string | number>) => string
}

const Ctx = createContext<I18nCtx>({ lang: 'ru', setLang: () => {}, t: (k) => k })

function detectInitial(): Lang {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('msp.lang') as Lang | null
    if (saved && ['ru', 'kk', 'en'].includes(saved)) return saved
  }
  if (typeof navigator !== 'undefined') {
    const n = navigator.language.toLowerCase()
    if (n.startsWith('kk')) return 'kk'
    if (n.startsWith('en')) return 'en'
  }
  return 'ru'
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitial)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem('msp.lang', lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const entry = DICT[key]
      let out = entry?.[lang] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
      }
      return out
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang: setLangState, t }), [lang, t])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  return useContext(Ctx)
}
