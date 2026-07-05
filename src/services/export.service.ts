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

  async download(id: string): Promise<{ blob: Blob; filename: string }> {
    const response = await api.get(`/exports/${id}/download`, { responseType: 'blob' })
    const disposition = response.headers['content-disposition'] ?? ''
    const match = disposition.match(/filename[^;=\n]*=(?:(['"])(?<q>[^'"]*)\1|(?<bare>[^;\n]*))/)
    const filename = match?.groups?.q ?? match?.groups?.bare ?? `export_${id}`
    return { blob: response.data, filename: filename.trim() }
  },
}
