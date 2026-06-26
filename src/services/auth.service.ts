import { api } from './api'
import { storage } from '@/utils/storage'
import type { LoginCredentials, RegisterCredentials, AuthTokens, User } from '@/types/auth.types'

export const authService = {
  async register(credentials: RegisterCredentials): Promise<AuthTokens> {
    const { data } = await api.post<AuthTokens>('/auth/register', credentials)
    storage.set('access_token', data.access_token)
    storage.set('refresh_token', data.refresh_token)
    return data
  },

  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    const { data } = await api.post<AuthTokens>('/auth/login', credentials)
    storage.set('access_token', data.access_token)
    storage.set('refresh_token', data.refresh_token)
    return data
  },

  async logout(): Promise<void> {
    const refreshToken = storage.get<string>('refresh_token')
    if (refreshToken) {
      await api.post('/auth/logout', { refresh_token: refreshToken }).catch(() => {})
    }
    storage.remove('access_token')
    storage.remove('refresh_token')
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<User>('/auth/me')
    return data
  },

  isAuthenticated(): boolean {
    return !!storage.get<string>('access_token')
  },
}
