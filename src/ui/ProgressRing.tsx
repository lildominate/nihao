// Circular progress ring (value 0..1) + chunky ProgressBar. Colour via `color` or `gradient` [from, to].
import { useId, type ReactNode } from 'react'

export function ProgressRing({ value, size = 44, stroke = 5, color = 'var(--color-warn)', gradient, track = 'var(--color-surface-3)', children }: {
  value: number; size?: number; stroke?: number; color?: string; gradient?: [string, string]; track?: string; children?: ReactNode
}) {
  const id = useId().replace(/:/g, '')
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        {gradient && (
          <defs>
            <linearGradient id={`pr-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={gradient[0]} /><stop offset="1" stopColor={gradient[1]} />
            </linearGradient>
          </defs>
        )}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {v > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={gradient ? `url(#pr-${id})` : color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.22,1,.36,1)' }} />
        )}
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  )
}

/** Horizontal chunky progress bar with a gloss stripe. */
export function ProgressBar({ value, color = 'var(--color-brand)', track = 'var(--color-surface-3)', height = 12, className = '', label }: {
  value: number; color?: string; track?: string; height?: number; className?: string; label?: string
}) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={`relative overflow-hidden rounded-full ${className}`} style={{ height, background: track }}
      role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <div className="relative h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${v * 100}%`, background: color, minWidth: v > 0 ? height : 0 }}>
        {height >= 8 && <div className="absolute inset-x-[5px] top-[20%] h-[26%] rounded-full bg-white/35" />}
      </div>
    </div>
  )
}
