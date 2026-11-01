import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/hooks/useAuth'

const registerSchema = z
  .object({
    full_name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: z
      .string()
      .min(8, 'Senha deve ter no mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Senha deve ter ao menos 1 letra maiúscula')
      .regex(/[0-9]/, 'Senha deve ter ao menos 1 número'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Senhas não conferem',
    path: ['confirm_password'],
  })

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const { register: authRegister, status } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const passwordValue = useWatch({ control, name: 'password', defaultValue: '' })
  const pwdChecks = {
    length:    passwordValue.length >= 8,
    uppercase: /[A-Z]/.test(passwordValue),
    number:    /[0-9]/.test(passwordValue),
  }

  const mutation = useMutation({
    mutationFn: ({ full_name, email, password }: RegisterForm) =>
      authRegister({ full_name, email, password }),
    onSuccess: () => navigate('/dashboard', { replace: true }),
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Erro ao criar conta. Tente novamente.'
      setServerError(msg)
    },
  })

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="mb-6 text-xl font-semibold text-gray-900">Criar conta</h2>

      <form
        onSubmit={handleSubmit((data) => {
          setServerError(null)
          mutation.mutate(data)
        })}
        noValidate
      >
        <div className="flex flex-col gap-4">
          {serverError && (
            <Alert variant="error" onDismiss={() => setServerError(null)}>
              {serverError}
            </Alert>
          )}

          <Input
            label="Nome completo"
            type="text"
            placeholder="Seu Nome"
            autoComplete="name"
            autoFocus
            error={errors.full_name?.message}
            {...register('full_name')}
          />

          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />

          <div>
            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
            {passwordValue.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 pl-0.5">
                {[
                  { ok: pwdChecks.length,    text: 'Mínimo 8 caracteres' },
                  { ok: pwdChecks.uppercase, text: 'Ao menos 1 letra maiúscula' },
                  { ok: pwdChecks.number,    text: 'Ao menos 1 número' },
                ].map(({ ok, text }) => (
                  <li key={text} className={`flex items-center gap-1.5 text-[11.5px] ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    <span className={`flex size-3.5 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-emerald-500 text-white' : 'border border-gray-300 dark:border-white/[0.2]'}`}>
                      {ok && (
                        <svg viewBox="0 0 10 10" fill="none" className="size-2.5">
                          <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Input
            label="Confirmar senha"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            error={errors.confirm_password?.message}
            {...register('confirm_password')}
          />

          <Button type="submit" className="w-full" loading={mutation.isPending}>
            Criar conta
          </Button>
        </div>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        Já tem conta?{' '}
        <Link to="/login" className="text-brand-600 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
