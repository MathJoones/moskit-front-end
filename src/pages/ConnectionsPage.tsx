import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Pencil,
  Trash2,
  Plug,
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  AlertTriangle,
} from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { connectionService } from '@/services/connection.service'
import { extractErrorMessage } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import type { ApiConnection } from '@/types/export.types'

// ── Schemas ────────────────────────────────────────────────
const createSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(255),
  description: z.string().max(500).optional(),
  base_url: z.string().url('URL inválida').optional().or(z.literal('')),
  api_key: z.string().min(1, 'API Key obrigatória'),
})

const editSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(255),
  description: z.string().max(500).optional(),
  base_url: z.string().url('URL inválida').optional().or(z.literal('')),
  api_key: z.string().optional(), // vazio = não atualiza
  is_active: z.boolean(),
})

type CreateForm = z.infer<typeof createSchema>
type EditForm = z.infer<typeof editSchema>

// ── Helpers ────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function TestBadge({ conn }: { conn: ApiConnection }) {
  if (conn.last_test_ok === null || !conn.last_tested_at) {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <Clock size={12} /> Não testado
      </span>
    )
  }
  if (conn.last_test_ok) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <CheckCircle2 size={12} /> OK — {formatDate(conn.last_tested_at)}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-red-500">
      <XCircle size={12} /> Falhou — {formatDate(conn.last_tested_at)}
    </span>
  )
}

// ── Modal ──────────────────────────────────────────────────
interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ── CreateModal ────────────────────────────────────────────
interface CreateModalProps {
  onClose: () => void
}

function CreateModal({ onClose }: CreateModalProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema) })

  const mutation = useMutation({
    mutationFn: (data: CreateForm) =>
      connectionService.create({
        ...data,
        connection_type: 'moskit',
        base_url: data.base_url || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      onClose()
    },
    onError: (err: unknown) => setError(extractErrorMessage(err, 'Erro ao criar conexão')),
  })

  return (
    <Modal title="Nova Conexão Moskit" onClose={onClose}>
      {error && (
        <Alert variant="error" className="mb-4" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate>
        <div className="flex flex-col gap-4">
          <Input
            label="Nome"
            placeholder="Ex: Moskit Produção"
            error={errors.name?.message}
            autoFocus
            {...register('name')}
          />
          <Input
            label="Descrição (opcional)"
            placeholder="Ex: Conta principal"
            error={errors.description?.message}
            {...register('description')}
          />
          <Input
            label="API Key"
            type="password"
            placeholder="Sua API Key do Moskit CRM"
            error={errors.api_key?.message}
            {...register('api_key')}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Base URL{' '}
              <span className="text-xs font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
              placeholder="https://api.moskit.com.br"
              {...register('base_url')}
            />
            {errors.base_url && (
              <p className="text-xs text-red-600">{errors.base_url.message}</p>
            )}
            <p className="text-xs text-gray-400">
              Deixe em branco para usar o endpoint padrão
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Criar Conexão
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── EditModal ──────────────────────────────────────────────
interface EditModalProps {
  conn: ApiConnection
  onClose: () => void
}

function EditModal({ conn, onClose }: EditModalProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: conn.name,
      description: conn.description ?? '',
      base_url: conn.base_url ?? '',
      api_key: '',
      is_active: conn.is_active,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: EditForm) => {
      const payload: Record<string, unknown> = {
        name: data.name,
        description: data.description || undefined,
        base_url: data.base_url || undefined,
        is_active: data.is_active,
      }
      if (data.api_key) payload.api_key = data.api_key
      return connectionService.update(conn.id, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      onClose()
    },
    onError: (err: unknown) => setError(extractErrorMessage(err, 'Erro ao atualizar')),
  })

  return (
    <Modal title="Editar Conexão" onClose={onClose}>
      {error && (
        <Alert variant="error" className="mb-4" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate>
        <div className="flex flex-col gap-4">
          <Input
            label="Nome"
            error={errors.name?.message}
            autoFocus
            {...register('name')}
          />
          <Input
            label="Descrição (opcional)"
            error={errors.description?.message}
            {...register('description')}
          />
          <Input
            label="Nova API Key"
            type="password"
            placeholder="Deixe em branco para não alterar"
            error={errors.api_key?.message}
            {...register('api_key')}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Base URL</label>
            <input
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
              placeholder="https://api.moskit.com.br"
              {...register('base_url')}
            />
            {errors.base_url && (
              <p className="text-xs text-red-600">{errors.base_url.message}</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="rounded" {...register('is_active')} />
            Conexão ativa
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── DeleteConfirm ──────────────────────────────────────────
interface DeleteConfirmProps {
  conn: ApiConnection
  onClose: () => void
}

function DeleteConfirm({ conn, onClose }: DeleteConfirmProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => connectionService.delete(conn.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      onClose()
    },
    onError: (err: unknown) => setError(extractErrorMessage(err, 'Erro ao excluir')),
  })

  return (
    <Modal title="Excluir Conexão" onClose={onClose}>
      {error && (
        <Alert variant="error" className="mb-4" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-500" />
        <div>
          <p className="text-sm text-gray-700">
            Tem certeza que deseja excluir a conexão{' '}
            <strong>{conn.name}</strong>?
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Exportações existentes vinculadas a ela não serão afetadas, mas não
            será possível criar novas.
          </p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="danger" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Excluir
        </Button>
      </div>
    </Modal>
  )
}

// ── ConnectionCard ─────────────────────────────────────────
interface ConnectionCardProps {
  conn: ApiConnection
  onEdit: (c: ApiConnection) => void
  onDelete: (c: ApiConnection) => void
  isAdmin: boolean
}

function ConnectionCard({ conn, onEdit, onDelete, isAdmin }: ConnectionCardProps) {
  const queryClient = useQueryClient()
  const [testError, setTestError] = useState<string | null>(null)

  const testMutation = useMutation({
    mutationFn: () => connectionService.test(conn.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      setTestError(null)
    },
    onError: (err: unknown) => setTestError(extractErrorMessage(err, 'Erro ao testar conexão')),
  })

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50">
            <Plug size={16} className="text-brand-600" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-800">{conn.name}</p>
            {conn.description && (
              <p className="truncate text-xs text-gray-500">{conn.description}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => onEdit(conn)} title="Editar">
              <Pencil size={14} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(conn)}
              title="Excluir"
              className="text-red-500 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {/* Status ativo */}
        <span
          className={`flex items-center gap-1 text-xs font-medium ${
            conn.is_active ? 'text-green-600' : 'text-gray-400'
          }`}
        >
          {conn.is_active ? <Wifi size={12} /> : <WifiOff size={12} />}
          {conn.is_active ? 'Ativa' : 'Inativa'}
        </span>

        {/* Base URL */}
        {conn.base_url && (
          <span className="truncate text-xs text-gray-400">{conn.base_url}</span>
        )}

        {/* Último teste */}
        <TestBadge conn={conn} />
      </div>

      {/* Erro do teste */}
      {testError && (
        <Alert variant="error" className="mt-3" onDismiss={() => setTestError(null)}>
          {testError}
        </Alert>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-400">
          Criada em {formatDate(conn.created_at)}
        </span>
        <Button
          size="sm"
          variant="secondary"
          loading={testMutation.isPending}
          onClick={() => testMutation.mutate()}
        >
          Testar Conexão
        </Button>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────
type Modal = 'create' | 'edit' | 'delete' | null

export default function ConnectionsPage() {
  const [modal, setModal] = useState<Modal>(null)
  const [selected, setSelected] = useState<ApiConnection | null>(null)
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => connectionService.list(),
  })

  const openEdit = (c: ApiConnection) => { setSelected(c); setModal('edit') }
  const openDelete = (c: ApiConnection) => { setSelected(c); setModal('delete') }
  const close = () => { setModal(null); setSelected(null) }

  return (
    <>
      {/* Modals */}
      {modal === 'create' && <CreateModal onClose={close} />}
      {modal === 'edit' && selected && <EditModal conn={selected} onClose={close} />}
      {modal === 'delete' && selected && <DeleteConfirm conn={selected} onClose={close} />}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Conexões</h2>
            <p className="text-sm text-gray-500">
              Gerencie as API Keys do Moskit CRM usadas nas exportações
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setModal('create')}>
              <Plus size={16} />
              Nova Conexão
            </Button>
          )}
        </div>

        {/* Conteúdo */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-20 text-center">
            <Plug size={36} className="text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">Nenhuma conexão cadastrada</p>
            <p className="text-xs text-gray-400">
              Crie uma conexão com sua conta Moskit para exportar dados
            </p>
            {isAdmin && (
              <Button className="mt-5" onClick={() => setModal('create')}>
                <Plus size={16} />
                Nova Conexão
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {connections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                conn={conn}
                onEdit={openEdit}
                onDelete={openDelete}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
