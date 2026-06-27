import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { adminApi } from '@/api/client'

type Status = 'checking' | 'authed' | 'anon'

interface AdminAuthValue {
  apiKey: string | null
  status: Status
  error: string | null
  login: (key: string) => Promise<boolean>
  logout: () => void
}

const Ctx = createContext<AdminAuthValue | null>(null)
const STORAGE = 'msp_admin_key'

/** Validate a key by hitting an admin endpoint (200 = valid). */
async function validate(key: string): Promise<boolean> {
  try {
    await adminApi.stats(key)
    return true
  } catch {
    return false
  }
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem(STORAGE))
  const [status, setStatus] = useState<Status>(() => (localStorage.getItem(STORAGE) ? 'checking' : 'anon'))
  const [error, setError] = useState<string | null>(null)

  // Revalidate a stored key on mount.
  useEffect(() => {
    if (!apiKey || status !== 'checking') return
    let live = true
    validate(apiKey).then((ok) => {
      if (!live) return
      if (ok) {
        setStatus('authed')
      } else {
        localStorage.removeItem(STORAGE)
        setApiKey(null)
        setStatus('anon')
      }
    })
    return () => {
      live = false
    }
  }, [apiKey, status])

  const login = useCallback(async (key: string) => {
    setError(null)
    const ok = await validate(key.trim())
    if (ok) {
      localStorage.setItem(STORAGE, key.trim())
      setApiKey(key.trim())
      setStatus('authed')
      return true
    }
    setError('Неверный ключ или сервер недоступен')
    return false
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE)
    setApiKey(null)
    setStatus('anon')
  }, [])

  return <Ctx.Provider value={{ apiKey, status, error, login, logout }}>{children}</Ctx.Provider>
}

export function useAdminAuth(): AdminAuthValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return v
}

/** Convenience: the current API key (empty string if not authed). */
export function useAdminKey(): string {
  return useAdminAuth().apiKey ?? ''
}
