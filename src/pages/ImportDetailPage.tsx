import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle, Check, ChevronDown, ChevronLeft, Copy, Download, Plus, XCircle,
} from 'lucide-react'

import { Alert } from '@/components/ui/Alert'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { importService } from '@/services/import.service'
import { extractErrorMessage } from '@/services/api'
import type { ImportEntityType, ImportStatus, ResultFileType } from '@/types/import.types'

// ── Labels ───────────────────────────────────────────────────

const ENTITY_LABELS: Record<ImportEntityType, string> = {
  contact: 'Contatos',
  company: 'Empresas',
  deal:    'Negócios',
}

const STATUS_CONFIG: Record<ImportStatus, { label: string; pill: string }> = {
  pending:    { label: 'Aguardando',   pill: 'bg-yellow-500/15 text-yellow-500' },
  processing: { label: 'Processando',  pill: 'bg-blue-500/15 text-blue-400' },
  completed:  { label: 'Concluído',    pill: 'bg-emerald-500/15 text-emerald-400' },
  cancelled:  { label: 'Cancelado',    pill: 'bg-gray-500/15 text-gray-400' },
  error:      { label: 'Com erros',    pill: 'bg-orange-500/15 text-orange-400' },
}

// ── Helper ───────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Component ────────────────────────────────────────────────

export default function ImportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const { data: job, isLoading } = useQuery({
    queryKey: ['import', id],
    queryFn: () => importService.get(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'pending' || status === 'processing' ? 3000 : false
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => importService.cancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import', id] })
      queryClient.invalidateQueries({ queryKey: ['imports'] })
    },
    onError: (err: unknown) => setError(extractErrorMessage(err, 'Erro ao cancelar')),
  })

  const handleDownload = async (type: ResultFileType) => {
    try {
      const { blob, filename } = await importService.downloadResult(id!, type)
      triggerDownload(blob, filename)
    } catch {
      const labels: Record<ResultFileType, string> = {
        created: 'criados', duplicate: 'duplicatas', error: 'erros',
      }
      setError(`Erro ao baixar CSV de ${labels[type]}`)
    }
  }

  // ── Loading state ────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pt-6 space-y-4">
        {[160, 120, 200].map((h, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl bg-gray-100 dark:bg-white/[0.04]"
            style={{ height: h }}
          />
        ))}
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-16 text-sm text-gray-500">
        Importação não encontrada.
      </div>
    )
  }

  const isActive   = job.status === 'pending' || job.status === 'processing'
  const isFinished = job.status === 'completed' || job.status === 'cancelled' || job.status === 'error'
  const statusCfg  = STATUS_CONFIG[job.status]

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6">

      {/* Back nav */}
      <nav className="flex items-center gap-1 text-[14px] text-gray-500 dark:text-gray-400">
        <button
          onClick={() => navigate('/imports')}
          className="-ml-1.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-brand-600 dark:text-brand-400 transition-colors hover:bg-brand-500/10"
        >
          <ChevronLeft size={18} strokeWidth={2.25} /> Importações
        </button>
      </nav>

      {/* Big header */}
      <header className="mt-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-gray-900 dark:text-white">
              {job.name}
            </h1>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
              {ENTITY_LABELS[job.entity_type]}
              {job.input_file_name && <> · {job.input_file_name}</>}
              {' '}· {fmtDate(job.created_at)}
            </p>
          </div>
          <span className={`mt-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusCfg.pill}`}>
            {statusCfg.label}
          </span>
        </div>
      </header>

      {/* Error message from job */}
      {job.error_message && (
        <div className="mt-4">
          <Alert variant="error">{job.error_message}</Alert>
        </div>
      )}

      {/* Dismissable error from mutations */}
      {error && (
        <div className="mt-4">
          <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>
        </div>
      )}

      {/* Main grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">

        {/* LEFT */}
        <div className="space-y-5">

          {/* Stats section */}
          <section>
            <div className="mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Resultado
              </span>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 dark:border-white/[0.06] dark:bg-white/[0.04]">
              {[
                { label: 'Total',      value: job.total_rows ?? '—',                      color: 'text-gray-800 dark:text-gray-100' },
                { label: 'Criados',    value: job.created,                                 color: 'text-emerald-500' },
                { label: 'Duplicatas', value: job.duplicates,                              color: 'text-yellow-500' },
                { label: 'Erros',      value: job.errors,                                  color: 'text-orange-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white px-4 py-3 dark:bg-[#1c1e26]">
                  <p className="text-[10.5px] text-gray-400 dark:text-gray-500">{label}</p>
                  <p className={`mt-0.5 font-mono text-2xl font-bold tabular-nums ${color}`}>
                    {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Download result files */}
          {isFinished && (job.created > 0 || job.duplicates > 0 || job.errors > 0) && (
            <section>
              <div className="mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Arquivos de Resultado
                </span>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/[0.06] dark:bg-[#1c1e26] space-y-2">
                {(
                  [
                    {
                      type:    'created'   as ResultFileType,
                      label:   'Criados',
                      icon:    Check,
                      count:   job.created,
                      bg:      'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                    },
                    {
                      type:    'duplicate' as ResultFileType,
                      label:   'Duplicatas',
                      icon:    Copy,
                      count:   job.duplicates,
                      bg:      'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
                    },
                    {
                      type:    'error'     as ResultFileType,
                      label:   'Com erros',
                      icon:    AlertCircle,
                      count:   job.errors,
                      bg:      'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400',
                    },
                  ] as const
                ).map(({ type, label, icon: Icon, count, bg }) => {
                  if (!count) return null
                  return (
                    <button
                      key={type}
                      onClick={() => handleDownload(type)}
                      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${bg}`}
                    >
                      <Icon size={16} />
                      <span className="flex-1 text-sm font-medium">{label}</span>
                      <span className="font-mono text-sm tabular-nums">{count.toLocaleString('pt-BR')}</span>
                      <Download size={14} className="shrink-0 opacity-60" />
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* Mapping preview (collapsible) */}
          {job.column_mappings && job.column_mappings.length > 0 && (
            <section>
              <div className="mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Mapeamento
                </span>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.06] dark:bg-[#1c1e26]">
                <button
                  onClick={() => setShowPreview((v) => !v)}
                  className="flex w-full items-center justify-between p-4 text-left"
                  aria-expanded={showPreview}
                >
                  <span className="text-sm font-medium text-gray-800 dark:text-white">
                    Ver colunas mapeadas ({job.column_mappings.length})
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform duration-200 ${showPreview ? 'rotate-180' : ''}`}
                  />
                </button>
                {showPreview && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-1.5 dark:border-white/[0.05]">
                    {job.column_mappings.map((m) => (
                      <div key={m.csv_column} className="flex items-center gap-2 text-[12px]">
                        <span className="font-mono rounded-md bg-gray-50 px-2 py-0.5 text-gray-700 dark:bg-white/[0.04] dark:text-[#d6d8e0]">
                          {m.csv_column}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-gray-700 dark:text-gray-200">{m.target_field}</span>
                        <span className="ml-auto font-mono text-[10px] text-gray-400 dark:text-gray-500">
                          {m.transformer ?? 'string'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

        </div>

        {/* RIGHT: sticky RunPanel sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/[0.06] dark:bg-[#1c1e26] space-y-4">

            {/* Status indicator */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800 dark:text-white">Execução</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`size-1.5 rounded-full ${isActive ? 'animate-pulse bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                {isActive ? 'Rodando' : 'Concluído'}
              </span>
            </div>

            {/* ProgressRing */}
            <div className="flex justify-center">
              <ProgressRing
                value={job.status === 'pending' ? null : job.progress_pct}
                running={isActive}
                tone={job.status === 'error' ? 'destructive' : job.status === 'completed' ? 'success' : 'primary'}
                center={`${job.progress_pct}%`}
                caption={
                  isActive
                    ? `${job.processed.toLocaleString('pt-BR')} de ${job.total_rows != null ? job.total_rows.toLocaleString('pt-BR') : '?'} registros`
                    : job.status === 'completed'
                    ? 'Importação concluída'
                    : statusCfg.label
                }
                size={128}
                stroke={10}
              />
            </div>

            {/* Stats mini grid */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-100 bg-gray-100 text-center dark:border-white/[0.04] dark:bg-white/[0.04]">
              {[
                { label: 'Criados',    value: job.created,        color: 'text-emerald-500' },
                { label: 'Erros',      value: job.errors,         color: 'text-orange-400' },
                { label: 'Duplicatas', value: job.duplicates,     color: 'text-yellow-500' },
                { label: 'Total',      value: job.total_rows ?? '—', color: 'text-gray-600 dark:text-gray-300' },
              ].map((s) => (
                <div key={s.label} className="bg-white px-3 py-2.5 dark:bg-[#1c1e26]">
                  <p className={`font-mono text-base font-bold tabular-nums ${s.color}`}>
                    {typeof s.value === 'number' ? s.value.toLocaleString('pt-BR') : s.value}
                  </p>
                  <p className="text-[10.5px] text-gray-400 dark:text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Cancel button */}
            {isActive && !confirmCancel && (
              <button
                onClick={() => setConfirmCancel(true)}
                disabled={cancelMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                <XCircle size={16} /> Cancelar importação
              </button>
            )}
            {isActive && confirmCancel && (
              <div className="rounded-[10px] border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-900/10">
                <p className="mb-2.5 text-xs text-red-700 dark:text-red-300">
                  Tem certeza? Registros já processados não serão desfeitos.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmCancel(false)}
                    className="flex-1 rounded-[8px] border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-gray-300"
                  >
                    Não
                  </button>
                  <button
                    onClick={() => { cancelMutation.mutate(); setConfirmCancel(false) }}
                    disabled={cancelMutation.isPending}
                    className="flex-1 rounded-[8px] bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
                  >
                    Sim, cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="space-y-1 text-[12px] text-gray-400 dark:text-gray-500">
              <p>Iniciada: {fmtDate(job.created_at)}</p>
              {job.started_at   && <p>Processando desde: {fmtDate(job.started_at)}</p>}
              {job.completed_at && <p>Concluída: {fmtDate(job.completed_at)}</p>}
            </div>

            {/* Post-completion CTAs */}
            {isFinished && (
              <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 dark:border-white/[0.05]">
                <button
                  onClick={() => navigate('/imports/new')}
                  className="flex w-full items-center justify-center gap-1.5 rounded-[8px] bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
                >
                  <Plus size={13} /> Nova importação
                </button>
                <Link
                  to="/imports"
                  className="block text-center text-xs text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  Ver histórico de importações
                </Link>
              </div>
            )}

          </div>
        </aside>

      </div>
    </div>
  )
}
