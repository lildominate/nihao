// Chunky on/off switch row.
import type { ReactNode } from 'react'

export function Toggle({ checked, onChange, label, description, icon }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode; icon?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 py-3 text-left">
      {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-muted">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{label}</span>
        {description && <span className="block text-sm leading-snug text-ink-muted">{description}</span>}
      </span>
      <span className={`relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-brand' : 'bg-surface-3'}`}
        style={{ boxShadow: `inset 0 2px 3px rgb(0 0 0 / ${checked ? 0.18 : 0.1})` }}>
        <span className={`absolute top-[3px] h-6 w-6 rounded-full bg-white shadow-[0_2px_4px_rgb(0_0_0/0.25)] transition-[left] duration-200 ease-out ${checked ? 'left-[25px]' : 'left-[3px]'}`} />
      </span>
    </button>
  )
}
