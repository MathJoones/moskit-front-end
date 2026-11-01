import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, Plus, X, RefreshCw, Filter, ChevronDown, Download } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { importService } from '@/services/import.service'
import type { ImportEntityType, ImportListItem } from '@/types/import.types'

// ── Labels ──────────────────────────────────────────────────────────────────

const ENTITY_LABELS: Record<ImportEntityType, string> = {
  contact: 'Contatos',
  company: 'Empresas',
  deal:    'Negócios',
}

// ── Status config (pill + bar) ───────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; pill: string; bar: string }> = {
  pending:    { label: 'Aguardando',  pill: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',    bar: 'bg-yellow-400' },
  processing: { label: 'Processando', pill: 'bg-brand-500/15 text-brand-700 dark:text-brand-400',       bar: 'bg-brand-400' },
  completed:  { label: 'Concluído',   pill: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-400' },
  cancelled:  { label: 'Cancelado',   pill: 'bg-gray-500/15 text-gray-600 dark:text-gray-400',          bar: 'bg-gray-400' },
  error:      { label: 'Com erros',   pill: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',    bar: 'bg-orange-400' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Stat cell (small text inside expanded panel) ─────────────────────────────

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

// ── ImportRow ────────────────────────────────────────────────────────────────

interface ImportRowProps {
  imp: ImportListItem
  onNavigate: (id: string) => void
}

function ImportRow({ imp, onNavigate }: ImportRowProps) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const st = STATUS_CONFIG[imp.status] ?? {
    label: imp.status,
    pill: 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400',
    bar: 'bg-gray-300',
  }

  const isFinished = imp.status === 'completed' || imp.status === 'error' || imp.status === 'cancelled'
  const total      = imp.total_rows ?? 0
  const successPct = total > 0 ? Math.round((imp.created / total) * 100) : 0
  const errorPct   = total > 0 ? Math.round((imp.errors  / total) * 100) : 0

  async function handleDownloadErrors() {
    if (downloading) return
    setDownloading(true)
    try {
      const { blob, filename } = await importService.downloadResult(imp.id, 'error')
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <li className="bg-white dark:bg-[#1c1e26]">

      {/* ── Collapsed header ── */}
      <button
        className="relative w-full cursor-pointer px-5 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">

          {/* Icon */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/[0.12] text-violet-400">
            <Upload size={16} />
          </div>

          {/* Name + subtitle */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{imp.name}</p>
            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
              {fmtTime(imp.created_at)}
              {` · ${ENTITY_LABELS[imp.entity_type]}`}
              {imp.total_rows !== null ? ` · ${imp.total_rows.toLocaleString('pt-BR')} linhas` : ''}
              {imp.input_file_name ? ` · ${imp.input_file_name}` : ''}
            </p>

            {/* Processing progress bar below subtitle */}
            {imp.status === 'processing' && (
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all duration-500"
                  style={{ width: `${imp.progress_pct}%` }}
                />
              </div>
            )}
          </div>

          {/* Right: counters + ratio bar + pill + chevron */}
          <div className="flex shrink-0 items-center gap-2">
            {isFinished && total > 0 && (
              <span className="font-mono text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                <span className="text-emerald-500">{imp.created.toLocaleString('pt-BR')}</span>
                {imp.errors > 0 && (
                  <> · <span className="text-orange-400">{imp.errors.toLocaleString('pt-BR')}</span></>
                )}
              </span>
            )}

            {isFinished && total > 0 && (
              <div
                className="h-[5px] w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]"
                title={`${successPct}% sucesso · ${errorPct}% erros`}
              >
                <div className="flex h-full">
                  <div className="h-full bg-emerald-400 transition-all" style={{ width: `${successPct}%` }} />
                  <div className="h-full bg-orange-400 transition-all"  style={{ width: `${errorPct}%` }} />
                </div>
              </div>
            )}

            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.pill}`}>
              {st.label}
            </span>

            <ChevronDown
              size={14}
              className={`text-gray-400 transition-transform duration-200 dark:text-gray-500 ${open ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        {/* Bottom accent bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px]">
          <div className={`h-full ${st.bar} opacity-30`} />
        </div>
      </button>

      {/* ── Expanded panel ── */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50/80 dark:border-white/[0.04] dark:bg-[#15161d]">

          {/* Stats grid — 4 cols */}
          <div className="grid grid-cols-4 gap-px border-b border-gray-100 bg-gray-100 dark:border-white/[0.04] dark:bg-white/[0.04]">
            {[
              { label: 'TOTAL',      value: imp.total_rows ?? '—', color: 'text-gray-800 dark:text-gray-100' },
              { label: 'SUCESSO',    value: imp.created,           color: 'text-emerald-500' },
              { label: 'ERROS',      value: imp.errors,            color: imp.errors > 0 ? 'text-orange-400' : 'text-gray-400 dark:text-gray-500' },
              { label: 'DUPLICATAS', value: imp.duplicates,        color: 'text-yellow-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-50 px-4 py-3 dark:bg-[#15161d]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {label}
                </p>
                <p className={`mt-1 font-mono text-xl font-bold tabular-nums ${color}`}>
                  {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
                </p>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-2 gap-4 border-b border-gray-100 px-4 py-3 dark:border-white/[0.04] sm:grid-cols-4">
            <StatCell label="Início"   value={fmtDateTime(imp.started_at ?? imp.created_at)} />
            <StatCell label="Fim"      value={imp.completed_at ? fmtDateTime(imp.completed_at) : '—'} />
            <StatCell label="Duração"  value={calcDuration(imp.started_at, imp.completed_at)} />
            <StatCell label="Arquivo"  value={imp.input_file_name ?? '—'} />
          </div>

          {/* Configuração badges */}
          <div className="border-b border-gray-100 px-4 py-3 dark:border-white/[0.04]">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Configuracao
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11.5px] text-gray-600 dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-gray-300">
                <span className="font-medium text-gray-400 dark:text-gray-500">Entidade:</span>{' '}
                {ENTITY_LABELS[imp.entity_type]}
              </span>
              {imp.input_file_name && (
                <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11.5px] text-gray-600 dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-gray-300">
                  <span className="font-medium text-gray-400 dark:text-gray-500">Arquivo:</span>{' '}
                  {imp.input_file_name}
                </span>
              )}
            </div>
          </div>

          {/* Erros section */}
          {isFinished && imp.errors > 0 && (
            <div className="border-b border-gray-100 px-4 py-3 dark:border-white/[0.04]">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-500 dark:text-orange-400">
                  Erros ({imp.errors.toLocaleString('pt-BR')})
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); void handleDownloadErrors() }}
                  disabled={downloading}
                  className="inline-flex items-center gap-1 text-[11.5px] font-medium text-orange-500 transition-colors hover:text-orange-600 disabled:opacity-50 dark:text-orange-400 dark:hover:text-orange-300"
                >
                  {downloading
                    ? <span className="size-3 animate-spin rounded-full border border-orange-400 border-t-transparent" />
                    : <Download size={12} />
                  }
                  Baixar CSV de erros
                </button>
              </div>
            </div>
          )}

          {/* Footer — navigate to detail */}
          <div className="px-4 py-3">
            <button
              onClick={() => onNavigate(imp.id)}
              className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Ver detalhes completos &rarr;
            </button>
          </div>

        </div>
      )}
    </li>
  )
}

// ── Filters ──────────────────────────────────────────────────────────────────

interface ImportFilters {
  status: string
  entity_type: string
  date_from: string
  date_to: string
}

const EMPTY_FILTERS: ImportFilters = { status: '', entity_type: '', date_from: '', date_to: '' }

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters]         = useState<ImportFilters>(EMPTY_FILTERS)

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
    <div className="space-y-6 rise-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Importar Dados</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Importe contatos, empresas ou negócios em massa via CSV ou XLSX
          </p>
        </div>
        <Button onClick={() => navigate('/imports/new')}>
          <Plus size={16} /> Nova Importação
        </Button>
      </div>

      {/* Lista */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.06] dark:bg-[#1c1e26]">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-white/[0.06]">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Histórico de Importações</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 text-xs transition-colors ${
                hasFilters
                  ? 'font-medium text-brand-600 dark:text-brand-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {hasFilters ? <X size={13} /> : <Filter size={13} />}
              {hasFilters ? 'Filtros ativos' : 'Filtros'}
            </button>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['imports'] })}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <RefreshCw size={13} /> Atualizar
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-3 dark:border-white/[0.04] dark:bg-white/[0.02]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Status</label>
                <select
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs dark:border-white/[0.1] dark:bg-[#20222d] dark:text-gray-200"
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
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Entidade</label>
                <select
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs dark:border-white/[0.1] dark:bg-[#20222d] dark:text-gray-200"
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
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">De</label>
                <input
                  type="date"
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs dark:border-white/[0.1] dark:bg-[#20222d] dark:text-gray-200"
                  value={filters.date_from}
                  onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Até</label>
                <input
                  type="date"
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs dark:border-white/[0.1] dark:bg-[#20222d] dark:text-gray-200"
                  value={filters.date_to}
                  onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
                />
              </div>
            </div>
            {hasFilters && (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="mt-2 text-xs text-brand-600 hover:underline dark:text-brand-400"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-gray-100 dark:bg-white/[0.04]" />
            ))}
          </div>
        ) : imports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rise-in">
            <span className="flex size-14 items-center justify-center rounded-full bg-violet-500/10">
              <Upload size={22} className="text-violet-500 dark:text-violet-400" />
            </span>
            <p className="mt-4 text-[15px] font-semibold text-gray-700 dark:text-gray-200">
              Nenhuma importação ainda
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              Clique em "Nova Importação" para começar
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/[0.04] stagger-children">
            {imports.map((imp) => (
              <ImportRow
                key={imp.id}
                imp={imp}
                onNavigate={(id) => navigate(`/imports/${id}`)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
