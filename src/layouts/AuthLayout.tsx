import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Moskit</h1>
          <p className="text-sm text-gray-500">Export System</p>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
