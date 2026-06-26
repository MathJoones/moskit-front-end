import { useState } from 'react'
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/hooks/useAuth'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { login, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'

  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const mutation = useMutation({
    mutationFn: ({ email, password }: LoginForm) => login(email, password),
    onSuccess: () => navigate(from, { replace: true }),
    onError: () => setServerError('Credenciais inválidas. Tente novamente.'),
  })

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="mb-6 text-xl font-semibold text-gray-900">Entrar</h2>

      <form onSubmit={handleSubmit((data) => { setServerError(null); mutation.mutate(data) })} noValidate>
        <div className="flex flex-col gap-4">
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
            {...register('email')}
          />

          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
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

      <p className="mt-4 text-center text-sm text-gray-600">
        Não tem conta?{' '}
        <Link to="/register" className="text-brand-600 hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
