import { api } from './api'
import type { PaginatedResponse } from '@/types/api.types'
import type { ExportJob, ExportListItem, CreateExportPayload } from '@/types/export.types'

export const exportService = {
  async list(page = 1, pageSize = 20): Promise<PaginatedResponse<ExportListItem>> {
    const { data } = await api.get('/exports', { params: { page, page_size: pageSize } })
    return data
  },

  async get(id: string): Promise<ExportJob> {
    const { data } = await api.get<ExportJob>(`/exports/${id}`)
    return data
  },

  async create(payload: CreateExportPayload): Promise<ExportJob> {
    const { data } = await api.post<ExportJob>('/exports', payload)
    return data
  },

  downloadUrl(id: string): string {
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
    return `${base}/api/v1/exports/${id}/download`
  },
}
