// Shared primitive. Chunky 3D button (face + bottom lip that sinks on press).
// Props are a superset of v1 (variant/className/...rest), so existing callers keep working.
import type { ButtonHTMLAttributes, CSSProperties } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent' | 'gold' | 'sky' | 'plum' | 'soft'
type Face = { face: string; edge: string; text: string; glow?: string; border?: string }

const grad = (c: string) => `linear-gradient(180deg, color-mix(in oklab, ${c} 78%, white), ${c} 60%)`
const FACES: Record<Exclude<ButtonVariant, 'ghost'>, Face> = {
  primary: { face: grad('var(--color-brand)'), edge: 'var(--color-brand-dark)', text: 'var(--color-on-color)', glow: 'color-mix(in oklab, var(--color-brand) 55%, transparent)' },
  accent: { face: grad('var(--color-lacquer)'), edge: 'var(--color-lacquer-dark)', text: 'var(--color-on-color)', glow: 'color-mix(in oklab, var(--color-lacquer) 55%, transparent)' },
  danger: { face: grad('var(--color-danger)'), edge: 'var(--color-danger-dark)', text: 'var(--color-on-color)' },
  gold: { face: 'linear-gradient(180deg, #ffd865, #fbbf24 60%)', edge: 'var(--color-gold-dark)', text: '#5a3b00' },
  sky: { face: grad('var(--color-sky)'), edge: 'var(--color-sky-dark)', text: 'var(--color-on-color)' },
  plum: { face: grad('var(--color-plum)'), edge: 'var(--color-plum-dark)', text: 'var(--color-on-color)' },
  soft: { face: 'var(--color-brand-soft)', edge: 'color-mix(in oklab, var(--color-brand) 30%, var(--color-brand-soft))', text: 'var(--color-brand-dark)' },
  secondary: { face: 'var(--color-surface)', edge: 'var(--color-line-dark)', text: 'var(--color-ink)', border: 'var(--color-line)' },
}

const SIZES = {
  sm: 'min-h-10 rounded-xl px-3.5 py-2 text-[15px]',
  md: 'min-h-13 rounded-2xl px-5 py-3 text-[17px]',
  lg: 'min-h-15 rounded-[20px] px-6 py-3.5 text-lg',
} as const

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: keyof typeof SIZES
  /** Custom colours (e.g. a unit colour): face = background, edge = bottom lip. */
  colors?: { face: string; edge: string; text?: string }
}

export function Button({ variant = 'primary', size = 'md', colors, className = '', style, ...rest }: ButtonProps) {
  const base = `inline-flex select-none items-center justify-center gap-2 font-display font-semibold tracking-[0.01em] leading-tight ${SIZES[size]}`
  if (variant === 'ghost' && !colors) {
    return (
      <button type="button" {...rest} style={style}
        className={`press ${base} bg-transparent text-ink-muted transition-colors hover:text-ink active:opacity-70 disabled:opacity-40 ${className}`} />
    )
  }
  const f: Face = colors
    ? { face: colors.face, edge: colors.edge, text: colors.text ?? 'var(--color-on-color)' }
    : FACES[variant as Exclude<ButtonVariant, 'ghost'>] ?? FACES.primary
  const vars = {
    '--face': f.face, '--edge': f.edge, '--glow': f.glow ?? 'transparent', color: f.text,
    ...(f.border ? { border: `2px solid ${f.border}`, '--shine': 0 } : {}),
    ...style,
  } as CSSProperties
  return <button type="button" {...rest} style={vars} className={`btn-3d press ${base} ${className}`} />
}
