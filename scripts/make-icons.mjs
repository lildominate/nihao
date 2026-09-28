// Generates the app icons (SVG + PNG) and iOS launch images in public/, using only Node built-ins.
// The icon is Pānpan's face on a jade tile. Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const BG = '#12a179', BG_LIGHT = '#3fcf9f', BG_DARK = '#0a7a5a'
const CANVAS = '#fbf5ec'
const INK = '#2b2533', INK_2 = '#57506a', WHITE = '#ffffff', BLUSH = '#ff9aa6', SCARF = '#d9412e', JADE = '#2fbf8f'

// ── Geometry (512×512 design space), painted in order ─────────
// kinds: circle {cx,cy,r} · ellipse {cx,cy,rx,ry,rot(deg)} · line {pts,w} (round caps)
const SHAPES = [
  { k: 'ellipse', cx: 256, cy: 540, rx: 170, ry: 130, rot: 0, c: WHITE },           // body
  { k: 'ellipse', cx: 256, cy: 432, rx: 150, ry: 34, rot: 0, c: SCARF },            // red-lacquer scarf
  { k: 'circle', cx: 256, cy: 456, r: 17, c: JADE },
  { k: 'circle', cx: 148, cy: 142, r: 62, c: INK }, { k: 'circle', cx: 150, cy: 148, r: 28, c: INK_2 },
  { k: 'circle', cx: 364, cy: 142, r: 62, c: INK }, { k: 'circle', cx: 362, cy: 148, r: 28, c: INK_2 },
  { k: 'ellipse', cx: 256, cy: 270, rx: 184, ry: 156, rot: 0, c: WHITE },
  { k: 'ellipse', cx: 182, cy: 276, rx: 46, ry: 60, rot: 38, c: INK },
  { k: 'ellipse', cx: 330, cy: 276, rx: 46, ry: 60, rot: -38, c: INK },
  { k: 'ellipse', cx: 132, cy: 344, rx: 32, ry: 19, rot: 0, c: BLUSH },
  { k: 'ellipse', cx: 380, cy: 344, rx: 32, ry: 19, rot: 0, c: BLUSH },
  { k: 'circle', cx: 188, cy: 270, r: 26, c: WHITE }, { k: 'circle', cx: 188, cy: 272, r: 18, c: INK }, { k: 'circle', cx: 195, cy: 264, r: 7, c: WHITE },
  { k: 'circle', cx: 324, cy: 270, r: 26, c: WHITE }, { k: 'circle', cx: 324, cy: 272, r: 18, c: INK }, { k: 'circle', cx: 331, cy: 264, r: 7, c: WHITE },
  { k: 'ellipse', cx: 256, cy: 322, rx: 22, ry: 15, rot: 0, c: INK },
  { k: 'line', pts: Array.from({ length: 9 }, (_, i) => { const t = i / 8; return [230 + 52 * t, 354 + 64 * t * (1 - t)] }), w: 9, c: INK },
]

// ── SVG ───────────────────────────────────────────────────────
function shapeSvg(s) {
  if (s.k === 'circle') return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${s.c}"/>`
  if (s.k === 'ellipse') return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}"${s.rot ? ` transform="rotate(${s.rot} ${s.cx} ${s.cy})"` : ''} fill="${s.c}"/>`
  return `<polyline points="${s.pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${s.c}" stroke-width="${s.w * 2}" stroke-linecap="round" stroke-linejoin="round"/>`
}
function svg({ maskable = false } = {}) {
  const s = maskable ? 0.8 : 0.92
  const t = `translate(${256 - 256 * s} ${256 - 256 * s + 10}) scale(${s})`
  const clip = maskable ? '' : '<clipPath id="c"><rect width="512" height="512" rx="112"/></clipPath>'
  const bg = `<rect width="512" height="512" ${maskable ? '' : 'rx="112"'} fill="url(#g)"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="g" cx="30%" cy="18%" r="95%"><stop offset="0" stop-color="${BG_LIGHT}"/><stop offset=".55" stop-color="${BG}"/><stop offset="1" stop-color="${BG_DARK}"/></radialGradient>${clip}</defs>${bg}<g${maskable ? '' : ' clip-path="url(#c)"'}><g transform="${t}">${SHAPES.map(shapeSvg).join('')}</g></g></svg>\n`
}

// ── Raster ────────────────────────────────────────────────────
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
function inRoundRect(x, y, rx, ry, rw, rh, r) {
  const cx = Math.max(rx + r, Math.min(x, rx + rw - r))
  const cy = Math.max(ry + r, Math.min(y, ry + rh - r))
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh && (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}
function segDist(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - ax - t * dx, y - ay - t * dy)
}
function hit(s, u, v) {
  if (s.k === 'circle') return (u - s.cx) ** 2 + (v - s.cy) ** 2 <= s.r * s.r
  if (s.k === 'ellipse') {
    const a = (-s.rot * Math.PI) / 180, x = u - s.cx, y = v - s.cy
    const xr = x * Math.cos(a) - y * Math.sin(a), yr = x * Math.sin(a) + y * Math.cos(a)
    return (xr / s.rx) ** 2 + (yr / s.ry) ** 2 <= 1
  }
  for (let i = 0; i < s.pts.length - 1; i++) if (segDist(u, v, s.pts[i], s.pts[i + 1]) <= s.w) return true
  return false
}
/** Colour of the panda at design-space (u,v), or null if none. */
function panda(u, v) {
  let c = null
  for (const s of SHAPES) if (hit(s, u, v)) c = s.c
  return c
}
const BG_RGB = [hex(BG_LIGHT), hex(BG), hex(BG_DARK)]
function tileBg(x, y) {
  const d = Math.min(1, Math.hypot(x - 154, y - 92) / 486)
  return d < 0.55 ? lerp(BG_RGB[0], BG_RGB[1], d / 0.55) : lerp(BG_RGB[1], BG_RGB[2], (d - 0.55) / 0.45)
}
function iconSample(x, y, { maskable, rounded, s }) {
  if (rounded && !maskable && !inRoundRect(x, y, 0, 0, 512, 512, 112)) return null
  const u = (x - (256 - 256 * s)) / s, v = (y - (256 - 256 * s + 10)) / s
  const c = panda(u, v)
  return c ? hex(c) : tileBg(x, y)
}
function rasterIcon(size, opts) {
  const N = 4, px = Buffer.alloc(size * size * 4)
  const o = { maskable: false, rounded: true, s: 0.92, ...opts }
  if (o.maskable && !opts.s) o.s = 0.8
  for (let py = 0; py < size; py++) for (let pxi = 0; pxi < size; pxi++) {
    let r = 0, g = 0, b = 0, a = 0
    for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
      const c = iconSample(((pxi + (sx + 0.5) / N) / size) * 512, ((py + (sy + 0.5) / N) / size) * 512, o)
      if (c) { r += c[0]; g += c[1]; b += c[2]; a++ }
    }
    const i = (py * size + pxi) * 4
    if (a) { px[i] = r / a; px[i + 1] = g / a; px[i + 2] = b / a }
    px[i + 3] = Math.round((a / (N * N)) * 255)
  }
  return png(size, size, px)
}

/** iOS launch image: warm canvas colour with the jade panda tile centred (only the tile is supersampled). */
function rasterSplash(w, h) {
  const px = Buffer.alloc(w * h * 4)
  const [cr, cg, cb] = hex(CANVAS)
  for (let i = 0; i < w * h; i++) { px[i * 4] = cr; px[i * 4 + 1] = cg; px[i * 4 + 2] = cb; px[i * 4 + 3] = 255 }
  const tile = Math.round(w * 0.34), x0 = Math.round((w - tile) / 2), y0 = Math.round(h * 0.42 - tile / 2), N = 3
  const o = { maskable: false, rounded: true, s: 0.92 }
  for (let py = 0; py < tile; py++) for (let pxi = 0; pxi < tile; pxi++) {
    let r = 0, g = 0, b = 0, a = 0
    for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
      const c = iconSample(((pxi + (sx + 0.5) / N) / tile) * 512, ((py + (sy + 0.5) / N) / tile) * 512, o)
      if (c) { r += c[0]; g += c[1]; b += c[2]; a++ }
    }
    const t = a / (N * N), i = ((y0 + py) * w + x0 + pxi) * 4
    if (a) { px[i] = cr + (r / a - cr) * t; px[i + 1] = cg + (g / a - cg) * t; px[i + 2] = cb + (b / a - cb) * t }
  }
  return png(w, h, px)
}

// ── Minimal PNG encoder ───────────────────────────────────────
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4) }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

writeFileSync(join(OUT, 'favicon.svg'), svg())
writeFileSync(join(OUT, 'icon.svg'), svg())
writeFileSync(join(OUT, 'icon-maskable.svg'), svg({ maskable: true }))
writeFileSync(join(OUT, 'icon-192.png'), rasterIcon(192, {}))
writeFileSync(join(OUT, 'icon-512.png'), rasterIcon(512, {}))
writeFileSync(join(OUT, 'icon-maskable-512.png'), rasterIcon(512, { maskable: true }))
writeFileSync(join(OUT, 'apple-touch-icon.png'), rasterIcon(180, { rounded: false }))

// iOS launch screens (portrait), referenced from index.html.
const SPLASH = [[1125, 2436], [1170, 2532], [1179, 2556], [1206, 2622], [1242, 2688], [1284, 2778], [1290, 2796], [1320, 2868], [750, 1334]]
mkdirSync(join(OUT, 'splash'), { recursive: true })
for (const [w, h] of SPLASH) writeFileSync(join(OUT, 'splash', `splash-${w}x${h}.png`), rasterSplash(w, h))
console.log('icons + splash written to', OUT)
