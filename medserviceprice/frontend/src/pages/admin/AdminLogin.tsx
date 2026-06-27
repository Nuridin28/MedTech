import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui'
import { useAdminAuth } from '@/lib/adminAuth'

export function AdminLogin() {
  const { login, error } = useAdminAuth()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    await login(key)
    setBusy(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-dim dark:bg-dark-surface px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-surface-container-lowest dark:bg-surface-container border border-outline-variant rounded-2xl p-8 shadow-xl"
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-lg bg-primary text-on-primary grid place-items-center">
            <Icon name="admin_panel_settings" className="text-[20px]" />
          </div>
          <span className="font-headline-md text-headline-md">Админ-панель</span>
        </div>
        <p className="text-text-subtle font-body-sm mb-6">MedServicePrice.kz — вход для операторов</p>

        <label htmlFor="admin-key" className="block font-label-bold mb-2">
          Admin API key
        </label>
        <input
          id="admin-key"
          type="password"
          autoFocus
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="X-API-Key из .env"
          className="w-full border-outline-variant rounded-lg font-body-sm bg-surface-container-lowest text-on-surface focus:ring-secondary focus:border-secondary mb-4"
        />

        {error && (
          <p className="text-error font-body-sm flex items-center gap-1.5 mb-4">
            <Icon name="error" className="text-[16px]" /> {error}
          </p>
        )}

        <Button variant="primary" type="submit" disabled={!key || busy} className="w-full justify-center">
          {busy ? 'Проверка…' : 'Войти'}
        </Button>

        <Link
          to="/"
          className="mt-4 block text-center text-text-subtle font-label-bold text-[13px] hover:text-primary"
        >
          ← На сайт
        </Link>
      </form>
    </div>
  )
}
