import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Eye, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { importService } from '@/services/import.service'
import { extractErrorMessage } from '@/services/api'
import type { ImportEntityType, ImportStatus, ResultFileType } from '@/types/import.types'

// ── Labels ───────────────────────────────────────────────────
const ENTITY_LABELS: Record<ImportEntityType, string> = {
  contact: 'Contatos',
  company: 'Empresas',
  deal:    'Negócios',
}

const STATUS_COLORS: Record<ImportStatus, string> = {
  pending:    'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed:  'bg-green-100 text-green-800',
  cancelled:  'bg-gray-100 text-gray-600',
  error:      'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<ImportStatus, string> = {
  pending:    'Aguardando',
  processing: 'Processando...',
  completed:  'Concluído',
  cancelled:  'Cancelado',
  error:      'Erro',
}

const RESULT_LABELS: Record<ResultFileType, string> = {
  created:   'Criados',
  duplicate: 'Duplicatas',
  error:     'Erros',
}

const RESULT_COLORS: Record<ResultFileType, string> = {
  created:   'text-green-700 border-green-200 bg-green-50 hover:bg-green-100',
  duplicate: 'text-yellow-700 border-yellow-200 bg-yellow-50 hover:bg-yellow-100',
  error:     'text-red-700 border-red-200 bg-red-50 hover:bg-red-100',
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

// ── Component ────────────────────────────────────────────────
export default function ImportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const { data: job, isLoading } = useQuery({
    queryKey: ['import', id],
    queryFn: () => importService.get(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'pending' || status === 'processing' ? 3000 : false
    },
  })

  const { data: preview, isLoading: loadingPreview } = useQuery({
    queryKey: ['import-preview', id],
    queryFn: () => importService.preview(id!),
    enabled: showPreview && !!id,
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
      setError(`Erro ao baixar CSV de ${RESULT_LABELS[type].toLowerCase()}`)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
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

  const isActive = job.status === 'pending' || job.status === 'processing'
  const isFinished = job.status === 'completed' || job.status === 'cancelled'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/imports')}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{job.name}</h2>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
              <span>{ENTITY_LABELS[job.entity_type]}</span>
              {job.input_file_name && <><span>·</span><span>{job.input_file_name}</span></>}
              <span>·</span>
              <span>{new Date(job.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[job.status]}`}>
            {STATUS_LABELS[job.status]}
          </span>
          {isActive && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => cancelMutation.mutate()}
              loading={cancelMutation.isPending}
            >
              <XCircle size={14} /> Cancelar
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {job.error_message && <Alert variant="error">{job.error_message}</Alert>}

      {/* Progresso */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Progresso</h3>
          <span className="text-sm font-medium text-gray-800">{job.progress_pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isActive ? 'bg-blue-500' : job.status === 'completed' ? 'bg-green-500' : 'bg-gray-400'}`}
            style={{ width: `${job.progress_pct}%` }}
          />
        </div>

        {/* Contadores */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total', value: job.total_rows ?? '—', color: 'text-gray-700' },
            { label: 'Criados', value: job.created, color: 'text-green-700' },
            { label: 'Duplicatas', value: job.duplicates, color: 'text-yellow-700' },
            { label: 'Erros', value: job.errors, color: 'text-red-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-md border border-gray-100 bg-gray-50 p-3 text-center">
              <p className={`text-xl font-bold ${color}`}>
                {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
              </p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Download resultados */}
      {isFinished && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Arquivos de Resultado</h3>
          <div className="flex flex-wrap gap-3">
            {(['created', 'duplicate', 'error'] as ResultFileType[]).map((type) => {
              const count = type === 'created' ? job.created : type === 'duplicate' ? job.duplicates : job.errors
              if (count === 0) return null
              return (
                <button
                  key={type}
                  onClick={() => handleDownload(type)}
                  className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${RESULT_COLORS[type]}`}
                >
                  <Download size={14} />
                  {RESULT_LABELS[type]} ({count.toLocaleString('pt-BR')})
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Preview */}
      {job.status !== 'processing' && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <button
            className="flex w-full items-center justify-between px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            onClick={() => setShowPreview((v) => !v)}
          >
            <span className="flex items-center gap-2"><Eye size={15} /> Preview do Mapeamento</span>
            <span className="text-xs text-gray-400">{showPreview ? 'Ocultar' : 'Mostrar'}</span>
          </button>

          {showPreview && (
            <div className="border-t border-gray-100 p-5">
              {loadingPreview ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />)}
                </div>
              ) : preview && preview.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-2 pr-4 text-left font-medium text-gray-500">#</th>
                        <th className="py-2 pr-4 text-left font-medium text-gray-500">Status</th>
                        <th className="py-2 pr-4 text-left font-medium text-gray-500">Dados Transformados</th>
                        <th className="py-2 text-left font-medium text-gray-500">Erro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.rows.map((row) => (
                        <tr key={row.row_number}>
                          <td className="py-2 pr-4 text-gray-500">{row.row_number}</td>
                          <td className="py-2 pr-4">
                            {row.error ? (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">erro</span>
                            ) : (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">ok</span>
                            )}
                          </td>
                          <td className="py-2 pr-4 max-w-xs">
                            {row.transformed ? (
                              <code className="block truncate text-gray-700">
                                {JSON.stringify(row.transformed)}
                              </code>
                            ) : '—'}
                          </td>
                          <td className="py-2 text-red-600">{row.error ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Nenhum dado de preview disponível.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
