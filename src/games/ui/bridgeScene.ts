// OWNER: Games agent. Canvas renderer for Pānpans bro: side view of two cliffs, a gap, bamboo planks. Colours from CSS tokens.
import type { BridgeLayout } from '../logic/bridge'
import { drawPinyin, type Palette } from './runnerScene'

export interface PlankDraw {
  x: number
  y: number
  rot: number
  scale: number
  alpha: number
  text: string
  /** 0..1 crack progress (bad planks). */
  crack: number
}

export interface BridgeView { w: number; h: number }

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

/** Sky, sun, clouds, far hills and the river: the part of the scene that does not slide with the cliffs. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, v: BridgeView, pal: Palette, time: number, scroll: number, motion: boolean) {
  ctx.clearRect(0, 0, v.w, v.h)
  const g = ctx.createLinearGradient(0, 0, 0, v.h * 0.7)
  g.addColorStop(0, pal.skyTop)
  g.addColorStop(1, pal.skyBottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, v.w, v.h)
  // sun
  const sg = ctx.createRadialGradient(v.w * 0.7, v.h * 0.2, 4, v.w * 0.7, v.h * 0.2, v.h * 0.22)
  sg.addColorStop(0, pal.sun); sg.addColorStop(0.4, pal.sun); sg.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalAlpha = 0.8
  ctx.fillStyle = sg
  ctx.beginPath(); ctx.arc(v.w * 0.7, v.h * 0.2, v.h * 0.22, 0, Math.PI * 2); ctx.fill()
  // clouds
  ctx.fillStyle = pal.plaque
  ctx.globalAlpha = 0.65
  for (let i = 0; i < 3; i++) {
    const cx = (((i * 170 + (motion ? time * 0.006 : 0) - scroll * 0.25) % (v.w + 160)) + v.w + 160) % (v.w + 160) - 80
    const cy = v.h * (0.12 + i * 0.1)
    ctx.beginPath(); ctx.ellipse(cx, cy, 42, 10, 0, 0, Math.PI * 2); ctx.ellipse(cx + 20, cy - 7, 24, 11, 0, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
  // hills
  for (const [base, amp, freq, ph, col, a, par] of [
    [v.h * 0.6, v.h * 0.16, 0.012, 1, pal.hillFar, 0.4, 0.15], [v.h * 0.62, v.h * 0.11, 0.021, 3, pal.hillNear, 0.5, 0.3],
  ] as const) {
    ctx.globalAlpha = a
    ctx.fillStyle = col
    ctx.beginPath(); ctx.moveTo(0, v.h)
    for (let x = 0; x <= v.w + 10; x += 10) ctx.lineTo(x, base - amp * (0.6 + 0.4 * Math.sin((x + scroll * par) * freq + ph)) - amp * 0.3 * Math.sin((x + scroll * par) * freq * 2.3 + ph * 1.7))
    ctx.lineTo(v.w, v.h); ctx.closePath(); ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** River and mist at the bottom of the gap. */
function drawRiver(ctx: CanvasRenderingContext2D, v: BridgeView, pal: Palette, l: BridgeLayout, time: number, motion: boolean) {
  const top = l.groundY + l.plankH + 26
  const g = ctx.createLinearGradient(0, top, 0, v.h)
  g.addColorStop(0, pal.skyTop); g.addColorStop(1, pal.hillFar)
  ctx.fillStyle = g
  ctx.fillRect(l.gapL - 4, top, l.gapR - l.gapL + 8, v.h - top)
  ctx.strokeStyle = pal.plaque
  ctx.globalAlpha = 0.7
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  for (let k = 0; k < 3; k++) {
    const y = top + 14 + k * 16
    ctx.beginPath()
    for (let x = l.gapL; x <= l.gapR; x += 8) {
      const yy = y + Math.sin(x * 0.09 + (motion ? time * 0.003 : 0) * (1 + k * 0.4) + k) * 2.2
      if (x === l.gapL) ctx.moveTo(x, yy); else ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawBamboo(ctx: CanvasRenderingContext2D, pal: Palette, x: number, base: number, height: number, lean: number) {
  ctx.lineCap = 'round'
  const seg = 16
  const n = Math.max(2, Math.floor(height / seg))
  for (let i = 0; i < n; i++) {
    const y0 = base - i * seg
    const x0 = x + lean * i, x1 = x + lean * (i + 1)
    ctx.strokeStyle = pal.bamboo
    ctx.lineWidth = 6
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0 - seg + 2); ctx.stroke()
    ctx.strokeStyle = pal.bambooLight
    ctx.lineWidth = 2.4
    ctx.beginPath(); ctx.moveTo(x0 - 1, y0 - 1); ctx.lineTo(x1 - 1, y0 - seg + 3); ctx.stroke()
    ctx.strokeStyle = pal.bamboo
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x0 - 4, y0 - seg + 2); ctx.lineTo(x0 + 4, y0 - seg + 2); ctx.stroke()
  }
  // leaves
  ctx.fillStyle = pal.bambooLight
  const ty = base - n * seg
  const tx = x + lean * n
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(tx + s * 10, ty + 4, 12, 3.6, s * -0.5, 0, Math.PI * 2); ctx.fill()
  }
}

function drawCliff(ctx: CanvasRenderingContext2D, v: BridgeView, pal: Palette, x0: number, x1: number, edge: 'left' | 'right', l: BridgeLayout) {
  const top = l.groundY
  ctx.fillStyle = pal.roadA
  ctx.beginPath()
  ctx.moveTo(x0, top)
  ctx.lineTo(x1, top)
  // craggy face
  const face = edge === 'left' ? 1 : -1
  ctx.lineTo(x1 - face * 2, top + 40)
  ctx.lineTo(x1 - face * 7, top + 70)
  ctx.lineTo(x1 - face * 3, v.h)
  ctx.lineTo(x0, v.h)
  ctx.closePath()
  ctx.fill()
  // strata
  ctx.strokeStyle = pal.divider
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    const y = top + 30 + i * 30
    const a = edge === 'left' ? x0 : x1 - 44
    ctx.beginPath(); ctx.moveTo(a + 8 + i * 5, y); ctx.lineTo(a + 34 + i * 7, y + 3); ctx.stroke()
  }
  // grass lip
  ctx.fillStyle = pal.hillNear
  rr(ctx, x0 - 6, top - 5, x1 - x0 + 6 + (edge === 'left' ? 2 : 0), 12, 6)
  ctx.fill()
  ctx.fillStyle = pal.grassB
  ctx.globalAlpha = 0.6
  rr(ctx, x0 - 6, top - 5, x1 - x0 + 6, 5, 3)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawPost(ctx: CanvasRenderingContext2D, pal: Palette, x: number, top: number, time: number, motion: boolean) {
  ctx.fillStyle = pal.post
  rr(ctx, x - 3, top - 34, 6, 36, 2); ctx.fill()
  ctx.fillStyle = pal.lintel
  rr(ctx, x - 9, top - 36, 18, 5, 2); ctx.fill()
  // lantern
  const sway = motion ? Math.sin(time * 0.003 + x) * 1.6 : 0
  ctx.strokeStyle = pal.lintel
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(x, top - 31); ctx.lineTo(x + sway, top - 24); ctx.stroke()
  ctx.fillStyle = pal.lantern
  ctx.beginPath(); ctx.ellipse(x + sway, top - 19, 5.5, 6.5, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = pal.gold
  rr(ctx, x + sway - 3, top - 26, 6, 2, 1); ctx.fill()
}

export function drawPlank(ctx: CanvasRenderingContext2D, pal: Palette, p: PlankDraw, l: BridgeLayout, colored: boolean) {
  const w = l.plankW - 3
  const h = l.plankH
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rot)
  ctx.scale(p.scale, p.scale)
  ctx.globalAlpha = Math.max(0, p.alpha)
  ctx.fillStyle = 'rgba(0,0,0,.16)'
  rr(ctx, -w / 2, -h / 2 + 3, w, h, 5); ctx.fill()
  ctx.fillStyle = pal.gold
  rr(ctx, -w / 2, -h / 2, w, h, 5); ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = pal.lintel
  ctx.stroke()
  // wood grain + rope
  ctx.strokeStyle = 'rgba(165,42,27,.28)'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(-w / 2 + 6, -h / 2 + 5); ctx.lineTo(w / 2 - 6, -h / 2 + 5); ctx.moveTo(-w / 2 + 6, h / 2 - 5); ctx.lineTo(w / 2 - 6, h / 2 - 5); ctx.stroke()
  ctx.save()
  // white plate behind the text so tone colours stay readable
  ctx.fillStyle = pal.plaque
  ctx.globalAlpha = Math.max(0, p.alpha) * 0.88
  rr(ctx, -w / 2 + 4, -h / 2 + 3, w - 8, h - 6, 4); ctx.fill()
  ctx.restore()
  ctx.globalAlpha = Math.max(0, p.alpha)
  drawPinyin(ctx, p.text, 0, 0, w - 10, h - 4, colored, pal)
  if (p.crack > 0) {
    ctx.strokeStyle = pal.ink
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    const pts = [[-2, -h / 2], [3, -h / 6], [-4, h / 6], [2, h / 2]]
    const n = Math.max(1, Math.ceil(pts.length * p.crack))
    pts.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.stroke()
  }
  ctx.restore()
}

export interface WorldState {
  layout: BridgeLayout
  planks: PlankDraw[]
  /** Horizontal offset of the whole world (pan). */
  ox: number
  colored: boolean
}

/** Cliffs, posts, bamboo, river and planks of one gap, shifted by `ox`. */
export function drawWorld(ctx: CanvasRenderingContext2D, v: BridgeView, pal: Palette, st: WorldState, time: number, motion: boolean) {
  const l = st.layout
  ctx.save()
  ctx.translate(st.ox, 0)
  drawRiver(ctx, v, pal, l, time, motion)
  drawCliff(ctx, v, pal, -30, l.gapL, 'left', l)
  drawCliff(ctx, v, pal, l.gapR, v.w + 30, 'right', l)
  drawBamboo(ctx, pal, 9, l.groundY - 3, 78, 1.2)
  drawBamboo(ctx, pal, 24, l.groundY - 3, 52, 1.6)
  drawBamboo(ctx, pal, v.w - 10, l.groundY - 3, 86, -1.4)
  drawBamboo(ctx, pal, v.w - 26, l.groundY - 3, 56, -1.8)
  drawPost(ctx, pal, l.gapL - 6, l.groundY, time, motion)
  drawPost(ctx, pal, l.gapR + 6, l.groundY, time, motion)
  for (const p of st.planks) drawPlank(ctx, pal, p, l, st.colored)
  ctx.restore()
}
