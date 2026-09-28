// Surfaces. `raised` (default) = soft layered card; `outline` = flat bordered; `tinted`/`inset` = washed.
import type { HTMLAttributes } from 'react'

type Variant = 'raised' | 'outline' | 'tinted' | 'inset'
const V: Record<Variant, string> = {
  raised: 'border border-line/80 bg-surface shadow-card',
  outline: 'border-2 border-line bg-surface',
  tinted: 'bg-surface-2',
  inset: 'bg-surface-2 shadow-[inset_0_2px_0_rgb(0_0_0/0.03)]',
}

export function Card({ className = '', variant = 'raised', ...rest }: HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return <div {...rest} className={`rounded-3xl p-4 ${V[variant]} ${className}`} />
}
