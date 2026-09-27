// Rounded bordered card with chunky bottom edge (Shell).
import type { HTMLAttributes } from 'react'

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={`rounded-3xl border-2 border-b-4 border-line bg-surface p-4 ${className}`} />
}
