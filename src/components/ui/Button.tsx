import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 rounded-[8px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:pointer-events-none disabled:opacity-40'

    const variants = {
      primary:   'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 dark:bg-brand-500 dark:text-white dark:hover:bg-brand-600',
      secondary: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-[#d6d8e0] dark:hover:bg-white/[0.1]',
      danger:    'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600/80 dark:hover:bg-red-600',
      ghost:     'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-[#9298b2] dark:hover:bg-white/[0.06] dark:hover:text-white',
    }

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-9 px-4 text-sm',
      lg: 'h-10 px-6 text-base',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
