// Hand-drawn inline SVG art for the motivation layer: medals, chest, level ring, freeze.
import { useId, type ReactNode } from 'react'
import type { Tier } from './achievements'

const TIER_COLORS: Record<Tier | 'locked', { light: string; mid: string; dark: string; ribbon: [string, string] }> = {
  bronze: { light: '#f3c79b', mid: '#cd7f32', dark: '#8a4b1c', ribbon: ['#ef4444', '#b91c1c'] },
  silver: { light: '#f1f5f9', mid: '#b6c2d1', dark: '#64748b', ribbon: ['#3b82f6', '#1d4ed8'] },
  gold: { light: '#fff3b0', mid: '#facc15', dark: '#b7791f', ribbon: ['#16a34a', '#15803d'] },
  locked: { light: '#eef0f3', mid: '#d6d9de', dark: '#a8adb5', ribbon: ['#d1d5db', '#9ca3af'] },
}

export const TIER_LABEL: Record<Tier, string> = { bronze: 'Brons', silver: 'Silver', gold: 'Guld' }

/** Scalloped, slightly wobbly outline so medals look hand-drawn. */
function scallop(cx: number, cy: number, r: number, bumps: number, depth: number, seed: number): string {
  const pts: string[] = []
  const n = bumps * 2
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2
    const wobble = Math.sin(i * 1.7 + seed) * 0.6
    const rr = (i % 2 === 0 ? r : r - depth) + wobble
    pts.push(`${(cx + Math.cos(ang) * rr).toFixed(2)},${(cy + Math.sin(ang) * rr).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}

export function Medal({ tier, emoji, locked = false, size = 64, seed = 0 }: { tier: Tier; emoji: string; locked?: boolean; size?: number; seed?: number }) {
  const id = useId().replace(/:/g, '')
  const c = TIER_COLORS[locked ? 'locked' : tier]
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 64 74" aria-hidden="true" className="overflow-visible">
      <defs>
        <radialGradient id={`g${id}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={c.light} />
          <stop offset="60%" stopColor={c.mid} />
          <stop offset="100%" stopColor={c.dark} />
        </radialGradient>
      </defs>
      {/* ribbon tails */}
      <path d="M22 44 L14 70 L22 65 L27 72 L32 48 Z" fill={c.ribbon[0]} stroke={c.ribbon[1]} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M42 44 L50 70 L42 65 L37 72 L32 48 Z" fill={c.ribbon[1]} stroke={c.ribbon[1]} strokeWidth="1.5" strokeLinejoin="round" />
      {/* medal body */}
      <path d={scallop(32, 30, 27, 12, 2.6, seed)} fill={c.dark} />
      <path d={scallop(32, 29, 26, 12, 2.6, seed)} fill={`url(#g${id})`} stroke={c.dark} strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="32" cy="29" r="18.5" fill="none" stroke={c.light} strokeWidth="1.6" strokeDasharray="3 2.4" opacity={0.9} />
      {/* shine */}
      <path d="M16 20 Q20 12 28 10" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity={0.55} />
      {locked ? (
        <g transform="translate(32 30)" fill="none" stroke="#8b919a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="-7.5" y="-3" width="15" height="12" rx="2.5" fill="#f3f4f6" />
          <path d="M-4.5 -3 V-7 a4.5 4.5 0 0 1 9 0 V-3" />
        </g>
      ) : (
        <text x="32" y="30" textAnchor="middle" dominantBaseline="central" fontSize="20">{emoji}</text>
      )}
    </svg>
  )
}

/** Treasure chest; `state` open shows sparkles. */
export function Chest({ state, size = 56 }: { state: 'locked' | 'ready' | 'open'; size?: number }) {
  const grey = state === 'locked'
  const wood = grey ? '#cbd5e1' : '#c2703d'
  const woodDark = grey ? '#94a3b8' : '#8a4b1c'
  const metal = grey ? '#e2e8f0' : '#facc15'
  const metalDark = grey ? '#94a3b8' : '#b7791f'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="overflow-visible">
      {state === 'open' && (
        <g stroke="#facc15" strokeWidth="3" strokeLinecap="round">
          <path d="M32 14 V4" /><path d="M18 18 L12 10" /><path d="M46 18 L52 10" />
        </g>
      )}
      {/* base */}
      <path d="M9 32 Q9 30 11 30 H53 Q55 30 55 32 V54 Q55 57 52 57 H12 Q9 57 9 54 Z" fill={wood} stroke={woodDark} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M9 42 H55" stroke={woodDark} strokeWidth="2" />
      {/* lid */}
      {state === 'open' ? (
        <>
          <path d="M12 30 Q32 22 52 30" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
          <path d="M11 28 L15 12 Q32 6 49 12 L53 28 Z" fill={wood} stroke={woodDark} strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="22" cy="26" r="3" fill="#fde047" stroke="#ca8a04" /><circle cx="32" cy="24" r="3.4" fill="#fde047" stroke="#ca8a04" /><circle cx="41" cy="26" r="3" fill="#fde047" stroke="#ca8a04" />
        </>
      ) : (
        <path d="M9 31 Q9 16 32 15 Q55 16 55 31 Z" fill={wood} stroke={woodDark} strokeWidth="2.2" strokeLinejoin="round" />
      )}
      {/* straps + lock */}
      <path d="M19 30 V57 M45 30 V57" stroke={metal} strokeWidth="3.4" />
      <rect x="27" y="35" width="10" height="11" rx="2.5" fill={metal} stroke={metalDark} strokeWidth="1.8" />
      <circle cx="32" cy="40" r="1.6" fill={metalDark} />
    </svg>
  )
}

/** Circular ring with content; value 0..1. Own implementation so the look matches the badge chip. */
export function Ring({ value, size = 36, stroke = 4, color = 'var(--color-sky)', track = 'var(--color-line)', children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - v)} style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  )
}

/** Ice cube for "Streakskydd". */
export function FreezeIcon({ size = 24, dim = false }: { size?: number; dim?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ opacity: dim ? 0.35 : 1 }}>
      <path d="M6 10 L16 5 L26 10 V22 L16 27 L6 22 Z" fill="#bae6fd" stroke="#0284c7" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 10 L16 15 L26 10 M16 15 V27" fill="none" stroke="#0284c7" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 11 L14 9" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** Horizontal progress bar. */
export function Bar({ value, color = 'bg-warn', className = '' }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-2.5 overflow-hidden rounded-full bg-line ${className}`}>
      <div className={`h-full rounded-full ${color} transition-[width] duration-700 ease-out`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  )
}
