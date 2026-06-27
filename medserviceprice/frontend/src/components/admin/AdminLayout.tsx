import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { adminApi } from '@/api/client'
import { useAdminAuth, useAdminKey } from '@/lib/adminAuth'
import { AdminLogin } from '@/pages/admin/AdminLogin'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/admin', label: 'Обзор', icon: 'dashboard', end: true },
  { to: '/admin/sources', label: 'Источники', icon: 'cloud_download' },
  { to: '/admin/normalization', label: 'Нормализация', icon: 'rule' },
  { to: '/admin/alerts', label: 'Алёрты', icon: 'notification_important', alerts: true },
  { to: '/admin/logs', label: 'Логи', icon: 'terminal' },
  { to: '/admin/settings', label: 'Настройки', icon: 'settings' },
]

/** Route gate: validates the key, then renders the admin shell or the login screen. */
export function AdminGate() {
  const { status } = useAdminAuth()
  if (status === 'checking') {
    return (
      <div className="min-h-screen grid place-items-center bg-surface-dim dark:bg-dark-surface">
        <div className="flex items-center gap-2 text-text-subtle">
          <Icon name="progress_activity" className="animate-spin text-[22px]" /> Проверка доступа…
        </div>
      </div>
    )
  }
  if (status === 'anon') return <AdminLogin />
  return <AdminShell />
}

function AdminShell() {
  const { logout } = useAdminAuth()
  const apiKey = useAdminKey()
  const [openAlerts, setOpenAlerts] = useState(0)

  useEffect(() => {
    let live = true
    const tick = () =>
      adminApi.alerts(apiKey).then((a) => live && setOpenAlerts(a.length)).catch(() => {})
    tick()
    const id = setInterval(tick, 20000)
    return () => {
      live = false
      clearInterval(id)
    }
  }, [apiKey])

  return (
    <div className="min-h-screen bg-surface-dim dark:bg-dark-surface flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-60 lg:min-h-screen bg-surface-container-lowest dark:bg-dark-surface-container border-b lg:border-b-0 lg:border-r border-outline-variant flex lg:flex-col">
        <div className="hidden lg:flex items-center gap-2 px-5 h-16 border-b border-outline-variant">
          <div className="w-8 h-8 rounded-lg bg-primary text-on-primary grid place-items-center">
            <Icon name="admin_panel_settings" className="text-[18px]" />
          </div>
          <span className="font-label-bold text-on-surface">Admin</span>
        </div>
        <nav className="flex lg:flex-col gap-1 p-2 lg:p-3 overflow-x-auto flex-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg font-label-bold text-[14px] whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container',
                )
              }
            >
              <Icon name={item.icon} className="text-[20px]" />
              <span>{item.label}</span>
              {item.alerts && openAlerts > 0 && (
                <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-error text-white text-[11px] font-bold">
                  {openAlerts}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="hidden lg:block p-3 border-t border-outline-variant space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg font-label-bold text-[14px] text-on-surface-variant hover:bg-surface-container"
          >
            <Icon name="public" className="text-[20px]" /> На сайт
          </Link>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg font-label-bold text-[14px] text-error hover:bg-error/5"
          >
            <Icon name="logout" className="text-[20px]" /> Выйти
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 p-5 lg:p-8 max-w-[1400px]">
        <div className="lg:hidden flex justify-end mb-3">
          <button onClick={logout} className="text-error font-label-bold text-[13px] flex items-center gap-1">
            <Icon name="logout" className="text-[16px]" /> Выйти
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
