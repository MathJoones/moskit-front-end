import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowUpFromLine,
  Plug,
  LogOut,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { to: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/export',      label: 'Exportar',   icon: ArrowUpFromLine },
  { to: '/connections', label: 'Conexões',   icon: Plug },
]

export function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center border-b border-gray-200 px-4">
        <span className="text-lg font-bold text-brand-600">Moskit</span>
        <span className="ml-1 text-xs text-gray-400">Export</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  )
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-gray-200 p-4">
        <p className="truncate text-xs font-medium text-gray-700">{user?.full_name}</p>
        <p className="truncate text-xs text-gray-400">{user?.email}</p>
        <button
          onClick={logout}
          className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <LogOut size={14} />
          Sair
        </button>
      </div>
    </aside>
  )
}
