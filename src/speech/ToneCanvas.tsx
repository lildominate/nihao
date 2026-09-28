// OWNER: Speech/Lab agent. Canvas drawing of ideal tone contours with the learner's pitch on top.
import { useEffect, useRef } from 'react'
import type { AttemptResult, SyllableTarget } from './pitch/contour'
import { idealContour } from './pitch/contour'

export interface LivePoint { t: number; v: number | null }

export interface ToneCanvasProps {
  targets: SyllableTarget[]
  /** Analysed attempt: learner contour per syllable, drawn over the ideal. */
  result?: AttemptResult | null
  /** Live trace while recording: t in ms, v = 0–1 height (null = silence). */
  live?: LivePoint[] | null
  liveMaxMs?: number
  height?: number
  className?: string
}

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

const TONE_FALLBACK = ['', '#e11d48', '#16a34a', '#2563eb', '#9333ea', '#6b7280']

/** Canvas with one slot per syllable: thick translucent ideal contour + dark learner line. */
export function ToneCanvas({ targets, result, live, liveMaxMs = 4000, height = 170, className = '' }: ToneCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = ref.current, box = wrap.current
    if (!canvas || !box) return
    const draw = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      const w = box.clientWidth || 300
      const h = height
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
      }
      const g = canvas.getContext('2d')
      if (!g) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const ink = cssVar('--color-ink', '#1f2937')
      const line = cssVar('--color-line', '#e5e7eb')
      const muted = cssVar('--color-ink-muted', '#6b7280')
      const toneColor = (t: number) => cssVar(`--color-tone-${t}`, TONE_FALLBACK[t] ?? ink)

      const padT = 14, padB = 12, padX = 10
      const plotH = h - padT - padB
      const y = (v: number) => padT + (1 - Math.max(-0.15, Math.min(1.15, v))) * plotH

      // Chao levels 1–5 grid
      g.lineWidth = 1
      for (let lvl = 0; lvl <= 4; lvl++) {
        g.strokeStyle = line
        g.setLineDash(lvl === 0 || lvl === 4 ? [] : [3, 5])
        g.beginPath()
        g.moveTo(padX, y(lvl / 4))
        g.lineTo(w - padX, y(lvl / 4))
        g.stroke()
      }
      g.setLineDash([])
      g.fillStyle = muted
      g.font = '600 10px Nunito, system-ui, sans-serif'
      g.fillText('hög', padX + 2, y(1) - 4)
      g.fillText('låg', padX + 2, y(0) + 11)

      const n = Math.max(1, targets.length)
      const slotW = (w - padX * 2) / n
      const inner = slotW * 0.14
      targets.forEach((t, i) => {
        const x0 = padX + i * slotW + inner, x1 = padX + (i + 1) * slotW - inner
        if (i > 0) {
          g.strokeStyle = line
          g.setLineDash([2, 4])
          g.beginPath(); g.moveTo(padX + i * slotW, padT); g.lineTo(padX + i * slotW, h - padB); g.stroke()
          g.setLineDash([])
        }
        const ideal = idealContour(t.surface, { final: t.final })
        const neutral = t.surface === 5
        const xs = (k: number, len: number) => neutral ? x0 + (x1 - x0) * (0.35 + 0.3 * (len > 1 ? k / (len - 1) : 0)) : x0 + ((x1 - x0) * k) / Math.max(1, len - 1)
        g.strokeStyle = toneColor(t.surface)
        g.globalAlpha = 0.28
        g.lineWidth = Math.min(18, Math.max(10, slotW * 0.1))
        g.lineCap = 'round'
        g.lineJoin = 'round'
        g.beginPath()
        ideal.forEach((v, k) => { const px = xs(k, ideal.length), py = y(v); if (k) g.lineTo(px, py); else g.moveTo(px, py) })
        g.stroke()
        g.globalAlpha = 1

        // learner
        const s = result?.syllables[i]
        if (!live && s && s.norm.length >= 2) {
          g.strokeStyle = s.scored ? (s.ok ? ink : cssVar('--color-danger', '#dc2626')) : muted
          g.lineWidth = 3.5
          g.beginPath()
          s.norm.forEach((v, k) => { const px = x0 + ((x1 - x0) * k) / (s.norm.length - 1), py = y(v); if (k) g.lineTo(px, py); else g.moveTo(px, py) })
          g.stroke()
          const lastV = s.norm[s.norm.length - 1]
          g.fillStyle = g.strokeStyle
          g.beginPath(); g.arc(x1, y(lastV), 4.5, 0, Math.PI * 2); g.fill()
        }
      })

      // live trace across the whole width
      if (live && live.length) {
        g.strokeStyle = ink
        g.lineWidth = 3
        g.lineCap = 'round'
        g.beginPath()
        let pen = false
        for (const p of live) {
          if (p.v === null) { pen = false; continue }
          const px = padX + ((w - padX * 2) * Math.min(1, p.t / liveMaxMs))
          const py = y(p.v)
          if (pen) g.lineTo(px, py); else g.moveTo(px, py)
          pen = true
        }
        g.stroke()
        const lastP = [...live].reverse().find((p) => p.v !== null)
        if (lastP && lastP.v !== null) {
          g.fillStyle = cssVar('--color-danger', '#dc2626')
          g.beginPath()
          g.arc(padX + ((w - padX * 2) * Math.min(1, lastP.t / liveMaxMs)), y(lastP.v), 5, 0, Math.PI * 2)
          g.fill()
        }
      }
    }
    draw()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => draw()) : null
    ro?.observe(box)
    return () => { ro?.disconnect() }
  }, [targets, result, live, liveMaxMs, height])

  return (
    <div ref={wrap} className={`w-full ${className}`}>
      <canvas ref={ref} className="block w-full" style={{ height }} role="img"
        aria-label={result ? `Din ton jämfört med målet: ${result.score} av 100` : 'Tonkurva att härma'} />
    </div>
  )
}
