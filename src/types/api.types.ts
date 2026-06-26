export interface ApiResponse<T> {
  data: T
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface ApiError {
  error: string
  message: string
  details?: { field: string | null; message: string; code: string }[]
  request_id?: string
}
