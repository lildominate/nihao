// Bottom sheet with soft blurred backdrop. Closes on backdrop tap / Escape.
// Accessible dialog: focus moves in on open, Tab/Shift+Tab are trapped, focus returns to the opener on close.
import { useEffect, useRef, type ReactNode } from 'react'
import { FOCUSABLE, nextFocusIndex } from './focusTrap'

export function Sheet({ open, onClose, children, labelledBy }: { open: boolean; onClose: () => void; children: ReactNode; labelledBy?: string }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const items = () => (panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement) : [])
    const first = items()[0]
    ;(first ?? panel)?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); return }
      if (e.key !== 'Tab' || !panel) return
      const list = items()
      if (!list.length) { e.preventDefault(); panel.focus(); return }
      const cur = list.indexOf(document.activeElement as HTMLElement)
      // Only take over at the edges (or when focus escaped); otherwise the browser's order is fine.
      const atEdge = cur < 0 || (e.shiftKey ? cur === 0 : cur === list.length - 1)
      if (atEdge) { e.preventDefault(); list[nextFocusIndex(cur, list.length, e.shiftKey)].focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (opener && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className="absolute inset-0 animate-fade bg-[#1b1220]/45 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} className="relative max-h-[92dvh] w-full max-w-md animate-sheet overflow-y-auto rounded-t-[28px] border-t border-line bg-surface px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-float outline-none">
        <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-surface-3" />
        {children}
      </div>
    </div>
  )
}
