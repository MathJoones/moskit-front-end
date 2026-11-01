import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  FileDown,
  FileUp,
  Database,
  RefreshCw,
  Search,
  ChevronDown,
  Download,
} from 'lucide-react'
import { Segmented } from '@/components/ui/Segmented'

import { useAuth } from '@/hooks/useAuth'
import { exportService } from '@/services/export.service'
import { importService } from '@/services/import.service'
import type { ExportListItem } from '@/types/export.types'
import type { ImportListItem } from '@/types/import.types'

// ── Labels ───────────────────────────────────────────────────
const ENTITY_LABELS: Record<string, string> = {
  contact:  'Contatos',
  company:  'Empresas',
  deal:     'Negócios',
  activity: 'Atividades',
}

// ── Status ───────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; pill: string; bar: string }> = {
  pending:    { label: 'Aguardando',   pill: 'bg-yellow-500/15 text-yellow-400',    bar: 'bg-yellow-400' },
  processing: { label: 'Processando',  pill: 'bg-blue-500/15 text-blue-400',       bar: 'bg-blue-400' },
  completed:  { label: 'Sucesso',      pill: 'bg-emerald-500/15 text-emerald-400',  bar: 'bg-emerald-400' },
  cancelled:  { label: 'Interrompida', pill: 'bg-orange-500/15 text-orange-400',   bar: 'bg-orange-400' },
  failed:     { label: 'Com erros',    pill: 'bg-orange-500/15 text-orange-400',   bar: 'bg-orange-400' },
  error:      { label: 'Com erros',    pill: 'bg-orange-500/15 text-orange-400',   bar: 'bg-orange-400' },
}

// ── Types ────────────────────────────────────────────────────
type ActivityKind = 'export' | 'import'
type TimeRange = 'today' | '3d' | '7d' | '30d' | 'all'

interface ActivityItem {
  id: string
  kind: ActivityKind
  name: string
  entity_type: string
  status: string
  records: number | null
  created: number
  duplicates: number
  errors: number
  progress_pct: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  file_name: string | null
  output_format?: string | null
}

function toActivity(item: ExportListItem): ActivityItem {
  return {
    id: item.id,
    kind: 'export',
    name: item.name,
    entity_type: item.entity_type,
    status: item.status,
    records: item.total_records,
    created: item.total_records ?? 0,
    duplicates: 0,
    errors: 0,
    progress_pct: item.status === 'completed' ? 100 : 0,
    created_at: item.created_at,
    started_at: item.started_at ?? null,
    completed_at: item.completed_at ?? null,
    file_name: item.output_file_name ?? null,
    output_format: item.output_format,
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
    created: item.created,
    duplicates: item.duplicates,
    errors: item.errors,
    progress_pct: item.progress_pct,
    created_at: item.created_at,
    started_at: item.started_at ?? null,
    completed_at: item.completed_at ?? null,
    file_name: item.input_file_name ?? null,
  }
}

// ── Date helpers ─────────────────────────────────────────────
function groupKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function groupLabel(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86_400_000)
  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (itemDay.getTime() === today.getTime()) return 'HOJE'
  if (itemDay.getTime() === yesterday.getTime()) return 'ONTEM'
  return date
    .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase()
}

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
  const hrs  = Math.floor(mins / 60)
  if (hrs > 0)  return `${hrs}h ${String(mins % 60).padStart(2, '0')}min`
  if (mins > 0) return `${mins}min ${String(secs % 60).padStart(2, '0')}s`
  return `${secs}s`
}

function filterByRange(items: ActivityItem[], range: TimeRange): ActivityItem[] {
  if (range === 'all') return items
  const limits: Record<TimeRange, number> = {
    today: 1, '3d': 3, '7d': 7, '30d': 30, all: Infinity,
  }
  const now = Date.now()
  return items.filter((i) => (now - new Date(i.created_at).getTime()) / 86_400_000 < limits[range])
}

// ── Time tabs ────────────────────────────────────────────────
const TIME_TABS: { key: TimeRange; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '3d',    label: '3d' },
  { key: '7d',    label: '7d' },
  { key: '30d',   label: '30d' },
  { key: 'all',   label: 'Tudo' },
]

// ── Stat cell ────────────────────────────────────────────────
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

// ── Row ──────────────────────────────────────────────────────
function ActivityRow({
  item,
  isLast,
  userEmail,
}: {
  item: ActivityItem
  isLast: boolean
  userEmail?: string
}) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const st = STATUS_CONFIG[item.status] ?? {
    label: item.status,
    pill: 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400',
    bar: 'bg-gray-300',
  }
  const isExport  = item.kind === 'export'
  const iconBg    = isExport
    ? 'bg-emerald-500/[0.12] text-emerald-400'
    : 'bg-violet-500/[0.12] text-violet-400'
  const Icon      = isExport ? FileDown : FileUp
  const isFinished = item.status === 'completed' || item.status === 'error' || item.status === 'failed'
  const total     = item.records ?? 0
  const successPct = total > 0 ? Math.round((item.created / total) * 100) : 0
  const errorPct   = total > 0 ? Math.round((item.errors  / total) * 100) : 0
  const duration  = calcDuration(item.started_at, item.completed_at)

  async function handleDownloadErrors() {
    if (item.kind !== 'import' || downloading) return
    setDownloading(true)
    try {
      const { blob, filename } = await importService.downloadResult(item.id, 'error')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className={`bg-white dark:bg-[#1c1e26] ${!isLast || open ? 'border-b border-gray-100 dark:border-white/[0.04]' : ''}`}>

      {/* ── Collapsed header ── */}
      <button
        className="relative w-full cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
            <Icon size={16} />
          </div>

          {/* Name + subtitle */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
              {fmtTime(item.created_at)}
              {userEmail ? ` · ${userEmail}` : ''}
              {` · ${ENTITY_LABELS[item.entity_type] ?? item.entity_type}`}
              {item.records !== null ? ` (${item.records.toLocaleString('pt-BR')})` : ''}
              {item.file_name ? ` · ${item.file_name}` : ''}
            </p>
          </div>

          {/* Right: counter + bar + pill + chevron */}
          <div className="flex shrink-0 items-center gap-2">
            {/* success · errors counters */}
            {isFinished && total > 0 && (
              <span className="font-mono text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                <span className="text-emerald-500">{item.created.toLocaleString('pt-BR')}</span>
                {item.errors > 0 && (
                  <> · <span className="text-orange-400">{item.errors.toLocaleString('pt-BR')}</span></>
                )}
              </span>
            )}

            {/* Ratio bar */}
            {isFinished && total > 0 && (
              <div
                className="h-[5px] w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]"
                title={`${successPct}% sucesso · ${errorPct}% erros`}
              >
                <div className="flex h-full">
                  <div className="h-full bg-emerald-400 transition-all" style={{ width: `${successPct}%` }} />
                  <div className="h-full bg-orange-400 transition-all" style={{ width: `${errorPct}%` }} />
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

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-px border-b border-gray-100 bg-gray-100 dark:border-white/[0.04] dark:bg-white/[0.04]">
            {[
              { label: 'TOTAL',      value: item.records ?? '—', color: 'text-gray-800 dark:text-gray-100' },
              { label: 'SUCESSO',    value: item.created,        color: 'text-emerald-500' },
              { label: 'ERROS',      value: item.errors,         color: item.errors > 0 ? 'text-orange-400' : 'text-gray-400 dark:text-gray-500' },
              { label: item.kind === 'import' ? 'DUPLICATAS' : 'RETRIES',
                value: item.kind === 'import' ? item.duplicates : 0,
                color: 'text-yellow-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-50 px-4 py-3 dark:bg-[#15161d]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</p>
                <p className={`mt-1 font-mono text-xl font-bold tabular-nums ${color}`}>
                  {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
                </p>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-2 gap-4 px-4 py-3 sm:grid-cols-4 border-b border-gray-100 dark:border-white/[0.04]">
            <StatCell label="Início"     value={item.started_at ? fmtDateTime(item.started_at) : fmtDateTime(item.created_at)} />
            {item.completed_at
              ? <StatCell label="Fim"    value={fmtDateTime(item.completed_at)} />
              : <StatCell label="Fim"    value="—" />
            }
            <StatCell label="Duração"    value={duration} />
            <StatCell label="Quem rodou" value={userEmail ?? '—'} />
          </div>

          {/* Configuração badges */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.04]">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Configuração
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { k: 'Entidade', v: ENTITY_LABELS[item.entity_type] ?? item.entity_type },
                item.kind === 'import' && item.file_name ? { k: 'Arquivo', v: item.file_name } : null,
                item.kind === 'export' && item.output_format ? { k: 'Formato', v: item.output_format.toUpperCase() } : null,
                item.kind === 'export' && item.file_name ? { k: 'Arquivo', v: item.file_name } : null,
              ].filter(Boolean).map((b) => b && (
                <span
                  key={b.k}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11.5px] text-gray-600 dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-gray-300"
                >
                  <span className="font-medium text-gray-400 dark:text-gray-500">{b.k}:</span> {b.v}
                </span>
              ))}
            </div>
          </div>

          {/* Erros section */}
          {item.kind === 'import' && isFinished && item.errors > 0 && (
            <div className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-500 dark:text-orange-400">
                  Erros ({item.errors.toLocaleString('pt-BR')})
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

        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()

  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<'' | 'export' | 'import'>('')
  const [onlyMine, setOnlyMine] = useState(false)

  const { data: exportsData, refetch: refetchExports } = useQuery({
    queryKey: ['dashboard-exports'],
    queryFn: () => exportService.list(1, 100, {}),
    refetchInterval: 30_000,
  })

  const { data: importsData, refetch: refetchImports } = useQuery({
    queryKey: ['dashboard-imports'],
    queryFn: () => importService.list(1, 100, {}),
    refetchInterval: 30_000,
  })

  const allActivity = useMemo<ActivityItem[]>(
    () =>
      [
        ...(exportsData?.items ?? []).map(toActivity),
        ...(importsData?.items ?? []).map(toActivityImport),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [exportsData, importsData],
  )

  const filtered = useMemo(() => {
    let items = filterByRange(allActivity, timeRange)
    if (kindFilter) items = items.filter((i) => i.kind === kindFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (ENTITY_LABELS[i.entity_type] ?? i.entity_type).toLowerCase().includes(q),
      )
    }
    return items
  }, [allActivity, timeRange, kindFilter, search])

  const grouped = useMemo(() => {
    const groups: { key: string; label: string; items: ActivityItem[] }[] = []
    for (const item of filtered) {
      const key = groupKey(item.created_at)
      const g = groups.find((x) => x.key === key)
      if (g) g.items.push(item)
      else groups.push({ key, label: groupLabel(item.created_at), items: [item] })
    }
    return groups
  }, [filtered])

  function handleExportCSV() {
    const rows = [
      ['Tipo', 'Nome', 'Entidade', 'Registros', 'Sucesso', 'Erros', 'Status', 'Data'],
      ...filtered.map((i) => [
        i.kind === 'export' ? 'Exportação' : 'Importação',
        i.name,
        ENTITY_LABELS[i.entity_type] ?? i.entity_type,
        i.records ?? '',
        i.created,
        i.errors,
        STATUS_CONFIG[i.status]?.label ?? i.status,
        new Date(i.created_at).toLocaleString('pt-BR'),
      ]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'historico.csv'
    a.click()
  }

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <div className="space-y-5 rise-in">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Histórico
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Quem rodou cada automação, quando e com qual resultado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { refetchExports(); refetchImports() }}
              className="flex items-center gap-1.5 rounded-[8px] border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.07]"
            >
              <RefreshCw size={12} />
              Atualizar
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-[8px] border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.07]"
            >
              <FileDown size={12} />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Period + "Só minhas" */}
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            options={TIME_TABS.map((t) => ({ value: t.key, label: t.label }))}
            value={timeRange}
            onChange={setTimeRange}
          />
          <button
            onClick={() => setOnlyMine((v) => !v)}
            className={`rounded-[9px] px-3 py-1.5 text-xs font-medium transition-all ${
              onlyMine
                ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300'
                : 'bg-gray-100 text-gray-500 hover:text-gray-800 dark:bg-white/[0.07] dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Só minhas
          </button>
        </div>

        {/* Search + kind filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, entidade..."
              className="h-9 w-full rounded-[8px] border border-gray-200 bg-white pl-8 pr-3 text-xs placeholder:text-gray-400 outline-none transition-colors focus:border-brand-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-brand-500"
            />
          </div>
          <div className="relative">
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as '' | 'export' | 'import')}
              className="h-9 appearance-none rounded-[8px] border border-gray-200 bg-white pl-3 pr-7 text-xs text-gray-600 outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300"
            >
              <option value="">Todas as automações</option>
              <option value="export">Exportação</option>
              <option value="import">Importação</option>
            </select>
            <ChevronDown
              size={12}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>
        </div>

        {/* Grouped list */}
        {grouped.length === 0 && allActivity.length === 0 ? (
          /* Onboarding — truly no data yet */
          <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-white/[0.06] dark:bg-[#1c1e26] rise-in">
            <div className="mx-auto max-w-sm text-center">
              <span className="flex size-14 mx-auto items-center justify-center rounded-full bg-brand-500/10">
                <Database size={24} className="text-brand-500" />
              </span>
              <p className="mt-4 text-[15px] font-semibold text-gray-800 dark:text-white">
                Nenhuma atividade ainda
              </p>
              <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
                Siga os passos abaixo para começar
              </p>
            </div>
            <ol className="mx-auto mt-6 max-w-sm space-y-3">
              {[
                { step: 1, text: 'Configure uma conexão com sua conta Ollow', href: '/connections', cta: 'Ir para Conexões' },
                { step: 2, text: 'Importe contatos, empresas ou negócios via CSV', href: '/imports/new', cta: 'Nova importação' },
                { step: 3, text: 'Exporte dados filtrados do seu CRM', href: '/exports/new', cta: 'Nova exportação' },
              ].map(({ step, text, href, cta }) => (
                <li key={step} className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-white/[0.05]">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
                    {step}
                  </span>
                  <span className="flex-1 text-[13px] text-gray-600 dark:text-gray-300">{text}</span>
                  <Link to={href} className="flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
                    {cta} <ArrowRight size={11} />
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-20 text-center dark:border-white/[0.06] dark:bg-white/[0.03] rise-in">
            <span className="flex size-14 items-center justify-center rounded-full bg-gray-100 dark:bg-white/[0.06]">
              <Database size={24} className="text-gray-400 dark:text-gray-500" />
            </span>
            <p className="mt-4 text-[15px] font-semibold text-gray-700 dark:text-gray-200">
              Nenhuma atividade encontrada
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              Tente mudar o período ou limpar os filtros
            </p>
          </div>
        ) : (
          <div className="space-y-5 stagger-children">
            {grouped.map((group) => (
              <div key={group.key}>
                <p className="mb-2 text-[10px] font-bold tracking-widest text-gray-400 dark:text-gray-500">
                  {group.label}
                </p>
                <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/[0.06]">
                  {group.items.map((item, idx) => (
                    <ActivityRow
                      key={`${item.kind}-${item.id}`}
                      item={item}
                      isLast={idx === group.items.length - 1}
                      userEmail={user?.email}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
