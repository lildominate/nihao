// OWNER: Games agent. DPR-aware canvas sizing shared by the canvas games.
import { useEffect, useRef, type RefObject } from 'react'

export interface CanvasView { w: number; h: number; dpr: number }

/** Keeps `canvas` sized to `container` at devicePixelRatio (max 2). Returns a ref with the current size. */
export function useCanvasView(containerRef: RefObject<HTMLElement | null>, canvasRef: RefObject<HTMLCanvasElement | null>, onFit?: (v: CanvasView) => void) {
  const view = useRef<CanvasView>({ w: 375, h: 400, dpr: 1 })
  const cb = useRef(onFit)
  useEffect(() => { cb.current = onFit })
  useEffect(() => {
    const el = containerRef.current
    const cv = canvasRef.current
    if (!el || !cv) return
    const fit = () => {
      const r = el.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      view.current = { w: Math.max(1, r.width), h: Math.max(1, r.height), dpr }
      cv.width = Math.round(r.width * dpr)
      cv.height = Math.round(r.height * dpr)
      cb.current?.(view.current)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, canvasRef])
  return view
}
