import { Outlet } from 'react-router-dom'
import { Logo } from '@/components/Logo'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="mb-5 h-20 w-auto drop-shadow-[0_8px_30px_rgba(16,185,129,0.25)]" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            Ollow Automation
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Importação & Exportação
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  )
}