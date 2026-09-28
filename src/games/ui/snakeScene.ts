// OWNER: Games agent. Canvas renderer for Pānpan Snake: grid board, bamboo body, panda-face head, pinyin tokens.
import { DIR_VEC, type Cell, type Dir, type Snake, type Token } from '../logic/snake'
import { drawPinyin, type Palette } from './runnerScene'

const PANDA_INK = '#2b2533'
const PANDA_FUR = '#ffffff'

export interface SnakeView {
  w: number
  h: number
  cols: number
  rows: number
}

export type TokenMode = 'normal' | 'good' | 'bad' | 'dim'

export interface SnakeScene {
  time: number
  snake: Snake
  prev: readonly Cell[]
  /** 0..1 progress between the previous and current step. */
  alpha: number
  tokens: readonly Token[]
  modeOf(t: Token): TokenMode
  colored: boolean
  /** 0..1: red flash after a crash. */
  flash: number
  /** blink the snake (crash / respawn wait). */
  blink: boolean
  pulse: boolean
}

export const cellSize = (v: SnakeView) => Math.min(v.w / v.cols, v.h / v.rows)

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

/** Small panda face (head of the snake). Pupils look where the snake is heading. */
export function drawPandaHead(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dir: Dir) {
  const v = DIR_VEC[dir]
  // ears
  ctx.fillStyle = PANDA_INK
  ctx.beginPath(); ctx.arc(x - r * 0.72, y - r * 0.78, r * 0.36, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(x + r * 0.72, y - r * 0.78, r * 0.36, 0, Math.PI * 2); ctx.fill()
  // face
  ctx.fillStyle = PANDA_FUR
  ctx.strokeStyle = 'rgba(43,37,51,.35)'
  ctx.lineWidth = Math.max(1, r * 0.07)
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  // eye patches
  ctx.fillStyle = PANDA_INK
  for (const s of [-1, 1]) {
    ctx.save()
    ctx.translate(x + s * r * 0.38, y - r * 0.08)
    ctx.rotate(s * -0.55)
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.24, r * 0.34, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    ctx.fillStyle = PANDA_FUR
    ctx.beginPath(); ctx.arc(x + s * r * 0.38 + v.x * r * 0.05, y - r * 0.1 + v.y * r * 0.05, r * 0.1, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = PANDA_INK
  }
  // nose + mouth
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.32, r * 0.17, r * 0.11, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = PANDA_INK
  ctx.lineWidth = Math.max(1, r * 0.08)
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(x - r * 0.1, y + r * 0.44, r * 0.11, 0.1, Math.PI * 0.9); ctx.stroke()
  ctx.beginPath(); ctx.arc(x + r * 0.1, y + r * 0.44, r * 0.11, 0.1, Math.PI * 0.9); ctx.stroke()
}

export function drawSnakeScene(ctx: CanvasRenderingContext2D, v: SnakeView, pal: Palette, st: SnakeScene) {
  const cell = cellSize(v)
  const bw = cell * v.cols
  const bh = cell * v.rows
  const ox = (v.w - bw) / 2
  const oy = (v.h - bh) / 2
  ctx.clearRect(0, 0, v.w, v.h)

  // board: soft checker of moss and cream inside a bamboo frame
  ctx.fillStyle = pal.skyBottom
  ctx.fillRect(0, 0, v.w, v.h)
  ctx.save()
  ctx.translate(ox, oy)
  rr(ctx, 0, 0, bw, bh, cell * 0.35)
  ctx.save()
  ctx.clip()
  for (let y = 0; y < v.rows; y++) {
    for (let x = 0; x < v.cols; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? pal.grassA : pal.roadB
      ctx.globalAlpha = (x + y) % 2 === 0 ? 0.95 : 0.85
      ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5)
    }
  }
  ctx.globalAlpha = 1
  ctx.restore()

  // tokens
  for (const t of st.tokens) drawToken(ctx, t, cell, pal, st)

  // snake
  drawSnake(ctx, st, cell, pal)

  // crash flash
  if (st.flash > 0) {
    ctx.fillStyle = pal.bad
    ctx.globalAlpha = 0.35 * Math.min(1, st.flash)
    rr(ctx, 0, 0, bw, bh, cell * 0.35)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // frame (bamboo rail)
  ctx.lineWidth = Math.max(4, cell * 0.16)
  ctx.strokeStyle = pal.bamboo
  rr(ctx, 0, 0, bw, bh, cell * 0.35)
  ctx.stroke()
  ctx.lineWidth = Math.max(1.5, cell * 0.05)
  ctx.strokeStyle = pal.bambooLight
  rr(ctx, cell * 0.04, cell * 0.04, bw - cell * 0.08, bh - cell * 0.08, cell * 0.3)
  ctx.stroke()
  ctx.restore()
}

function drawToken(ctx: CanvasRenderingContext2D, t: Token, cell: number, pal: Palette, st: SnakeScene) {
  const mode = st.modeOf(t)
  const x = t.x * cell + cell * 0.07
  const y = t.y * cell + cell * 0.07
  const w = t.w * cell - cell * 0.14
  const h = t.h * cell - cell * 0.14
  const bob = st.pulse && mode === 'normal' ? Math.sin(st.time * 3 + t.x * 0.7 + t.y) * cell * 0.03 : 0
  ctx.save()
  ctx.translate(0, bob)
  if (mode === 'dim') ctx.globalAlpha = 0.45
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.14)'
  rr(ctx, x, y + cell * 0.1, w, h, cell * 0.32); ctx.fill()
  // plaque
  ctx.fillStyle = mode === 'good' ? pal.good : mode === 'bad' ? pal.bad : pal.plaque
  rr(ctx, x, y, w, h, cell * 0.32); ctx.fill()
  ctx.lineWidth = Math.max(2, cell * 0.09)
  ctx.strokeStyle = mode === 'good' ? pal.bamboo : mode === 'bad' ? pal.bad : pal.edge
  ctx.stroke()
  // lacquer studs
  ctx.fillStyle = mode === 'normal' || mode === 'dim' ? pal.gold : pal.plaque
  for (const s of [0, 1]) { ctx.beginPath(); ctx.arc(x + cell * 0.2 + s * (w - cell * 0.4), y + cell * 0.2, cell * 0.05, 0, Math.PI * 2); ctx.fill() }
  if (mode === 'good' || mode === 'bad') {
    ctx.save()
    // white text on solid faces
    drawPinyin(ctx, t.item.pinyin, x + w / 2, y + h / 2, w - cell * 0.3, h, false, { ...pal, ink: '#ffffff' })
    ctx.restore()
  } else {
    drawPinyin(ctx, t.item.pinyin, x + w / 2, y + h / 2, w - cell * 0.3, h, st.colored, pal)
  }
  ctx.restore()
}

function drawSnake(ctx: CanvasRenderingContext2D, st: SnakeScene, cell: number, pal: Palette) {
  const body = st.snake.body
  const n = body.length
  const a = st.alpha
  // interpolated centres, head first; segment i moves from prev[i] to body[i]
  const pts = body.map((c, i) => {
    const p = st.prev[i] ?? st.prev[st.prev.length - 1] ?? c
    return { x: (p.x + (c.x - p.x) * a + 0.5) * cell, y: (p.y + (c.y - p.y) * a + 0.5) * cell }
  })
  if (st.blink && Math.floor(st.time * 8) % 2 === 0) ctx.globalAlpha = 0.35
  const base = st.flash > 0 ? pal.bad : pal.bamboo
  // shadow
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(0,0,0,.16)'
  ctx.lineWidth = cell * 0.78
  ctx.beginPath()
  for (let i = n - 1; i >= 0; i--) { const p = pts[i]; if (i === n - 1) ctx.moveTo(p.x, p.y + cell * 0.08); else ctx.lineTo(p.x, p.y + cell * 0.08) }
  ctx.stroke()
  // body tube
  ctx.strokeStyle = base
  ctx.lineWidth = cell * 0.76
  ctx.beginPath()
  for (let i = n - 1; i >= 0; i--) { const p = pts[i]; if (i === n - 1) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y) }
  ctx.stroke()
  // lighter core
  ctx.strokeStyle = pal.bambooLight
  ctx.lineWidth = cell * 0.44
  ctx.beginPath()
  for (let i = n - 1; i >= 0; i--) { const p = pts[i]; if (i === n - 1) ctx.moveTo(p.x, p.y - cell * 0.06); else ctx.lineTo(p.x, p.y - cell * 0.06) }
  ctx.stroke()
  // bamboo nodes: a dark ring + highlight at every segment
  for (let i = n - 1; i >= 1; i--) {
    const p = pts[i]
    const r = cell * (0.38 - 0.06 * (i / n))
    ctx.strokeStyle = pal.bamboo
    ctx.lineWidth = Math.max(1.5, cell * 0.07)
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,.35)'
    ctx.beginPath(); ctx.ellipse(p.x - r * 0.3, p.y - r * 0.4, r * 0.28, r * 0.14, -0.5, 0, Math.PI * 2); ctx.fill()
  }
  // head
  const h = pts[0]
  drawPandaHead(ctx, h.x, h.y, cell * 0.56, st.snake.dir)
  ctx.globalAlpha = 1
}
