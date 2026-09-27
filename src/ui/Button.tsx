// Shared primitive (lead). Chunky Duolingo-style button. Shell agent may restyle, not change props.
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
const styles: Record<Variant, string> = {
  primary: 'bg-brand text-white border-brand-dark hover:brightness-105',
  secondary: 'bg-surface text-ink border-line hover:bg-surface-2',
  danger: 'bg-danger text-white border-red-800 hover:brightness-105',
  ghost: 'bg-transparent text-ink-muted border-transparent hover:text-ink',
}

export function Button({ variant = 'primary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`select-none rounded-2xl border-2 border-b-4 px-5 py-3 text-[15px] font-extrabold uppercase tracking-wide transition-[transform,border-width,filter,background-color] active:translate-y-0.5 active:border-b-2 disabled:opacity-40 disabled:active:translate-y-0 disabled:active:border-b-4 ${styles[variant]} ${className}`}
    />
  )
}
