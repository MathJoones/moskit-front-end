import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import type { User, AuthState, RegisterCredentials } from '@/types/auth.types'
import { authService } from '@/services/auth.service'

// ── Actions ───────────────────────────────────────────────
type AuthAction =
  | { type: 'LOADING' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'ERROR'; payload: string }
  | { type: 'REHYDRATE'; payload: User }

const initialState: AuthState = {
  user: null,
  status: 'idle',
  error: null,
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, status: 'loading', error: null }
    case 'LOGIN_SUCCESS':
      return { user: action.payload, status: 'authenticated', error: null }
    case 'LOGOUT':
      return { user: null, status: 'unauthenticated', error: null }
    case 'ERROR':
      return { ...state, status: 'unauthenticated', error: action.payload }
    case 'REHYDRATE':
      return { user: action.payload, status: 'authenticated', error: null }
    default:
      return state
  }
}

// ── Context ───────────────────────────────────────────────
interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (credentials: RegisterCredentials) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Rehydrate: ao montar, verifica token existente
  useEffect(() => {
    if (!authService.isAuthenticated()) {
      dispatch({ type: 'LOGOUT' })
      return
    }
    dispatch({ type: 'LOADING' })
    authService
      .getMe()
      .then((user) => dispatch({ type: 'REHYDRATE', payload: user }))
      .catch(() => dispatch({ type: 'LOGOUT' }))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'LOADING' })
    try {
      await authService.login({ email, password })
      const user = await authService.getMe()
      dispatch({ type: 'LOGIN_SUCCESS', payload: user })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao fazer login'
      dispatch({ type: 'ERROR', payload: message })
      throw err
    }
  }, [])

  const register = useCallback(async (credentials: RegisterCredentials) => {
    dispatch({ type: 'LOADING' })
    try {
      await authService.register(credentials)
      const user = await authService.getMe()
      dispatch({ type: 'LOGIN_SUCCESS', payload: user })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao criar conta'
      dispatch({ type: 'ERROR', payload: message })
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    dispatch({ type: 'LOGOUT' })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook (uso externo) ────────────────────────────────────
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuthContext deve ser usado dentro de <AuthProvider>')
  }
  return ctx
}
