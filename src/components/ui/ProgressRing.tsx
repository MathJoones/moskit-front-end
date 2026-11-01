import type { ReactNode } from 'react'

interface ProgressRingProps {
  value: number | null
  size?: number
  stroke?: number
  running?: boolean
  tone?: 'primary' | 'success' | 'warning' | 'destructive'
  center?: ReactNode
  caption?: string
}

const TONE_COLORS: Record<NonNullable<ProgressRingProps['tone']>, string> = {
  primary:     '#10b981',
  success:     '#10b981',
  warning:     '#f59e0b',
  destructive: '#ef4444',
}

export function ProgressRing({
  value,
  size = 128,
  stroke = 10,
  running = false,
  tone = 'primary',
  center,
  caption,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = value == null ? 0 : Math.min(100, Math.max(0, value))
  const dashoffset = circumference - (pct / 100) * circumference
  const color = TONE_COLORS[tone]
  const cx = size / 2
  const cy = size / 2

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          style={{ transform: 'rotate(-90deg)' }}
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="text-gray-100 dark:text-white/[0.06]"
            stroke="currentColor"
          />
          {/* Progress arc */}
          {value == null ? (
            /* Indeterminate: spinning arc segment */
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              stroke={color}
              strokeLinecap="round"
              strokeDasharray={`${circumference * 0.25} ${circumference * 0.75}`}
              className={running ? 'origin-center animate-spin' : ''}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />
          ) : (
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              stroke={color}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              className="transition-all duration-700"
            />
          )}
        </svg>

        {/* Center content */}
        {center != null && (
          <div
            className="absolute inset-0 flex items-center justify-center text-xl font-bold tabular-nums text-gray-900 dark:text-white"
            aria-label={typeof center === 'string' ? center : undefined}
          >
            {center}
          </div>
        )}
      </div>

      {caption && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {caption}
        </p>
      )}
    </div>
  )
}
