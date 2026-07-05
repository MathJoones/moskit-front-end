export type EntityType = 'deal' | 'contact' | 'company' | 'activity'
export type ExportFormat = 'csv' | 'xlsx' | 'json'
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ExportJob {
  id: string
  name: string
  entity_type: EntityType
  status: ExportStatus
  output_format: ExportFormat
  output_file_name: string | null
  total_records: number | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  expires_at: string | null
  created_by: string
  created_at: string
}

export interface ExportListItem {
  id: string
  name: string
  entity_type: EntityType
  status: ExportStatus
  output_format: ExportFormat
  total_records: number | null
  error_message: string | null
  created_at: string
}

export interface CreateExportPayload {
  name: string
  entity_type: EntityType
  connection_id: string
  output_format: ExportFormat
  filter_config?: Record<string, unknown>
  columns_config?: { fields: string[] }
}

export interface ApiConnection {
  id: string
  name: string
  description: string | null
  connection_type: string
  base_url: string | null
  is_active: boolean
  last_tested_at: string | null
  last_test_ok: boolean | null
  created_at: string
}
