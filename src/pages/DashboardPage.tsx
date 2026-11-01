import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileDown,
  FileUp,
  Database,
  RefreshCw,
  Search,
  ChevronDown,
} from 'lucide-react'

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
type TimeRange = 'today' | '3d' | '7d' | '30d' | 'all' | 'mine'

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

function filterByRange(items: ActivityItem[], range: TimeRange): ActivityItem[] {
  if (range === 'all' || range === 'mine') return items
  const limits: Record<TimeRange, number> = {
    today: 1, '3d': 3, '7d': 7, '30d': 30, all: Infinity, mine: Infinity,
  }
  const now = Date.now()
  return items.filter((i) => (now - new Date(i.created_at).getTime()) / 86_400_000 < limits[range])
}

// ── Time tabs ────────────────────────────────────────────────
const TIME_TABS: { key: TimeRange; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '3d',    label: '3 dias' },
  { key: '7d',    label: '7 dias' },
  { key: '30d',   label: '30 dias' },
  { key: 'all',   label: 'Tudo' },
  { key: 'mine',  label: 'Só minhas' },
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

  const st = STATUS_CONFIG[item.status] ?? {
    label: item.status,
    pill: 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400',
    bar: 'bg-gray-300',
  }
  const isExport = item.kind === 'export'
  const iconBg = isExport
    ? 'bg-emerald-500/[0.12] text-emerald-400'
    : 'bg-violet-500/[0.12] text-violet-400'
  const Icon = isExport ? FileDown : FileUp

  return (
    <div
      className={`bg-white dark:bg-[#1c1e26] ${
        !isLast || open ? 'border-b border-gray-100 dark:border-white/[0.04]' : ''
      }`}
    >
      {/* Main row */}
      <button
        className="relative w-full cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
          >
            <Icon size={16} />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
              {fmtTime(item.created_at)}
              {userEmail ? ` · ${userEmail}` : ''}
              {` · ${ENTITY_LABELS[item.entity_type] ?? item.entity_type}`}
              {item.records !== null ? ` (${item.records.toLocaleString('pt-BR')})` : ''}
            </p>
          </div>

          {/* Right */}
          <div className="flex shrink-0 items-center gap-3">
            {item.records !== null && (
              <span className="min-w-[3ch] text-right text-base font-semibold tabular-nums text-gray-400 dark:text-gray-500">
                {item.records.toLocaleString('pt-BR')}
              </span>
            )}
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.pill}`}>
              {st.label}
            </span>
            <ChevronDown
              size={14}
              className={`text-gray-400 transition-transform duration-200 dark:text-gray-500 ${
                open ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px]">
          <div className={`h-full ${st.bar} opacity-40`} />
        </div>
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 dark:border-white/[0.04] dark:bg-white/[0.02]">
          {/* Stats row 1: totals */}
          <div className="grid grid-cols-4 gap-4">
            <StatCell label="Total" value={item.records ?? '—'} />
            <StatCell label="Sucesso" value={item.created} />
            <StatCell label="Erros" value={item.errors} />
            {item.kind === 'import' ? (
              <StatCell label="Duplicatas" value={item.duplicates} />
            ) : (
              <StatCell label="Retries" value={0} />
            )}
          </div>

          {/* Stats row 2: dates */}
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 dark:border-white/[0.04] sm:grid-cols-3">
            <StatCell label="Início" value={fmtDateTime(item.created_at)} />
            <StatCell
              label="Quem rodou"
              value={userEmail ?? '—'}
            />
            {item.kind === 'import' && item.progress_pct < 100 && item.progress_pct > 0 && (
              <StatCell label="Progresso" value={`${item.progress_pct}%`} />
            )}
          </div>
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
    <div className="space-y-5">
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

      {/* Time tabs */}
      <div className="flex items-center gap-0.5">
        {TIME_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTimeRange(tab.key)}
            className={`rounded-[7px] px-3 py-1.5 text-xs font-medium transition-colors ${
              timeRange === tab.key
                ? 'bg-gray-900 text-white dark:bg-white/[0.12] dark:text-white'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
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
            placeholder="Buscar automação, pessoa ou arquivo"
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
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-20 text-center dark:border-white/[0.06] dark:bg-white/[0.03]">
          <Database size={32} className="text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Nenhuma atividade encontrada
          </p>
        </div>
      ) : (
        <div className="space-y-5">
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
  )
}
