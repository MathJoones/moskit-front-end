interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: SegmentedProps<T>) {
  return (
    <div
      className={`inline-grid auto-cols-fr grid-flow-col rounded-[9px] bg-gray-100 p-[2px] dark:bg-white/[0.07] ${className}`}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-[7px] px-3 py-1.5 text-xs font-medium transition-all ${
            opt.value === value
              ? 'bg-white text-gray-900 shadow-sm dark:bg-white/[0.16] dark:text-white'
              : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
