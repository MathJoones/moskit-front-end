import { useAuth } from '@/hooks/useAuth'

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800">
        Bem-vindo, {user?.full_name}
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Sistema de Exportação Moskit CRM
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { label: 'Exportações geradas',  value: '—' },
          { label: 'Conexões ativas',      value: '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
