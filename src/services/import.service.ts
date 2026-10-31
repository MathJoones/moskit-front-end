import { api } from './api'
import type { PaginatedResponse } from '@/types/api.types'
import type {
  CreateImportPayload,
  ImportJob,
  ImportListItem,
  ImportPreviewResponse,
  ResultFileType,
} from '@/types/import.types'

export const importService = {
  async list(
    page = 1,
    pageSize = 20,
    filters?: { status?: string; entity_type?: string; date_from?: string; date_to?: string },
  ): Promise<PaginatedResponse<ImportListItem>> {
    const { data } = await api.get('/imports', {
      params: { page, page_size: pageSize, ...filters },
    })
    return data
  },

  async get(id: string): Promise<ImportJob> {
    const { data } = await api.get<ImportJob>(`/imports/${id}`)
    return data
  },

  async create(payload: CreateImportPayload, file: File): Promise<ImportJob> {
    const form = new FormData()
    form.append('file', file)
    form.append('name', payload.name)
    form.append('entity_type', payload.entity_type)
    form.append('connection_id', payload.connection_id)
    form.append('column_mappings', JSON.stringify(payload.column_mappings))
    if (payload.dedup_keys?.length) {
      form.append('dedup_keys', JSON.stringify(payload.dedup_keys))
    }
    const { data } = await api.post<ImportJob>('/imports', form)
    return data
  },

  async cancel(id: string): Promise<ImportJob> {
    const { data } = await api.delete<ImportJob>(`/imports/${id}`)
    return data
  },

  async preview(id: string): Promise<ImportPreviewResponse> {
    const { data } = await api.post<ImportPreviewResponse>(`/imports/${id}/preview`)
    return data
  },

  async downloadResult(
    id: string,
    resultType: ResultFileType,
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await api.get(`/imports/${id}/download/${resultType}`, {
      responseType: 'blob',
    })
    const disposition = response.headers['content-disposition'] ?? ''
    const match = disposition.match(/filename[^;=\n]*=(?:(['"])(?<q>[^'"]*)\1|(?<bare>[^;\n]*))/)
    const filename =
      match?.groups?.q ??
      match?.groups?.bare ??
      `import_${id}_${resultType}.csv`
    return { blob: response.data, filename: filename.trim() }
  },
}
