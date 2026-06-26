import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError, isAxiosError } from 'axios'
import { storage } from '@/utils/storage'

/** Extrai a mensagem legível de um erro (AxiosError ou Error genérico) */
export function extractErrorMessage(err: unknown, fallback = 'Erro inesperado'): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map((d) => d.msg ?? d).join(', ')
    return err.response?.data?.message ?? err.message ?? fallback
  }
  if (err instanceof Error) return err.message
  return fallback
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

// ── Fila de requests que aguardam refresh ─────────────────
interface QueueItem {
  resolve: (token: string) => void
  reject: (err: unknown) => void
}

let isRefreshing = false
let failedQueue: QueueItem[] = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((item) => {
    if (error) {
      item.reject(error)
    } else {
      item.resolve(token!)
    }
  })
  failedQueue = []
}

// ── Request interceptor: injeta token ─────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = storage.get<string>('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor: refresh automatico em 401 ───────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    // Evitar loop no proprio endpoint de refresh
    if (originalRequest.url?.includes('/auth/refresh')) {
      storage.remove('access_token')
      storage.remove('refresh_token')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (isRefreshing) {
      // Enfileira enquanto refresh esta em andamento
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`
        return api(originalRequest)
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    const refreshToken = storage.get<string>('refresh_token')
    if (!refreshToken) {
      isRefreshing = false
      window.location.href = '/login'
      return Promise.reject(error)
    }

    try {
      const { data } = await api.post('/auth/refresh', { refresh_token: refreshToken })
      storage.set('access_token', data.access_token)
      processQueue(null, data.access_token)
      originalRequest.headers.Authorization = `Bearer ${data.access_token}`
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      storage.remove('access_token')
      storage.remove('refresh_token')
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)
