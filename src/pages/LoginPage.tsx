import { useState } from 'react'
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/hooks/useAuth'

// Login: validate format only — server validates the password itself
const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Digite sua senha'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { login, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'

  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const mutation = useMutation({
    mutationFn: ({ email, password }: LoginForm) => login(email, password),
    onSuccess: () => navigate(from, { replace: true }),
    onError: (err: unknown) => {
      if (isAxiosError(err)) {
        const code = err.response?.data?.error as string | undefined
        if (code === 'EMAIL_NOT_FOUND') {
          // Inline error on the email field — persists until user edits
          setError('email', { message: 'E-mail não cadastrado no sistema.' })
        } else if (code === 'WRONG_CREDENTIALS') {
          setError('password', { message: 'Senha incorreta. Verifique e tente novamente.' })
        } else if (code === 'ACCOUNT_LOCKED') {
          setServerError('Conta bloqueada temporariamente por excesso de tentativas. Tente em alguns minutos.')
        } else if (err.response?.status === 401 || err.response?.status === 403) {
          setError('password', { message: 'E-mail ou senha incorretos.' })
        } else {
          setServerError('E-mail ou senha incorretos.')
        }
      } else {
        setServerError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
      }
    },
  })

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  const eyeButton = (show: boolean, toggle: () => void) => (
    <button
      type="button"
      tabIndex={-1}
      onClick={toggle}
      className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
      aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
    >
      {show ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  )

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-white/[0.08] dark:bg-[#1c1e26]">
      <h2 className="mb-1.5 text-xl font-semibold text-gray-900 dark:text-white">Entrar</h2>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Acesse sua conta para continuar
      </p>

      <form
        onSubmit={handleSubmit((data) => {
          setServerError(null)
          clearErrors()
          mutation.mutate(data)
        })}
        noValidate
      >
        <div className="flex flex-col gap-4">

          {/* Server-level error (network, locked, etc.) */}
          {serverError && (
            <Alert variant="error" onDismiss={() => setServerError(null)}>
              {serverError}
            </Alert>
          )}

          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            autoFocus
            error={errors.email?.message}
            {...register('email', {
              onChange: () => {
                if (errors.email?.message) clearErrors('email')
              },
            })}
          />

          <Input
            label="Senha"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            error={errors.password?.message}
            rightAdornment={eyeButton(showPassword, () => setShowPassword((v) => !v))}
            {...register('password', {
              onChange: () => {
                if (errors.password?.message) clearErrors('password')
              },
            })}
          />

          <Button
            type="submit"
            className="w-full"
            loading={mutation.isPending}
          >
            Entrar
          </Button>
        </div>
      </form>

      <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
        Não tem conta?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
