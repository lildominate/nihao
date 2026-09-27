// Bottom sheet with backdrop (Shell). Closes on backdrop tap / Escape.
import { useEffect, type ReactNode } from 'react'

export function Sheet({ open, onClose, children, labelledBy }: { open: boolean; onClose: () => void; children: ReactNode; labelledBy?: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className="absolute inset-0 animate-fade bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md animate-sheet rounded-t-3xl bg-surface px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
        {children}
      </div>
    </div>
  )
}
