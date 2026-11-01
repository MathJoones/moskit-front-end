import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, RefreshCw, Plus, X, Filter, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { exportService } from '@/services/export.service'
import { connectionService } from '@/services/connection.service'
import { extractErrorMessage } from '@/services/api'
import type { ExportListItem, EntityType, ExportFormat } from '@/types/export.types'

// ── Schema ─────────────────────────────────────────────────
const exportSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(255),
  entity_type: z.enum(['deal', 'contact', 'company', 'activity'] as const),
  connection_id: z.string().uuid('Selecione uma conexão'),
  output_format: z.enum(['csv', 'xlsx', 'json'] as const),
})

type ExportForm = z.infer<typeof exportSchema>

// ── Labels ─────────────────────────────────────────────────
const ENTITY_LABELS: Record<EntityType, string> = {
  deal:     'Negócios (Deals)',
  contact:  'Contatos (People)',
  company:  'Empresas (Companies)',
  activity: 'Atividades',
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv:  'CSV',
  xlsx: 'Excel (XLSX)',
  json: 'JSON',
}

const STATUS_CONFIG: Record<string, { label: string; pill: string; bar: string }> = {
  pending:    { label: 'Aguardando',  pill: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',    bar: 'bg-yellow-400' },
  processing: { label: 'Processando', pill: 'bg-brand-500/15 text-brand-700 dark:text-brand-400',       bar: 'bg-brand-400' },
  completed:  { label: 'Concluído',   pill: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-400' },
  failed:     { label: 'Falhou',      pill: 'bg-red-500/15 text-red-600 dark:text-red-400',             bar: 'bg-red-400' },
}

// ── Helpers ─────────────────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function calcDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms <= 0) return '—'
  const secs = Math.floor(ms / 1000)
  const mins = Math.floor(secs / 60)
  const hrs = Math.floor(mins / 60)
  if (hrs > 0) return `${hrs}h ${String(mins % 60).padStart(2, '0')}min`
  if (mins > 0) return `${mins}min ${String(secs % 60).padStart(2, '0')}s`
  return `${secs}s`
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </p>
    </div>
  )
}

// ── ExportRow ───────────────────────────────────────────────
interface ExportRowProps {
  exp: ExportListItem
  onDownload: (id: string) => void
}

function ExportRow({ exp, onDownload }: ExportRowProps) {
  const [open, setOpen] = useState(false)
  const st = STATUS_CONFIG[exp.status] ?? STATUS_CONFIG.failed

  return (
    <div>
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
      >
        {/* Icon box */}
        <span className="flex shrink-0 size-8 items-center justify-center rounded-lg bg-emerald-500/[0.12] text-emerald-400">
          <Download size={16} />
        </span>

        {/* Center info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{exp.name}</p>
          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
            {fmtTime(exp.created_at)}
            {' · '}
            {ENTITY_LABELS[exp.entity_type]}
            {' · '}
            {FORMAT_LABELS[exp.output_format]}
            {exp.total_records ? ` · ${exp.total_records.toLocaleString('pt-BR')} registros` : ''}
          </p>
        </div>

        {/* Right cluster */}
        <div className="flex shrink-0 items-center gap-2">
          {exp.status === 'completed' && exp.total_records != null && exp.total_records > 0 && (
            <span className="text-sm font-semibold font-mono tabular-nums text-emerald-500">
              {exp.total_records.toLocaleString('pt-BR')}
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.pill}`}>
            {st.label}
          </span>
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>

        {/* Accent bar */}
        <span className={`absolute bottom-0 left-0 right-0 h-[2px] ${st.bar} opacity-30`} />
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-gray-100 dark:border-white/[0.04]">

          {/* Stats grid */}
          <div className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-white/[0.04]">
            {/* TOTAL */}
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Total
              </p>
              <p className="mt-1 text-xl font-bold font-mono tabular-nums text-gray-700 dark:text-gray-200">
                {exp.total_records != null ? exp.total_records.toLocaleString('pt-BR') : '—'}
              </p>
            </div>

            {/* FORMATO */}
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Formato
              </p>
              <p className="mt-1 text-xl font-bold font-mono tabular-nums text-gray-700 dark:text-gray-200">
                {FORMAT_LABELS[exp.output_format]}
              </p>
            </div>

            {/* STATUS */}
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Status
              </p>
              <p className={`mt-1 text-xl font-bold font-mono tabular-nums ${st.pill.split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>
                {st.label}
              </p>
            </div>

            {/* ARQUIVO */}
            <div className="px-4 py-3 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Arquivo
              </p>
              <p className="mt-1 text-xl font-bold font-mono tabular-nums text-gray-700 dark:text-gray-200 truncate">
                {exp.output_file_name ?? '—'}
              </p>
            </div>
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 px-4 py-3 dark:border-white/[0.04] sm:grid-cols-4">
            <StatCell label="Início" value={fmtDateTime(exp.started_at ?? exp.created_at)} />
            <StatCell label="Fim" value={exp.completed_at ? fmtDateTime(exp.completed_at) : '—'} />
            <StatCell label="Duração" value={calcDuration(exp.started_at, exp.completed_at)} />
            <StatCell label="Arquivo" value={exp.output_file_name ?? '—'} />
          </div>

          {/* Configuração */}
          <div className="border-t border-gray-100 px-4 py-3 dark:border-white/[0.04]">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Configuração
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11.5px] text-gray-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300">
                Entidade: {ENTITY_LABELS[exp.entity_type]}
              </span>
              <span className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11.5px] text-gray-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300">
                Formato: {FORMAT_LABELS[exp.output_format]}
              </span>
            </div>
          </div>

          {/* Error section */}
          {exp.status === 'failed' && exp.error_message && (
            <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.04]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400 mb-1">Erro</p>
              <p className="text-xs text-red-500 dark:text-red-400 font-mono">{exp.error_message}</p>
            </div>
          )}

          {/* Download footer */}
          {exp.status === 'completed' && (
            <div className="px-4 py-3">
              <button
                onClick={() => onDownload(exp.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
              >
                <Download size={12} /> Baixar arquivo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Filters ─────────────────────────────────────────────────
interface ExportFilters {
  status: string
  entity_type: string
  date_from: string
  date_to: string
}

const EMPTY_EXPORT_FILTERS: ExportFilters = { status: '', entity_type: '', date_from: '', date_to: '' }

// ── Page ────────────────────────────────────────────────────
export default function ExportPage() {
  const [showForm, setShowForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [exportFilters, setExportFilters] = useState<ExportFilters>(EMPTY_EXPORT_FILTERS)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const hasFilters = Object.values(exportFilters).some((v) => v !== '')

  const activeFilters = {
    status: exportFilters.status || undefined,
    entity_type: exportFilters.entity_type || undefined,
    date_from: exportFilters.date_from || undefined,
    date_to: exportFilters.date_to || undefined,
  }

  const { data: exportsData, isLoading: loadingExports } = useQuery({
    queryKey: ['exports', activeFilters],
    queryFn: () => exportService.list(1, 20, activeFilters),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? []
      const hasProcessing = items.some((e) => e.status === 'pending' || e.status === 'processing')
      return hasProcessing ? 5000 : false
    },
  })

  const { data: connections, isLoading: loadingConnections } = useQuery({
    queryKey: ['connections'],
    queryFn: () => connectionService.list(),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExportForm>({
    resolver: zodResolver(exportSchema),
    defaultValues: { entity_type: 'deal', output_format: 'xlsx' },
  })

  const createMutation = useMutation({
    mutationFn: exportService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exports'] })
      reset()
      setShowForm(false)
      setError(null)
    },
    onError: (err: unknown) => setError(extractErrorMessage(err, 'Erro ao criar exportação')),
  })

  const onSubmit = (data: ExportForm) => {
    setError(null)
    createMutation.mutate(data)
  }

  const handleDownload = async (id: string) => {
    try {
      const { blob, filename } = await exportService.download(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Erro ao baixar arquivo. Tente novamente.')
    }
  }

  const exports: ExportListItem[] = exportsData?.items ?? []

  return (
    <div className="space-y-6 rise-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Exportar Dados</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gere arquivos CSV, XLSX ou JSON a partir dos dados do Moskit CRM
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? 'secondary' : 'primary'}>
          {showForm ? (
            <>
              <X size={16} /> Cancelar
            </>
          ) : (
            <>
              <Plus size={16} /> Nova Exportação
            </>
          )}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.06] dark:bg-[#1c1e26]">
          <h3 className="mb-4 text-sm font-semibold text-gray-800 dark:text-white">Nova Exportação</h3>

          {error && (
            <Alert variant="error" className="mb-4" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Nome */}
              <div className="sm:col-span-2">
                <Input
                  label="Nome"
                  placeholder="Ex: Leads Junho 2026"
                  error={errors.name?.message}
                  {...register('name')}
                />
              </div>

              {/* Entidade */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Entidade</label>
                <select
                  className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-white/[0.1] dark:bg-[#20222d] dark:text-gray-100"
                  {...register('entity_type')}
                >
                  {(Object.entries(ENTITY_LABELS) as [EntityType, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                {errors.entity_type && (
                  <p className="text-xs text-red-600">{errors.entity_type.message}</p>
                )}
              </div>

              {/* Formato */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Formato</label>
                <select
                  className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-white/[0.1] dark:bg-[#20222d] dark:text-gray-100"
                  {...register('output_format')}
                >
                  {(Object.entries(FORMAT_LABELS) as [ExportFormat, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Conexão */}
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Conexão Moskit</label>
                {loadingConnections ? (
                  <div className="h-9 animate-pulse rounded-md bg-gray-100" />
                ) : (
                  <select
                    className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500 dark:border-white/[0.1] dark:bg-[#20222d] dark:text-gray-100"
                    {...register('connection_id')}
                  >
                    <option value="">Selecione uma conexão...</option>
                    {(connections ?? [])
                      .filter((c) => c.is_active)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                )}
                {errors.connection_id && (
                  <p className="text-xs text-red-600">{errors.connection_id.message}</p>
                )}
                {!loadingConnections && (connections ?? []).filter((c) => c.is_active).length === 0 && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Nenhuma conexão ativa. Cadastre uma em <strong>Conexões</strong>.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => { reset(); setShowForm(false) }}>
                Cancelar
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Gerar Exportação
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Stats bar */}
      {!loadingExports && exports.length > 0 && (
        <div className="flex flex-wrap items-center gap-4">
          {[
            { label: 'Total',       value: exportsData?.total ?? exports.length,                                                color: 'text-gray-700 dark:text-gray-200' },
            { label: 'Concluídos',  value: exports.filter((e) => e.status === 'completed').length,                              color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Processando', value: exports.filter((e) => e.status === 'pending' || e.status === 'processing').length,   color: 'text-brand-600 dark:text-brand-400' },
            { label: 'Falhos',      value: exports.filter((e) => e.status === 'failed').length,                                 color: 'text-red-500 dark:text-red-400' },
          ]
            .filter((s) => s.label === 'Total' || s.value > 0)
            .map((s) => (
              <div key={s.label} className="flex items-center gap-1.5 text-xs">
                <span className={`text-sm font-semibold tabular-nums ${s.color}`}>{s.value}</span>
                <span className="text-gray-400 dark:text-gray-500">{s.label}</span>
              </div>
            ))}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.06] dark:bg-[#1c1e26]">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-white/[0.06]">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Histórico de Exportações</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 text-xs transition-colors ${
                hasFilters ? 'font-medium text-brand-600 dark:text-brand-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {hasFilters ? <X size={13} /> : <Filter size={13} />}
              {hasFilters ? 'Filtros ativos' : 'Filtros'}
            </button>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['exports'] })}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <RefreshCw size={13} /> Atualizar
            </button>
          </div>
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-3 dark:border-white/[0.04] dark:bg-white/[0.02]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Status</label>
                <select
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs dark:border-white/[0.1] dark:bg-[#20222d] dark:text-gray-200"
                  value={exportFilters.status}
                  onChange={(e) => setExportFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="">Todos</option>
                  <option value="pending">Aguardando</option>
                  <option value="processing">Processando</option>
                  <option value="completed">Concluído</option>
                  <option value="failed">Falhou</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Entidade</label>
                <select
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs dark:border-white/[0.1] dark:bg-[#20222d] dark:text-gray-200"
                  value={exportFilters.entity_type}
                  onChange={(e) => setExportFilters((f) => ({ ...f, entity_type: e.target.value }))}
                >
                  <option value="">Todas</option>
                  <option value="contact">Contatos</option>
                  <option value="company">Empresas</option>
                  <option value="deal">Negócios</option>
                  <option value="activity">Atividades</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">De</label>
                <input
                  type="date"
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs dark:border-white/[0.1] dark:bg-[#20222d] dark:text-gray-200"
                  value={exportFilters.date_from}
                  onChange={(e) => setExportFilters((f) => ({ ...f, date_from: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Até</label>
                <input
                  type="date"
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs dark:border-white/[0.1] dark:bg-[#20222d] dark:text-gray-200"
                  value={exportFilters.date_to}
                  onChange={(e) => setExportFilters((f) => ({ ...f, date_to: e.target.value }))}
                />
              </div>
            </div>
            {hasFilters && (
              <button
                onClick={() => setExportFilters(EMPTY_EXPORT_FILTERS)}
                className="mt-2 text-xs text-brand-600 hover:underline dark:text-brand-400"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {loadingExports ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-gray-100 dark:bg-white/[0.04]" />
            ))}
          </div>
        ) : exports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rise-in">
            <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
              <Download size={22} className="text-emerald-500 dark:text-emerald-400" />
            </span>
            <p className="mt-4 text-[15px] font-semibold text-gray-700 dark:text-gray-200">
              Nenhuma exportação ainda
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              Clique em "Nova Exportação" para começar
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/[0.04] stagger-children">
            {exports.map((exp) => (
              <ExportRow key={exp.id} exp={exp} onDownload={handleDownload} />
            ))}
          </div>
        )}

        {exportsData && exportsData.total > exportsData.page_size && (
          <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400 dark:border-white/[0.04] dark:text-gray-500">
            Mostrando {exports.length} de {exportsData.total} exportações
          </div>
        )}
      </div>
    </div>
  )
}
