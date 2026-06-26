export interface User {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'operator' | 'viewer'
  status: 'active' | 'inactive' | 'suspended'
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  full_name: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthState {
  user: User | null
  status: AuthStatus
  error: string | null
}
