// OWNER: Games agent. Canvas renderer for Pānpan-språnget: pseudo-3D road, parallax, bamboo, lanterns, gates.
// All colours come from the app's CSS tokens (read once), so it follows the light/dark theme.
import { parsePinyin } from '../../speech/pinyin'
import { LANES, project, horizonY, roadHalf, type Gate, type View } from '../logic/runner'

export interface Palette {
  skyTop: string; skyBottom: string; sun: string
  hillFar: string; hillNear: string
  grassA: string; grassB: string
  roadA: string; roadB: string; edge: string; divider: string
  bamboo: string; bambooLight: string
  lantern: string; gold: string
  post: string; lintel: string; plaque: string
  ink: string; inkMuted: string
  good: string; bad: string
  tones: string[]
}

export function readPalette(): Palette {
  const cs = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null
  const c = (name: string, fb: string) => (cs?.getPropertyValue(name).trim() || fb)
  return {
    skyTop: c('--color-sky-soft', '#ddf0fd'), skyBottom: c('--color-gold-soft', '#fff4d1'), sun: c('--color-gold', '#fbbf24'),
    hillFar: c('--color-brand-light', '#34c79a'), hillNear: c('--color-brand', '#12a179'),
    grassA: c('--color-brand-soft', '#d9f5ea'), grassB: c('--color-brand-light', '#34c79a'),
    roadA: c('--color-surface-3', '#efe5d6'), roadB: c('--color-surface-2', '#f7f0e6'),
    edge: c('--color-lacquer', '#d9412e'), divider: c('--color-line-dark', '#dccfbc'),
    bamboo: c('--color-brand-dark', '#0a7a5a'), bambooLight: c('--color-brand', '#12a179'),
    lantern: c('--color-lacquer', '#d9412e'), gold: c('--color-gold', '#fbbf24'),
    post: c('--color-lacquer', '#d9412e'), lintel: c('--color-lacquer-dark', '#a52a1b'), plaque: c('--color-surface', '#fffdf9'),
    ink: c('--color-ink', '#2a2331'), inkMuted: c('--color-ink-muted', '#7a7184'),
    good: c('--color-brand', '#12a179'), bad: c('--color-danger', '#e5484d'),
    tones: [c('--color-tone-5', '#6b7280'), c('--color-tone-1', '#e11d48'), c('--color-tone-2', '#16a34a'), c('--color-tone-3', '#2563eb'), c('--color-tone-4', '#9333ea'), c('--color-tone-5', '#6b7280')],
  }
}

export interface GateView { gate: Gate; mode: 'normal' | 'good' | 'bad' | 'dim' }

export interface SceneState {
  groundZ: number
  time: number
  laneX: number
  gates: GateView[] | null
  gateZ: number
  gateAlpha: number
  colored: boolean
  shakeX: number
  shakeY: number
  parallax: boolean
}

const FONT = '"Nunito", ui-rounded, system-ui, sans-serif'
const BAND = 0.22
const FAR = 8

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

function hills(ctx: CanvasRenderingContext2D, v: View, baseY: number, amp: number, freq: number, phase: number, color: string, alpha: number) {
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, baseY + 2)
  for (let x = 0; x <= v.w + 12; x += 12) {
    const y = baseY - amp * (0.6 + 0.4 * Math.sin(x * freq + phase)) - amp * 0.3 * Math.sin(x * freq * 2.3 + phase * 1.7)
    ctx.lineTo(x, y)
  }
  ctx.lineTo(v.w, baseY + 2)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawSky(ctx: CanvasRenderingContext2D, v: View, pal: Palette, st: SceneState) {
  const hy = horizonY(v)
  const g = ctx.createLinearGradient(0, 0, 0, hy)
  g.addColorStop(0, pal.skyTop)
  g.addColorStop(1, pal.skyBottom)
  ctx.fillStyle = g
  ctx.fillRect(-20, -20, v.w + 40, hy + 22)
  const par = st.parallax ? (st.laneX - 1) * -10 : 0
  // sun
  const sx = v.w * 0.72 + par * 0.4
  const sy = hy * 0.62
  const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, hy * 0.42)
  sg.addColorStop(0, pal.sun)
  sg.addColorStop(0.35, pal.sun)
  sg.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalAlpha = 0.85
  ctx.fillStyle = sg
  ctx.beginPath(); ctx.arc(sx, sy, hy * 0.42, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
  // clouds
  ctx.fillStyle = pal.plaque
  ctx.globalAlpha = 0.65
  for (let i = 0; i < 3; i++) {
    const cx = ((i * 190 + st.time * (st.parallax ? 6 : 0) + par * 0.6) % (v.w + 160)) - 80
    const cy = hy * (0.2 + i * 0.17)
    ctx.beginPath()
    ctx.ellipse(cx, cy, 44, 11, 0, 0, Math.PI * 2)
    ctx.ellipse(cx + 22, cy - 8, 26, 12, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  const drift = st.parallax ? st.time * 2 : 0
  hills(ctx, v, hy, hy * 0.42, 0.011, 1 + par * 0.02 + drift * 0.01, pal.hillFar, 0.4)
  hills(ctx, v, hy + 3, hy * 0.3, 0.02, 3 + par * 0.05 + drift * 0.02, pal.hillNear, 0.55)
}

function drawGround(ctx: CanvasRenderingContext2D, v: View, pal: Palette, st: SceneState) {
  const hy = horizonY(v)
  ctx.fillStyle = pal.grassA
  ctx.fillRect(-20, hy - 1, v.w + 40, v.h - hy + 30)
  const phase = st.groundZ % (2 * BAND)
  for (let k = -1; ; k++) {
    const z0 = Math.max(k * BAND - phase, -0.1)
    const z1 = Math.min(k * BAND - phase + BAND, FAR)
    if (z0 >= FAR) break
    if (z1 <= z0) continue
    const a = project(0, z0, v); const b = project(0, z1, v)
    const even = k % 2 === 0
    if (even) {
      ctx.globalAlpha = 0.3
      ctx.fillStyle = pal.grassB
      ctx.fillRect(-20, b.y, v.w + 40, a.y - b.y + 1)
      ctx.globalAlpha = 1
    }
    const l0 = project(-0.5, z0, v).x; const r0 = project(LANES - 0.5, z0, v).x
    const l1 = project(-0.5, z1, v).x; const r1 = project(LANES - 0.5, z1, v).x
    ctx.fillStyle = even ? pal.roadA : pal.roadB
    ctx.beginPath(); ctx.moveTo(l0, a.y + 1); ctx.lineTo(r0, a.y + 1); ctx.lineTo(r1, b.y); ctx.lineTo(l1, b.y); ctx.closePath(); ctx.fill()
    if (even) {
      ctx.fillStyle = pal.divider
      for (const d of [0.5, 1.5]) {
        const w0 = 3 * project(d, z0, v).scale
        const w1 = 3 * project(d, z1, v).scale
        const x0 = project(d, z0, v).x; const x1 = project(d, z1, v).x
        ctx.beginPath(); ctx.moveTo(x0 - w0, a.y + 1); ctx.lineTo(x0 + w0, a.y + 1); ctx.lineTo(x1 + w1, b.y); ctx.lineTo(x1 - w1, b.y); ctx.closePath(); ctx.fill()
      }
    }
  }
  // lacquer road edges
  ctx.strokeStyle = pal.edge
  ctx.lineCap = 'round'
  for (const e of [-0.5, LANES - 0.5]) {
    const a = project(e, -0.1, v); const b = project(e, FAR, v)
    ctx.lineWidth = Math.max(4, v.w * 0.014)
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  }
}

function bamboo(ctx: CanvasRenderingContext2D, v: View, pal: Palette, lane: number, z: number, seed: number, t: number) {
  const p = project(lane, z, v)
  const s = p.scale
  const stalks = 3
  for (let i = 0; i < stalks; i++) {
    const dx = (i - 1) * 16 * s
    const h = v.h * (0.34 + ((seed + i) % 3) * 0.06) * s
    const w = Math.max(2, 9 * s)
    ctx.fillStyle = i % 2 ? pal.bambooLight : pal.bamboo
    rr(ctx, p.x + dx - w / 2, p.y - h, w, h, w / 2); ctx.fill()
    ctx.fillStyle = pal.plaque
    ctx.globalAlpha = 0.35
    const seg = h / 5
    for (let n = 1; n < 5; n++) ctx.fillRect(p.x + dx - w / 2, p.y - n * seg, w, Math.max(1, 2 * s))
    ctx.globalAlpha = 1
    ctx.fillStyle = pal.bambooLight
    const sway = Math.sin(t * 1.6 + seed + i) * 3 * s
    ctx.beginPath()
    ctx.ellipse(p.x + dx + w + sway, p.y - h * 0.86, 14 * s, 4.5 * s, -0.5, 0, Math.PI * 2)
    ctx.ellipse(p.x + dx - w + sway, p.y - h * 0.7, 13 * s, 4 * s, 0.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

function lantern(ctx: CanvasRenderingContext2D, v: View, pal: Palette, lane: number, z: number, seed: number, t: number) {
  const p = project(lane, z, v)
  const s = p.scale
  const h = v.h * 0.3 * s
  const pw = Math.max(2, 6 * s)
  ctx.fillStyle = pal.lintel
  ctx.fillRect(p.x - pw / 2, p.y - h, pw, h)
  const sway = Math.sin(t * 1.8 + seed) * 4 * s
  const lx = p.x + (lane < 1 ? 1 : -1) * 16 * s + sway
  const ly = p.y - h * 0.86
  ctx.strokeStyle = pal.lintel
  ctx.lineWidth = Math.max(1, 2 * s)
  ctx.beginPath(); ctx.moveTo(p.x, p.y - h * 0.97); ctx.lineTo(lx, ly - 9 * s); ctx.stroke()
  ctx.fillStyle = pal.lantern
  ctx.beginPath(); ctx.ellipse(lx, ly + 2 * s, 12 * s, 15 * s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = pal.gold
  ctx.fillRect(lx - 6 * s, ly - 14 * s, 12 * s, 3 * s)
  ctx.fillRect(lx - 4 * s, ly + 15 * s, 8 * s, 3 * s)
  ctx.globalAlpha = 0.25
  ctx.beginPath(); ctx.ellipse(lx - 4 * s, ly - 2 * s, 3 * s, 8 * s, 0.3, 0, Math.PI * 2); ctx.fillStyle = pal.plaque; ctx.fill()
  ctx.globalAlpha = 1
}

function drawSides(ctx: CanvasRenderingContext2D, v: View, pal: Palette, st: SceneState) {
  const D = 0.5
  const base = Math.floor(st.groundZ / D)
  const off = st.groundZ - base * D
  for (let j = 14; j >= 0; j--) {
    const z = j * D - off
    if (z < -0.08) continue
    const idx = base + j
    if (z > 6) continue
    const alpha = z > 4 ? Math.max(0, (6 - z) / 2) : 1
    ctx.globalAlpha = alpha
    if (idx % 2 === 0) { bamboo(ctx, v, pal, -0.95, z, idx, st.time); lantern(ctx, v, pal, 2.95, z, idx, st.time) }
    else { lantern(ctx, v, pal, -0.95, z, idx, st.time); bamboo(ctx, v, pal, 2.95, z, idx, st.time) }
    ctx.globalAlpha = 1
  }
}

/** Pinyin with per-syllable tone colours, centred in a box; wraps onto two lines / shrinks to fit. */
export function drawPinyin(ctx: CanvasRenderingContext2D, pinyin: string, cx: number, cy: number, maxW: number, maxH: number, colored: boolean, pal: Palette) {
  const syl = parsePinyin(pinyin)
  let size = Math.min(maxH * 0.52, maxW * 0.42)
  if (size < 6) return
  const measure = (parts: typeof syl, fs: number) => {
    ctx.font = `800 ${fs}px ${FONT}`
    const sp = ctx.measureText(' ').width
    return parts.reduce((a, p, i) => a + ctx.measureText(p.text).width + (i > 0 && !p.isPunct ? sp : 0), 0)
  }
  let lines: (typeof syl)[] = [syl]
  let w = measure(syl, size)
  if (w > maxW && syl.length > 1) {
    // split where the running width crosses half
    let acc = 0
    let cut = 1
    const total = w
    for (let i = 0; i < syl.length; i++) { acc += measure([syl[i]], size); if (acc >= total / 2) { cut = Math.max(1, Math.min(syl.length - 1, i + 1)); break } }
    lines = [syl.slice(0, cut), syl.slice(cut)]
    size = Math.min(size, maxH * 0.36)
    w = Math.max(...lines.map((l) => measure(l, size)))
  }
  if (w > maxW) { size *= maxW / w; w = maxW }
  const lh = size * 1.12
  const y0 = cy - ((lines.length - 1) * lh) / 2
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  lines.forEach((parts, li) => {
    const lw = measure(parts, size)
    ctx.font = `800 ${size}px ${FONT}`
    const sp = ctx.measureText(' ').width
    let x = cx - lw / 2
    parts.forEach((p, i) => {
      if (i > 0 && !p.isPunct) x += sp
      ctx.fillStyle = colored && !p.isPunct ? pal.tones[p.tone] ?? pal.ink : pal.ink
      ctx.fillText(p.text, x, y0 + li * lh)
      x += ctx.measureText(p.text).width
    })
  })
}

function drawGate(ctx: CanvasRenderingContext2D, v: View, pal: Palette, gv: GateView, z: number, alpha: number, colored: boolean) {
  const p = project(gv.gate.lane, z, v)
  const s = p.scale
  const laneW = ((2 * roadHalf(v)) / LANES) * s * 0.9
  const gh = v.h * 0.36 * s
  const pw = Math.max(2, laneW * 0.07)
  const x0 = p.x - laneW / 2
  const top = p.y - gh
  ctx.globalAlpha = alpha * (gv.mode === 'dim' ? 0.55 : 1)
  ctx.fillStyle = gv.mode === 'good' ? pal.good : pal.gold
  ctx.globalAlpha *= gv.mode === 'good' ? 0.28 : 0.14
  ctx.fillRect(x0, top, laneW, gh)
  ctx.globalAlpha = alpha * (gv.mode === 'dim' ? 0.55 : 1)
  ctx.fillStyle = pal.post
  ctx.fillRect(x0 - pw / 2, top, pw, gh)
  ctx.fillRect(x0 + laneW - pw / 2, top, pw, gh)
  ctx.fillStyle = pal.lintel
  rr(ctx, x0 - pw * 1.3, top - gh * 0.07, laneW + pw * 2.6, gh * 0.13, gh * 0.04); ctx.fill()
  ctx.fillStyle = pal.gold
  ctx.fillRect(p.x - pw * 0.6, top - gh * 0.11, pw * 1.2, gh * 0.05)
  // plaque
  const px = x0 + pw * 1.6
  const pyTop = top + gh * 0.1
  const pwid = laneW - pw * 3.2
  const ph = gh * 0.5
  ctx.fillStyle = pal.plaque
  rr(ctx, px, pyTop, pwid, ph, ph * 0.16); ctx.fill()
  ctx.lineWidth = Math.max(2, 4 * s)
  ctx.strokeStyle = gv.mode === 'good' ? pal.good : gv.mode === 'bad' ? pal.bad : pal.edge
  ctx.stroke()
  drawPinyin(ctx, gv.gate.item.pinyin, px + pwid / 2, pyTop + ph / 2, pwid * 0.9, ph * 0.86, colored && gv.mode !== 'dim', pal)
  ctx.globalAlpha = 1
}

function drawBarrier(ctx: CanvasRenderingContext2D, v: View, pal: Palette, lane: number, z: number, alpha: number) {
  const p = project(lane, z, v)
  const s = p.scale
  const laneW = ((2 * roadHalf(v)) / LANES) * s * 0.86
  const h = v.h * 0.13 * s
  const pw = Math.max(2, laneW * 0.07)
  ctx.globalAlpha = alpha * 0.9
  ctx.fillStyle = pal.lintel
  ctx.fillRect(p.x - laneW / 2, p.y - h, pw, h)
  ctx.fillRect(p.x + laneW / 2 - pw, p.y - h, pw, h)
  for (const [f, col] of [[0.85, pal.edge], [0.45, pal.gold]] as const) {
    ctx.fillStyle = col
    rr(ctx, p.x - laneW / 2, p.y - h * f - h * 0.12, laneW, h * 0.24, h * 0.06); ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** Draws one full frame. Coordinates are CSS pixels (the caller has applied the DPR transform). */
export function drawScene(ctx: CanvasRenderingContext2D, v: View, pal: Palette, st: SceneState, allLanes: readonly number[] = [0, 1, 2]) {
  ctx.save()
  ctx.translate(st.shakeX, st.shakeY)
  drawSky(ctx, v, pal, st)
  drawGround(ctx, v, pal, st)
  drawSides(ctx, v, pal, st)
  if (st.gates && st.gateAlpha > 0.01) {
    const used = new Set(st.gates.map((g) => g.gate.lane))
    for (const l of allLanes) if (!used.has(l)) drawBarrier(ctx, v, pal, l, st.gateZ, st.gateAlpha)
    for (const gv of st.gates) drawGate(ctx, v, pal, gv, st.gateZ, st.gateAlpha, st.colored)
  }
  // runner shadow
  const pp = project(st.laneX, 0, v)
  ctx.globalAlpha = 0.22
  ctx.fillStyle = '#000'
  ctx.beginPath(); ctx.ellipse(pp.x, pp.y + 4, v.w * 0.09, v.w * 0.022, 0, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
}
