import { useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':   'Dashboard',
  '/export':      'Exportar Dados',
  '/connections': 'Conexões',
}

export function Header() {
  const { pathname } = useLocation()
  const { user } = useAuth()

  const title = PAGE_TITLES[pathname] ?? 'Moskit Export'

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-base font-semibold text-gray-800">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 capitalize">
          {user?.role}
        </span>
      </div>
    </header>
  )
}
