import { useLocation } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/contexts/ThemeContext'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':   'Dashboard',
  '/export':      'Exportar Dados',
  '/imports':     'Importar Dados',
  '/imports/new': 'Nova Importação',
  '/connections': 'Conexões',
}

export function Header() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { theme, toggle } = useTheme()

  const title = PAGE_TITLES[pathname] ?? 'Ollow Automation'

  return (
    <header className="flex h-12 items-center justify-between border-b bg-white px-5 dark:border-white/[0.06] dark:bg-[#1c1e26]">
      <h1 className="text-[14px] font-semibold tracking-tight text-gray-900 dark:text-white">
        {title}
      </h1>
      <div className="flex items-center gap-2.5">
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700 capitalize dark:bg-brand-500/[0.15] dark:text-brand-300">
          {user?.role}
        </span>
        <button
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          className="rounded-[8px] p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-[#9298b2] dark:hover:bg-white/[0.07] dark:hover:text-white"
        >
          {theme === 'dark' ? <Sun size={15} strokeWidth={1.9} /> : <Moon size={15} strokeWidth={1.9} />}
        </button>
      </div>
    </header>
  )
}
