import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, RefreshCw, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { exportService } from '@/services/export.service'
import { connectionService } from '@/services/connection.service'
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

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed:  'bg-green-100 text-green-800',
  failed:     'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  pending:    'Aguardando',
  processing: 'Processando...',
  completed:  'Concluído',
  failed:     'Falhou',
}

// ── Component ──────────────────────────────────────────────
export default function ExportPage() {
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: exportsData, isLoading: loadingExports } = useQuery({
    queryKey: ['exports'],
    queryFn: () => exportService.list(),
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
    onError: (err: Error) => setError(err.message ?? 'Erro ao criar exportação'),
  })

  const onSubmit = (data: ExportForm) => {
    setError(null)
    createMutation.mutate(data)
  }

  const handleDownload = (id: string) => {
    window.open(exportService.downloadUrl(id), '_blank')
  }

  const exports: ExportListItem[] = exportsData?.items ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Exportar Dados</h2>
          <p className="text-sm text-gray-500">
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
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-800">Nova Exportação</h3>

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
                <label className="text-sm font-medium text-gray-700">Entidade</label>
                <select
                  className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
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
                <label className="text-sm font-medium text-gray-700">Formato</label>
                <select
                  className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
                  {...register('output_format')}
                >
                  {(Object.entries(FORMAT_LABELS) as [ExportFormat, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Conexão */}
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-sm font-medium text-gray-700">Conexão Moskit</label>
                {loadingConnections ? (
                  <div className="h-9 animate-pulse rounded-md bg-gray-100" />
                ) : (
                  <select
                    className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
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
                  <p className="text-xs text-yellow-600">
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

      {/* Lista de exportações */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-700">Histórico de Exportações</h3>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['exports'] })}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            <RefreshCw size={13} />
            Atualizar
          </button>
        </div>

        {loadingExports ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : exports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Download size={32} className="text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">Nenhuma exportação ainda</p>
            <p className="text-xs text-gray-400">Clique em "Nova Exportação" para começar</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {exports.map((exp) => (
              <li
                key={exp.id}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{exp.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{ENTITY_LABELS[exp.entity_type]}</span>
                    <span>·</span>
                    <span>{FORMAT_LABELS[exp.output_format]}</span>
                    {exp.total_records !== null && (
                      <>
                        <span>·</span>
                        <span>{exp.total_records.toLocaleString('pt-BR')} registros</span>
                      </>
                    )}
                    <span>·</span>
                    <span>
                      {new Date(exp.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[exp.status] ?? ''}`}
                  >
                    {STATUS_LABELS[exp.status] ?? exp.status}
                  </span>

                  {exp.status === 'completed' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownload(exp.id)}
                    >
                      <Download size={14} />
                      Baixar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {exportsData && exportsData.total > exportsData.page_size && (
          <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
            Mostrando {exports.length} de {exportsData.total} exportações
          </div>
        )}
      </div>
    </div>
  )
}
