import { api } from './api'
import type { ApiConnection } from '@/types/export.types'

interface CreateConnectionPayload {
  name: string
  description?: string
  connection_type: string
  base_url?: string
  api_key?: string
  api_secret?: string
  extra_config?: Record<string, unknown>
}

export const connectionService = {
  async list(): Promise<ApiConnection[]> {
    const { data } = await api.get<ApiConnection[]>('/connections')
    return data
  },

  async get(id: string): Promise<ApiConnection> {
    const { data } = await api.get<ApiConnection>(`/connections/${id}`)
    return data
  },

  async create(payload: CreateConnectionPayload): Promise<ApiConnection> {
    const { data } = await api.post<ApiConnection>('/connections', payload)
    return data
  },

  async update(id: string, payload: Partial<CreateConnectionPayload>): Promise<ApiConnection> {
    const { data } = await api.patch<ApiConnection>(`/connections/${id}`, payload)
    return data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/connections/${id}`)
  },

  async test(id: string): Promise<{ ok: boolean; message: string; latency_ms?: number }> {
    const { data } = await api.post(`/connections/${id}/test`)
    return data
  },
}
