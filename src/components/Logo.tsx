export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 302 212" className={className} aria-label="Ollow" role="img">
      <defs>
        <linearGradient id="ollow-o" x1="0" y1="0" x2="0" y2="158" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF9A3C" />
          <stop offset="1" stopColor="#FF6A00" />
        </linearGradient>
        <linearGradient id="ollow-p" x1="41" y1="0" x2="110" y2="158" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#B18AFF" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id="ollow-g" x1="120" y1="0" x2="302" y2="212" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00CC8A" />
          <stop offset="1" stopColor="#00A84F" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="32" height="158" rx="12" fill="url(#ollow-o)" />
      <rect x="41" y="0" width="69" height="158" rx="22" fill="url(#ollow-p)" />
      <g fill="url(#ollow-g)">
        <rect x="120" y="0" width="182" height="158" rx="40" />
        <polygon points="152,130 152,212 220,167 220,195 290,150 290,130" />
      </g>
    </svg>
  )
}