// OWNER: Motion agent. Hand-written canvas particle system for celebrate().
// One shared fixed full-screen canvas (pointer-events: none) that exists only while particles live.
import { prefersReducedMotion } from './reduced'

export type CelebrateKind = 'confetti' | 'burst' | 'fireworks' | 'stars'
export interface CelebrateOptions {
  /** Viewport (client) coordinates to emit from. */
  origin?: { x: number; y: number }
  /** Emit from the centre of this element (wins over `origin`). */
  from?: Element | null
  /** Override the palette (any CSS colour strings). */
  colors?: string[]
  /** 0.25–2, scales particle count. Default 1. */
  intensity?: number
}

const SHAPE_RECT = 0, SHAPE_CIRCLE = 1, SHAPE_STAR = 2, SHAPE_SPARK = 3, SHAPE_RING = 4, SHAPE_ROCKET = 5

interface P {
  x: number; y: number; vx: number; vy: number
  g: number; drag: number
  rot: number; vr: number; flip: number; vflip: number
  size: number; age: number; life: number
  color: string; shape: number
  sway: number; twinkle: number
  /** rocket: colour of its explosion */
  boom?: string
}

const MAX = 420
const MAX_REDUCED = 40
const FALLBACK: Record<string, string> = {
  '--color-brand': '#16a34a', '--color-tone-1': '#e11d48', '--color-tone-3': '#2563eb', '--color-tone-4': '#9333ea',
  '--color-gold': '#facc15', '--color-flame': '#f97316', '--color-sky': '#0ea5e9',
}

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let parts: P[] = []
let scheduled: { at: number; fn: () => void }[] = []
let raf = 0
let last = 0
let W = 0, H = 0, DPR = 1
let starPath: Path2D | null = null
let palette: string[] | null = null

function readPalette(): string[] {
  if (palette) return palette
  let cs: CSSStyleDeclaration | null = null
  try { cs = getComputedStyle(document.documentElement) } catch { /* ignore */ }
  palette = Object.keys(FALLBACK).map((k) => cs?.getPropertyValue(k).trim() || FALLBACK[k])
  return palette
}
const pick = <T,>(a: T[]): T => a[(Math.random() * a.length) | 0]
const rand = (a: number, b: number) => a + Math.random() * (b - a)

function getStar(): Path2D | null {
  if (starPath || typeof Path2D === 'undefined') return starPath
  const p = new Path2D()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 1 : 0.45
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    if (i === 0) p.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else p.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  p.closePath()
  starPath = p
  return p
}

function resize() {
  if (!canvas) return
  W = window.innerWidth
  H = window.innerHeight
  DPR = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(W * DPR)
  canvas.height = Math.round(H * DPR)
}

function ensureCanvas(): boolean {
  if (canvas) return true
  if (typeof document === 'undefined' || !document.body) return false
  const c = document.createElement('canvas')
  c.setAttribute('aria-hidden', 'true')
  c.className = 'mo-particles'
  c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;pointer-events:none;z-index:1100'
  const context = c.getContext('2d')
  if (!context) return false
  canvas = c
  ctx = context
  document.body.appendChild(c)
  resize()
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', onHidden)
  return true
}

function onHidden() { if (document.hidden) teardown() }

function teardown() {
  cancelAnimationFrame(raf)
  raf = 0
  last = 0
  window.removeEventListener('resize', resize)
  document.removeEventListener('visibilitychange', onHidden)
  canvas?.remove()
  canvas = null
  ctx = null
  parts = []
  scheduled = []
}

function add(p: Partial<P> & Pick<P, 'x' | 'y' | 'color' | 'shape' | 'life' | 'size'>, cap: number) {
  if (parts.length >= cap) return
  parts.push({ vx: 0, vy: 0, g: 0, drag: 1, rot: rand(0, Math.PI * 2), vr: 0, flip: rand(0, 6), vflip: 0, age: 0, sway: 0, twinkle: 0, ...p })
}

function explode(x: number, y: number, color: string, n: number, cap: number, k: number) {
  const gold = readPalette()[4]
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.08, 0.08)
    const s = rand(2.6, 6.4) * k
    add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.06, drag: 0.955, size: rand(2.2, 3.4), life: rand(55, 85), color: i % 7 === 0 ? gold : color, shape: SHAPE_SPARK }, cap)
  }
  add({ x, y, size: 6, life: 26, color, shape: SHAPE_RING }, cap + 1)
}

function frame(t: number) {
  if (!ctx || !canvas) return
  const dt = last ? Math.min(3, (t - last) / 16.667) : 1
  last = t
  const now = performance.now()
  if (scheduled.length) {
    const due = scheduled.filter((s) => s.at <= now)
    if (due.length) {
      scheduled = scheduled.filter((s) => s.at > now)
      due.forEach((s) => s.fn())
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const star = getStar()
  const cap = prefersReducedMotion() ? MAX_REDUCED : MAX
  const pal = readPalette()

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    p.age += dt
    if (p.age >= p.life || p.y > H + 60) {
      if (p.shape === SHAPE_ROCKET) explode(p.x, p.y, p.boom ?? pick(pal), 46, cap, Math.min(1.3, H / 800) * 1.1)
      parts[i] = parts[parts.length - 1]
      parts.pop()
      continue
    }
    const dragF = Math.pow(p.drag, dt)
    p.vx *= dragF
    p.vy = p.vy * dragF + p.g * dt
    if (p.sway) p.vx += Math.sin(p.age * 0.09 + p.flip) * p.sway * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rot += p.vr * dt
    p.flip += p.vflip * dt
    if (p.shape === SHAPE_ROCKET && p.vy > -0.6) p.age = p.life // apex → explode next frame

    const r = p.age / p.life
    const alpha = r < 0.7 ? 1 : 1 - (r - 0.7) / 0.3
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.strokeStyle = p.color
    const cos = Math.cos(p.rot), sin = Math.sin(p.rot)

    switch (p.shape) {
      case SHAPE_RECT: {
        const fy = Math.cos(p.flip) // 3D paper flip
        ctx.setTransform(DPR * cos, DPR * sin, -DPR * sin * fy, DPR * cos * fy, DPR * p.x, DPR * p.y)
        ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6)
        break
      }
      case SHAPE_CIRCLE:
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2)
        ctx.fill()
        break
      case SHAPE_STAR: {
        const s = p.size * (p.twinkle ? 0.8 + 0.25 * Math.sin(p.age * p.twinkle) : 1)
        if (star) {
          ctx.setTransform(DPR * cos * s, DPR * sin * s, -DPR * sin * s, DPR * cos * s, DPR * p.x, DPR * p.y)
          ctx.fill(star)
        }
        break
      }
      case SHAPE_SPARK:
      case SHAPE_ROCKET: {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
        ctx.lineWidth = p.size
        ctx.lineCap = 'round'
        ctx.beginPath()
        const tail = p.shape === SHAPE_ROCKET ? 3 : 2.2
        ctx.moveTo(p.x - p.vx * tail, p.y - p.vy * tail)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
        break
      }
      case SHAPE_RING: {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
        ctx.globalAlpha = (1 - r) * 0.7
        ctx.lineWidth = 3 * (1 - r) + 0.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size + r * 64, 0, Math.PI * 2)
        ctx.stroke()
        break
      }
    }
  }
  ctx.globalAlpha = 1

  if (parts.length === 0 && scheduled.length === 0) teardown()
  else raf = requestAnimationFrame(frame)
}

function start() {
  if (!raf) {
    last = 0
    raf = requestAnimationFrame(frame)
  }
}

/** Fire a celebration (canvas overlay, auto-cleans). Respects reduced motion (far fewer, gentler particles). */
export function celebrate(kind: CelebrateKind = 'confetti', opts: CelebrateOptions = {}): void {
  if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') return
  if (typeof document !== 'undefined' && document.hidden) return
  if (!ensureCanvas()) return
  const reduced = prefersReducedMotion()
  const cap = reduced ? MAX_REDUCED : MAX
  const pal = opts.colors?.length ? opts.colors : readPalette()
  const intensity = Math.max(0.25, Math.min(2, opts.intensity ?? 1))
  const k = Math.min(1.3, Math.max(0.7, H / 800)) // scale speeds to viewport height
  let ox = W / 2, oy = H * 0.42
  if (opts.from) {
    const r = opts.from.getBoundingClientRect()
    ox = r.left + r.width / 2
    oy = r.top + r.height / 2
  } else if (opts.origin) {
    ox = opts.origin.x
    oy = opts.origin.y
  }
  const n = (base: number) => Math.round(base * intensity * (reduced ? 0.15 : 1))
  const now = performance.now()

  if (reduced) {
    // Gentle: a few pieces that drift slowly and fade; no cannons, rockets or fast bursts.
    const count = n(kind === 'confetti' ? 140 : 60)
    for (let i = 0; i < count; i++) {
      add({
        x: kind === 'confetti' ? rand(0, W) : ox + rand(-40, 40), y: kind === 'confetti' ? rand(-20, H * 0.3) : oy + rand(-30, 30),
        vx: rand(-0.3, 0.3), vy: rand(0.2, 0.7), size: kind === 'stars' ? rand(6, 9) : rand(6, 9), life: rand(50, 80),
        color: pick(pal), shape: kind === 'stars' ? SHAPE_STAR : kind === 'confetti' ? SHAPE_RECT : SHAPE_CIRCLE,
      }, cap)
    }
    start()
    return
  }

  switch (kind) {
    case 'confetti': {
      const each = n(75)
      for (const side of [0, 1]) {
        const x0 = side === 0 ? -10 : W + 10
        for (let i = 0; i < each; i++) {
          const a = -Math.PI / 2 + (side === 0 ? 1 : -1) * rand(0.25, 0.75)
          const s = rand(11, 21) * k
          add({
            x: x0, y: H * 0.8 + rand(-20, 20), vx: Math.cos(a) * s, vy: Math.sin(a) * s,
            g: 0.3, drag: 0.972, vr: rand(-0.2, 0.2), vflip: rand(0.08, 0.25), sway: 0.03,
            size: rand(7, 12), life: rand(150, 220), color: pick(pal), shape: Math.random() < 0.8 ? SHAPE_RECT : SHAPE_CIRCLE,
          }, cap)
        }
      }
      // a soft second wave from the top
      scheduled.push({ at: now + 350, fn: () => {
        for (let i = 0; i < n(40); i++) {
          add({ x: rand(0, W), y: rand(-60, -10), vx: rand(-1, 1), vy: rand(1, 3), g: 0.05, drag: 0.99, vr: rand(-0.15, 0.15), vflip: rand(0.08, 0.2), sway: 0.04, size: rand(7, 11), life: rand(160, 220), color: pick(pal), shape: SHAPE_RECT }, cap)
        }
      } })
      break
    }
    case 'burst': {
      const count = n(34)
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rand(-0.2, 0.2)
        const s = rand(3.5, 9) * k
        const shape = i % 3 === 0 ? SHAPE_STAR : i % 3 === 1 ? SHAPE_CIRCLE : SHAPE_RECT
        add({ x: ox, y: oy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, g: 0.2, drag: 0.92, vr: rand(-0.3, 0.3), vflip: rand(0.1, 0.3), size: shape === SHAPE_STAR ? rand(5, 8) : rand(6, 9), life: rand(40, 65), color: pick(pal), shape }, cap)
      }
      add({ x: ox, y: oy, size: 10, life: 28, color: pal[0], shape: SHAPE_RING }, cap + 1)
      break
    }
    case 'fireworks': {
      const rockets = Math.max(1, Math.round(5 * intensity))
      for (let i = 0; i < rockets; i++) {
        scheduled.push({ at: now + i * 320 + rand(0, 120), fn: () => {
          const targetY = rand(H * 0.12, H * 0.4)
          const g = 0.22
          const vy = -Math.sqrt(2 * g * (H - targetY))
          add({ x: rand(W * 0.18, W * 0.82), y: H + 8, vx: rand(-0.8, 0.8), vy, g, drag: 1, size: 3, life: 400, color: pal[4] ?? '#facc15', shape: SHAPE_ROCKET, boom: pick(pal) }, cap)
        } })
      }
      break
    }
    case 'stars': {
      const count = n(22)
      const gold = ['#facc15', '#fde047', '#fbbf24', '#f59e0b']
      const cols = opts.colors?.length ? pal : gold
      for (let i = 0; i < count; i++) {
        const a = -Math.PI / 2 + rand(-1.3, 1.3)
        const s = rand(3, 9) * k
        add({ x: ox + rand(-10, 10), y: oy + rand(-10, 10), vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.14, drag: 0.95, vr: rand(-0.12, 0.12), twinkle: rand(0.2, 0.4), size: rand(7, 14), life: rand(70, 110), color: pick(cols), shape: SHAPE_STAR }, cap)
      }
      break
    }
  }
  start()
}

/** Number of live particles (debug/tests). */
export function particleCount(): number { return parts.length }
