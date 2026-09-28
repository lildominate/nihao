// Bottom sheet with soft blurred backdrop. Closes on backdrop tap / Escape.
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className="absolute inset-0 animate-fade bg-[#1b1220]/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-md animate-sheet overflow-y-auto rounded-t-[28px] border-t border-line bg-surface px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-float">
        <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-surface-3" />
        {children}
      </div>
    </div>
  )
}
