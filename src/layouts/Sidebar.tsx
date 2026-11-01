import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowUpFromLine,
  ArrowDownToLine,
  Plug,
  LogOut,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { to: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/export',      label: 'Exportar',   icon: ArrowUpFromLine },
  { to: '/imports',     label: 'Importar',   icon: ArrowDownToLine },
  { to: '/connections', label: 'Conexões',   icon: Plug },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const initials = (user?.full_name ?? user?.email ?? '?').slice(0, 1).toUpperCase()

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r bg-white dark:border-white/[0.06] dark:bg-[#1c1e26]">

      {/* ── Marca ── */}
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-5">
        <span className="size-8 shrink-0 overflow-hidden rounded-[9px] bg-white shadow-sm ring-1 ring-black/[0.08] dark:ring-white/[0.1]">
          <img src="/logo.png" alt="Ollow" className="size-full scale-[1.15] object-cover" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[14px] font-semibold tracking-tight text-gray-900 dark:text-white">
            Ollow Automation
          </p>
          <p className="truncate text-[11px] text-gray-400 dark:text-[#9298b2]">
            Importação & Exportação
          </p>
        </div>
      </div>

      {/* ── Divisor ── */}
      <div className="mx-3 mb-1 border-b border-gray-100 dark:border-white/[0.05]" />

      {/* ── Navegação ── */}
      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-px px-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-[8px] px-2.5 py-[7px] text-[13.5px] transition-colors',
                    isActive
                      ? [
                          'font-medium',
                          /* light */ 'bg-brand-50 text-brand-700',
                          /* dark  */ 'dark:bg-white/[0.09] dark:text-white',
                        ]
                      : [
                          /* light */ 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
                          /* dark  */ 'dark:text-[#9298b2] dark:hover:bg-white/[0.05] dark:hover:text-white',
                        ],
                  )
                }
              >
                <Icon size={15} strokeWidth={1.9} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Rodapé ── */}
      <div className="border-t border-gray-100 px-3 py-3 dark:border-white/[0.05]">
        <div className="flex items-center gap-2.5 rounded-[9px] px-2 py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-brand-400 to-brand-600 text-[12px] font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-gray-700 dark:text-[#d6d8e0]">
              {user?.full_name}
            </p>
            <p className="truncate text-[11px] text-gray-400 dark:text-[#9298b2]">
              {user?.email}
            </p>
          </div>
          <button
            onClick={logout}
            aria-label="Sair"
            title="Sair"
            className="rounded-[7px] p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-[#9298b2] dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            <LogOut size={14} strokeWidth={1.9} />
          </button>
        </div>
      </div>
    </aside>
  )
}
