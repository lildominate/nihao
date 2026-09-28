// Small shared primitives: Badge, Chip, Stat, SectionHeader, IconButton, SegmentedControl, EmptyState.
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { Panda, type PandaMood } from '../mascot/Panda'

export type Tint = 'brand' | 'gold' | 'flame' | 'sky' | 'lacquer' | 'plum' | 'danger' | 'warn' | 'neutral'
const TINT: Record<Tint, { soft: string; ink: string; solid: string; edge: string }> = {
  brand: { soft: 'var(--color-brand-soft)', ink: 'var(--color-brand-dark)', solid: 'var(--color-brand)', edge: 'var(--color-brand-dark)' },
  gold: { soft: 'var(--color-gold-soft)', ink: 'var(--color-gold-dark)', solid: 'var(--color-gold)', edge: 'var(--color-gold-dark)' },
  flame: { soft: 'var(--color-flame-soft)', ink: 'var(--color-flame)', solid: 'var(--color-flame)', edge: '#c2540a' },
  sky: { soft: 'var(--color-sky-soft)', ink: 'var(--color-sky-dark)', solid: 'var(--color-sky)', edge: 'var(--color-sky-dark)' },
  lacquer: { soft: 'var(--color-lacquer-soft)', ink: 'var(--color-lacquer)', solid: 'var(--color-lacquer)', edge: 'var(--color-lacquer-dark)' },
  plum: { soft: 'var(--color-plum-soft)', ink: 'var(--color-plum)', solid: 'var(--color-plum)', edge: 'var(--color-plum-dark)' },
  danger: { soft: 'var(--color-danger-soft)', ink: 'var(--color-danger)', solid: 'var(--color-danger)', edge: 'var(--color-danger-dark)' },
  warn: { soft: 'var(--color-warn-soft)', ink: 'var(--color-warn-dark)', solid: 'var(--color-warn)', edge: 'var(--color-warn-dark)' },
  neutral: { soft: 'var(--color-surface-2)', ink: 'var(--color-ink-muted)', solid: 'var(--color-ink-muted)', edge: 'var(--color-ink)' },
}
export const tint = (t: Tint) => TINT[t]

/** Small pill label. `solid` = filled with white text. */
export function Badge({ tone = 'brand', solid, children, className = '', icon }: { tone?: Tint; solid?: boolean; children: ReactNode; className?: string; icon?: ReactNode }) {
  const t = TINT[tone]
  const style: CSSProperties = solid ? { background: t.solid, color: '#fff' } : { background: t.soft, color: t.ink }
  return (
    <span style={style} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap ${className}`}>
      {icon}{children}
    </span>
  )
}

/** Selectable chip (filters, options). */
export function Chip({ selected, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button type="button" aria-pressed={selected} {...rest}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-sm font-extrabold transition-colors ${selected ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line bg-surface text-ink-muted active:bg-surface-2'} ${className}`}>{children}</button>
  )
}

/** Stat tile: icon + big number + label. */
export function Stat({ icon, value, label, tone = 'neutral', className = '' }: { icon?: ReactNode; value: ReactNode; label: string; tone?: Tint; className?: string }) {
  const t = TINT[tone]
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-line/80 bg-surface p-3 shadow-card ${className}`}>
      {icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: t.soft, color: t.ink }}>{icon}</span>}
      <span className="min-w-0">
        <span className="block font-display text-xl leading-tight font-semibold">{value}</span>
        <span className="block truncate text-xs font-bold text-ink-muted">{label}</span>
      </span>
    </div>
  )
}

export function SectionHeader({ title, action, className = '' }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`mb-2.5 flex items-end justify-between gap-2 px-1 ${className}`}>
      <h2 className="font-display text-lg leading-tight font-semibold">{title}</h2>
      {action}
    </div>
  )
}

/** Round/square icon-only button (needs an aria-label). */
export function IconButton({ children, className = '', variant = 'plain', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'plain' | 'raised' | 'solid' }) {
  const v = variant === 'solid'
    ? 'btn-3d text-white [--face:var(--color-sky)] [--edge:var(--color-sky-dark)]'
    : variant === 'raised'
      ? 'btn-3d border-2 border-line text-ink [--face:var(--color-surface)] [--edge:var(--color-line-dark)] [--shine:0]'
      : 'text-ink-muted active:bg-surface-2'
  return <button type="button" {...rest} className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-colors ${v} ${className}`}>{children}</button>
}

/** iOS-style segmented control / tabs. */
export function SegmentedControl<T extends string>({ value, options, onChange, label, className = '' }: {
  value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label?: string; className?: string
}) {
  const i = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div role="radiogroup" aria-label={label} className={`relative grid rounded-2xl bg-surface-2 p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      <span aria-hidden="true" className="absolute top-1 bottom-1 left-1 rounded-xl bg-surface shadow-soft transition-transform duration-300 ease-out"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${i * 100}%)` }} />
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`relative z-10 flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-extrabold transition-colors ${o.value === value ? 'text-ink' : 'text-ink-muted'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Empty state with Pānpan. */
export function EmptyState({ mood = 'think', title, children, action, className = '' }: { mood?: PandaMood; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center px-6 py-10 text-center ${className}`}>
      <div className="relative mb-2">
        <div className="absolute inset-x-2 bottom-1 top-6 rounded-full bg-brand-soft blur-xl" aria-hidden="true" />
        <Panda mood={mood} size={128} className="relative" />
      </div>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {children && <div className="mt-1.5 max-w-xs font-semibold text-ink-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
