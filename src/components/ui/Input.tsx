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
          <label htmlFor={id} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          className={cn(
            'h-9 w-full rounded-md border bg-white px-3 text-sm outline-none transition-colors placeholder:text-gray-400',
            'focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300',
            className,
          )}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-xs text-gray-400">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
