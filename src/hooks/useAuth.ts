import { useAuthContext } from '@/contexts/AuthContext'

/**
 * Hook principal de autenticacao.
 * Lanca erro se usado fora do AuthProvider.
 */
export function useAuth() {
  return useAuthContext()
}
