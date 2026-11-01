import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  children: React.ReactNode
  onDismiss?: () => void
  className?: string
}

const styles = {
  info:    'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
  success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200',
  error:   'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200',
}

export function Alert({ variant = 'info', title, children, onDismiss, className }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'relative rounded-md border p-4 text-sm',
        styles[variant],
        className,
      )}
    >
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 opacity-60 hover:opacity-100"
          aria-label="Fechar"
        >
          <X size={14} />
        </button>
      )}
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  )
}
