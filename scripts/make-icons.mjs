// Generates the app icons (SVG + PNG) in public/ using only Node built-ins.
// Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const BG = '#22c55e', BG_DARK = '#16a34a', WHITE = '#ffffff'
const TONES = ['#e11d48', '#16a34a', '#2563eb', '#9333ea']
const SW = 13 // stroke radius (half width) of tone marks

// Geometry in a 512×512 design space: speech bubble + the four tone marks.
const bubble = { x: 72, y: 120, w: 368, h: 236, r: 72 }
const tail = [[150, 344], [240, 344], [124, 420]]
const marks = [
  { c: TONES[0], pts: [[109, 238], [153, 238]] },
  { c: TONES[1], pts: [[203, 266], [231, 210]] },
  { c: TONES[2], pts: [[281, 212], [303, 264], [325, 212]] },
  { c: TONES[3], pts: [[375, 210], [403, 266]] },
]

// ── SVG ───────────────────────────────────────────────────────
function svg({ maskable = false, rounded = true } = {}) {
  const s = maskable ? 0.78 : 1
  const t = `translate(${256 - 256 * s} ${256 - 256 * s + (maskable ? 4 : 0)}) scale(${s})`
  const bg = rounded && !maskable
    ? `<rect width="512" height="512" rx="112" fill="${BG}"/><rect y="440" width="512" height="72" rx="0" fill="${BG_DARK}" clip-path="url(#c)"/>`
    : `<rect width="512" height="512" fill="${BG}"/>`
  const defs = rounded && !maskable ? `<defs><clipPath id="c"><rect width="512" height="512" rx="112"/></clipPath></defs>` : ''
  const lines = marks.map(m => `<polyline points="${m.pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${m.c}" stroke-width="${SW * 2}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}${bg}<g transform="${t}"><rect x="${bubble.x}" y="${bubble.y}" width="${bubble.w}" height="${bubble.h}" rx="${bubble.r}" fill="${WHITE}"/><polygon points="${tail.map(p => p.join(',')).join(' ')}" fill="${WHITE}"/>${lines}</g></svg>\n`
}

// ── Raster ────────────────────────────────────────────────────
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
function inRoundRect(x, y, rx, ry, rw, rh, r) {
  const cx = Math.max(rx + r, Math.min(x, rx + rw - r))
  const cy = Math.max(ry + r, Math.min(y, ry + rh - r))
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh && (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}
function inTri(x, y, [a, b, c]) {
  const s = (p, q) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1])
  const d1 = s(a, b), d2 = s(b, c), d3 = s(c, a)
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}
function segDist(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - ax - t * dx, y - ay - t * dy)
}
function sample(x, y, { maskable, rounded, s }) {
  // background
  let col = null
  if (!rounded || maskable) col = BG
  else if (inRoundRect(x, y, 0, 0, 512, 512, 112)) col = y > 440 ? BG_DARK : BG
  if (!col) return null
  // content space
  const u = (x - (256 - 256 * s)) / s, v = (y - (256 - 256 * s + (maskable ? 4 : 0))) / s
  for (const m of marks) for (let i = 0; i < m.pts.length - 1; i++) if (segDist(u, v, m.pts[i], m.pts[i + 1]) <= SW) return m.c
  if (inRoundRect(u, v, bubble.x, bubble.y, bubble.w, bubble.h, bubble.r) || inTri(u, v, tail)) return WHITE
  return col
}
function raster(size, opts) {
  const N = 4, px = Buffer.alloc(size * size * 4)
  const o = { maskable: false, rounded: true, s: 1, ...opts }
  if (o.maskable && !opts.s) o.s = 0.78
  for (let py = 0; py < size; py++) for (let pxi = 0; pxi < size; pxi++) {
    let r = 0, g = 0, b = 0, a = 0
    for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
      const c = sample(((pxi + (sx + 0.5) / N) / size) * 512, ((py + (sy + 0.5) / N) / size) * 512, o)
      if (c) { const [cr, cg, cb] = hex(c); r += cr; g += cg; b += cb; a++ }
    }
    const i = (py * size + pxi) * 4
    if (a) { px[i] = r / a; px[i + 1] = g / a; px[i + 2] = b / a }
    px[i + 3] = Math.round((a / (N * N)) * 255)
  }
  return png(size, px)
}

// ── Minimal PNG encoder ───────────────────────────────────────
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4) }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

writeFileSync(join(OUT, 'favicon.svg'), svg())
writeFileSync(join(OUT, 'icon.svg'), svg())
writeFileSync(join(OUT, 'icon-maskable.svg'), svg({ maskable: true }))
writeFileSync(join(OUT, 'icon-192.png'), raster(192, {}))
writeFileSync(join(OUT, 'icon-512.png'), raster(512, {}))
writeFileSync(join(OUT, 'icon-maskable-512.png'), raster(512, { maskable: true }))
writeFileSync(join(OUT, 'apple-touch-icon.png'), raster(180, { rounded: false, s: 0.9 }))
console.log('icons written to', OUT)
