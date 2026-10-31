import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Download,
  Upload,
  Link2,
  Database,
  ArrowRight,
  Filter,
  X,
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { dashboardService } from '@/services/dashboard.service'
import { exportService } from '@/services/export.service'
import { importService } from '@/services/import.service'
import type { ExportListItem } from '@/types/export.types'
import type { ImportListItem } from '@/types/import.types'

// ── Labels compartilhados ────────────────────────────────────
const ENTITY_LABELS: Record<string, string> = {
  contact:  'Contatos',
  company:  'Empresas',
  deal:     'Negócios',
  activity: 'Atividades',
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed:  'bg-green-100 text-green-800',
  cancelled:  'bg-gray-100 text-gray-600',
  failed:     'bg-red-100 text-red-800',
  error:      'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  pending:    'Aguardando',
  processing: 'Processando',
  completed:  'Concluído',
  cancelled:  'Cancelado',
  failed:     'Falhou',
  error:      'Erro',
}

// ── Tipos locais ─────────────────────────────────────────────
type ActivityKind = 'export' | 'import'

interface ActivityItem {
  id: string
  kind: ActivityKind
  name: string
  entity_type: string
  status: string
  records: number | null
  created_at: string
}

function toActivity(item: ExportListItem): ActivityItem {
  return {
    id: item.id,
    kind: 'export',
    name: item.name,
    entity_type: item.entity_type,
    status: item.status,
    records: item.total_records,
    created_at: item.created_at,
  }
}

function toActivityImport(item: ImportListItem): ActivityItem {
  return {
    id: item.id,
    kind: 'import',
    name: item.name,
    entity_type: item.entity_type,
    status: item.status,
    records: item.total_rows,
    created_at: item.created_at,
  }
}

// ── Filtros ──────────────────────────────────────────────────
interface Filters {
  kind: '' | 'export' | 'import'
  status: string
  entity_type: string
  date_from: string
  date_to: string
}

const EMPTY_FILTERS: Filters = {
  kind: '',
  status: '',
  entity_type: '',
  date_from: '',
  date_to: '',
}

// ── Stat card ────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-gray-900">{value.toLocaleString('pt-BR')}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

// ── Component principal ──────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)

  // Stats
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardService.getStats,
    refetchInterval: 30_000,
  })

  // Exports recentes (últimos 50 para merge local com imports)
  const exportFilters = {
    status: filters.status || undefined,
    entity_type: filters.entity_type || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
  }

  const { data: exportsData } = useQuery({
    queryKey: ['dashboard-exports', exportFilters],
    queryFn: () => exportService.list(1, 50, exportFilters),
    enabled: filters.kind !== 'import',
  })

  const { data: importsData } = useQuery({
    queryKey: ['dashboard-imports', exportFilters],
    queryFn: () => importService.list(1, 50, exportFilters),
    enabled: filters.kind !== 'export',
  })

  // Merge e ordena por data desc
  const activity: ActivityItem[] = [
    ...(filters.kind !== 'import' ? (exportsData?.items ?? []).map(toActivity) : []),
    ...(filters.kind !== 'export' ? (importsData?.items ?? []).map(toActivityImport) : []),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const hasFilters = Object.values(filters).some((v) => v !== '')

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Dashboard</h2>
        <p className="text-sm text-gray-500">Bem-vindo, {user?.full_name}</p>
      </div>

      {/* Cards de stat */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Conexões ativas"
          value={loadingStats ? '—' : (stats?.active_connections ?? 0)}
          icon={Link2}
          color="bg-indigo-500"
        />
        <StatCard
          label="Exportações"
          value={loadingStats ? '—' : (stats?.total_exports ?? 0)}
          sub={`${stats?.exports_completed ?? 0} concluídas · ${stats?.exports_processing ?? 0} em andamento`}
          icon={Download}
          color="bg-sky-500"
        />
        <StatCard
          label="Importações"
          value={loadingStats ? '—' : (stats?.total_imports ?? 0)}
          sub={`${stats?.imports_completed ?? 0} concluídas · ${stats?.imports_processing ?? 0} em andamento`}
          icon={Upload}
          color="bg-violet-500"
        />
        <StatCard
          label="Registros movimentados"
          value={
            loadingStats
              ? '—'
              : (stats?.total_records_exported ?? 0) + (stats?.total_records_imported ?? 0)
          }
          sub={`${(stats?.total_records_exported ?? 0).toLocaleString('pt-BR')} exp · ${(stats?.total_records_imported ?? 0).toLocaleString('pt-BR')} imp`}
          icon={Database}
          color="bg-emerald-500"
        />
      </div>

      {/* Histórico de atividades */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Cabeçalho da tabela */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-700">Histórico de Atividades</h3>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              hasFilters
                ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {hasFilters ? <X size={13} /> : <Filter size={13} />}
            {showFilters ? 'Fechar' : hasFilters ? 'Filtros ativos' : 'Filtros'}
          </button>
        </div>

        {/* Painel de filtros */}
        {showFilters && (
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {/* Tipo */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Tipo</label>
                <select
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs outline-none focus:border-indigo-400"
                  value={filters.kind}
                  onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value as Filters['kind'] }))}
                >
                  <option value="">Todos</option>
                  <option value="export">Exportação</option>
                  <option value="import">Importação</option>
                </select>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Status</label>
                <select
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs outline-none focus:border-indigo-400"
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="">Todos</option>
                  <option value="pending">Aguardando</option>
                  <option value="processing">Processando</option>
                  <option value="completed">Concluído</option>
                  <option value="error">Erro</option>
                  <option value="failed">Falhou</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              {/* Entidade */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Entidade</label>
                <select
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs outline-none focus:border-indigo-400"
                  value={filters.entity_type}
                  onChange={(e) => setFilters((f) => ({ ...f, entity_type: e.target.value }))}
                >
                  <option value="">Todas</option>
                  <option value="contact">Contatos</option>
                  <option value="company">Empresas</option>
                  <option value="deal">Negócios</option>
                  <option value="activity">Atividades</option>
                </select>
              </div>

              {/* Data início */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">De</label>
                <input
                  type="date"
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs outline-none focus:border-indigo-400"
                  value={filters.date_from}
                  onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
                />
              </div>

              {/* Data fim */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Até</label>
                <input
                  type="date"
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs outline-none focus:border-indigo-400"
                  value={filters.date_to}
                  onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
                />
              </div>
            </div>

            {hasFilters && (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="mt-3 text-xs text-indigo-600 hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {/* Lista de atividades */}
        {activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Database size={32} className="text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">
              {hasFilters ? 'Nenhuma atividade para os filtros selecionados' : 'Nenhuma atividade ainda'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {activity.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3.5 hover:bg-gray-50"
                onClick={() =>
                  navigate(item.kind === 'import' ? `/imports/${item.id}` : '/export')
                }
              >
                {/* Ícone de tipo */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                    item.kind === 'export'
                      ? 'bg-sky-50 text-sky-600'
                      : 'bg-violet-50 text-violet-600'
                  }`}
                >
                  {item.kind === 'export' ? <Download size={15} /> : <Upload size={15} />}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{item.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      item.kind === 'export' ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'
                    }`}>
                      {item.kind === 'export' ? 'Exportação' : 'Importação'}
                    </span>
                    <span>·</span>
                    <span>{ENTITY_LABELS[item.entity_type] ?? item.entity_type}</span>
                    {item.records !== null && (
                      <><span>·</span><span>{item.records.toLocaleString('pt-BR')} registros</span></>
                    )}
                    <span>·</span>
                    <span>{fmtDate(item.created_at)}</span>
                  </div>
                </div>

                {/* Status + seta */}
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] ?? ''}`}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                  <ArrowRight size={14} className="text-gray-400" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Rodapé com contagem */}
        {activity.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-2.5 text-xs text-gray-400">
            {activity.length} atividade{activity.length !== 1 ? 's' : ''} exibida{activity.length !== 1 ? 's' : ''}
            {hasFilters && ' (filtros ativos)'}
          </div>
        )}
      </div>
    </div>
  )
}
