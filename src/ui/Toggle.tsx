// Chunky on/off switch (Shell).
import type { ReactNode } from 'react'
export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 py-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{label}</span>
        {description && <span className="block text-sm text-ink-muted">{description}</span>}
      </span>
      <span className={`relative h-8 w-14 shrink-0 rounded-full border-b-4 transition-colors ${checked ? 'border-brand-dark bg-brand' : 'border-gray-300 bg-line'}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] ${checked ? 'left-7' : 'left-1'}`} />
      </span>
    </button>
  )
}
