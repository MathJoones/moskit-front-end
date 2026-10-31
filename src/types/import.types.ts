export type ImportEntityType = 'contact' | 'company' | 'deal'
export type ImportStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'error'
export type ImportRowStatus = 'created' | 'duplicate' | 'error'
export type TransformerType = 'string' | 'number' | 'date' | 'phone' | 'enum'
export type ResultFileType = 'created' | 'duplicate' | 'error'

// ── Mapeamento de colunas (inline no job) ─────────────────────
export interface ColumnMapping {
  csv_column: string
  target_field: string
  transformer: TransformerType | null
  transformer_config?: Record<string, unknown> | null
  is_required: boolean
}

// ── ImportRow ─────────────────────────────────────────────────
export interface ImportRow {
  id: string
  row_number: number
  status: ImportRowStatus
  moskit_id: string | null
  error_message: string | null
  retry_count: number
  created_at: string
}

// ── ImportJob ─────────────────────────────────────────────────
export interface ImportJob {
  id: string
  name: string
  entity_type: ImportEntityType
  status: ImportStatus
  connection_id: string | null
  column_mappings: ColumnMapping[] | null
  dedup_keys: string[] | null
  input_file_name: string | null
  total_rows: number | null
  processed: number
  created: number
  duplicates: number
  errors: number
  progress_pct: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_by: string
  created_at: string
  rows: ImportRow[]
}

export interface ImportListItem {
  id: string
  name: string
  entity_type: ImportEntityType
  status: ImportStatus
  total_rows: number | null
  processed: number
  created: number
  duplicates: number
  errors: number
  progress_pct: number
  created_at: string
}

export interface CreateImportPayload {
  name: string
  entity_type: ImportEntityType
  connection_id: string
  column_mappings: ColumnMapping[]
  dedup_keys?: string[] | null
}

// ── Preview ───────────────────────────────────────────────────
export interface ImportPreviewRow {
  row_number: number
  raw: Record<string, string>
  transformed: Record<string, unknown> | null
  error: string | null
}

export interface ImportPreviewResponse {
  entity_type: ImportEntityType
  rows: ImportPreviewRow[]
}
