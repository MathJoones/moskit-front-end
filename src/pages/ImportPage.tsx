import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, Plus, X, RefreshCw, ArrowRight, Filter } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { importService } from '@/services/import.service'
import type { ImportEntityType, ImportListItem } from '@/types/import.types'

const ENTITY_LABELS: Record<ImportEntityType, string> = {
  contact: 'Contatos',
  company: 'Empresas',
  deal:    'Negócios',
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed:  'bg-green-100 text-green-800',
  cancelled:  'bg-gray-100 text-gray-600',
  error:      'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  pending:    'Aguardando',
  processing: 'Processando...',
  completed:  'Concluído',
  cancelled:  'Cancelado',
  error:      'Erro',
}

interface ImportFilters {
  status: string
  entity_type: string
  date_from: string
  date_to: string
}

const EMPTY_FILTERS: ImportFilters = { status: '', entity_type: '', date_from: '', date_to: '' }

export default function ImportPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<ImportFilters>(EMPTY_FILTERS)

  const hasFilters = Object.values(filters).some((v) => v !== '')

  const activeFilters = {
    status:      filters.status      || undefined,
    entity_type: filters.entity_type || undefined,
    date_from:   filters.date_from   || undefined,
    date_to:     filters.date_to     || undefined,
  }

  const { data: importsData, isLoading } = useQuery({
    queryKey: ['imports', activeFilters],
    queryFn: () => importService.list(1, 20, activeFilters),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? []
      const hasActive = items.some((i) => i.status === 'pending' || i.status === 'processing')
      return hasActive ? 3000 : false
    },
  })

  const imports: ImportListItem[] = importsData?.items ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Importar Dados</h2>
          <p className="text-sm text-gray-500">
            Importe contatos, empresas ou negócios em massa via CSV ou XLSX
          </p>
        </div>
        <Button onClick={() => navigate('/imports/new')}>
          <Plus size={16} /> Nova Importação
        </Button>
      </div>

      {/* Lista */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-700">Histórico de Importações</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 text-xs transition-colors ${
                hasFilters ? 'font-medium text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {hasFilters ? <X size={13} /> : <Filter size={13} />}
              {hasFilters ? 'Filtros ativos' : 'Filtros'}
            </button>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['imports'] })}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              <RefreshCw size={13} /> Atualizar
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Status</label>
                <select
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="">Todos</option>
                  <option value="pending">Aguardando</option>
                  <option value="processing">Processando</option>
                  <option value="completed">Concluído</option>
                  <option value="error">Erro</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Entidade</label>
                <select
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={filters.entity_type}
                  onChange={(e) => setFilters((f) => ({ ...f, entity_type: e.target.value }))}
                >
                  <option value="">Todas</option>
                  <option value="contact">Contatos</option>
                  <option value="company">Empresas</option>
                  <option value="deal">Negócios</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">De</label>
                <input
                  type="date"
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={filters.date_from}
                  onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Até</label>
                <input
                  type="date"
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={filters.date_to}
                  onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
                />
              </div>
            </div>
            {hasFilters && (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="mt-2 text-xs text-indigo-600 hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : imports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Upload size={32} className="text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">Nenhuma importação ainda</p>
            <p className="text-xs text-gray-400">Clique em "Nova Importação" para começar</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {imports.map((imp) => (
              <li
                key={imp.id}
                className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50"
                onClick={() => navigate(`/imports/${imp.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{imp.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{ENTITY_LABELS[imp.entity_type]}</span>
                    {imp.total_rows !== null && (
                      <><span>·</span><span>{imp.total_rows.toLocaleString('pt-BR')} linhas</span></>
                    )}
                    {imp.status === 'processing' && (
                      <><span>·</span><span className="text-blue-600">{imp.progress_pct}%</span></>
                    )}
                    {imp.status === 'completed' && (
                      <>
                        <span>·</span>
                        <span className="text-green-600">{imp.created} criados</span>
                        {imp.duplicates > 0 && <><span>·</span><span className="text-yellow-600">{imp.duplicates} duplicatas</span></>}
                        {imp.errors > 0 && <><span>·</span><span className="text-red-600">{imp.errors} erros</span></>}
                      </>
                    )}
                    <span>·</span>
                    <span>{new Date(imp.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {imp.status === 'processing' && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${imp.progress_pct}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[imp.status] ?? ''}`}>
                    {STATUS_LABELS[imp.status] ?? imp.status}
                  </span>
                  <ArrowRight size={14} className="text-gray-400" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
