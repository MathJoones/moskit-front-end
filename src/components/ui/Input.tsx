import { forwardRef, InputHTMLAttributes, useId } from 'react'
import { cn } from '@/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id: propId, ...props }, ref) => {
    const generatedId = useId()
    const id = propId ?? generatedId
    const errorId = `${id}-error`
    const hintId = `${id}-hint`

    const describedBy = [
      error ? errorId : null,
      hint ? hintId : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          className={cn(
            'h-9 w-full rounded-[8px] border bg-white px-3 text-[13px] outline-none transition-colors placeholder:text-gray-400',
            'dark:bg-[#20222d] dark:text-[#f4f5f8] dark:placeholder:text-[#50536a]',
            'focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 dark:focus:ring-brand-500/30 dark:focus:border-brand-500',
            error
              ? 'border-red-500 focus:ring-red-500/40'
              : 'border-gray-200 dark:border-[#2e3040]',
            className,
          )}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-xs text-gray-400 dark:text-gray-500">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
