// Pitch-contour drawings for the four tones (Chao pitch levels 1–5) — used on intro cards and tone picks.
import type { Tone } from '../../types'

// viewBox 0 0 40 40: y = 36 - (level - 1) * 7  → level 5 = 8, level 1 = 36
const Y = (level: number) => 36 - (level - 1) * 7
const PATHS: Record<Tone, string> = {
  1: `M6 ${Y(5)} H34`,                                               // 55
  2: `M6 ${Y(3)} C 16 ${Y(3)}, 26 ${Y(4.2)}, 34 ${Y(5)}`,             // 35
  3: `M6 ${Y(2.2)} C 12 ${Y(0.8)}, 20 ${Y(0.6)}, 26 ${Y(1.6)} S 32 ${Y(3.6)}, 34 ${Y(4)}`, // 214
  4: `M6 ${Y(5)} C 16 ${Y(4.6)}, 26 ${Y(2.6)}, 34 ${Y(1)}`,           // 51
  5: `M17 ${Y(2.5)} H23`,                                             // short and light
}

/** Tone contour glyph. `staff` draws faint pitch lines behind it; `draw` animates the stroke in. */
export function ToneGlyph({ tone, className = '', staff = false, draw = false, delayMs = 0 }: {
  tone: Tone
  className?: string
  staff?: boolean
  draw?: boolean
  delayMs?: number
}) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      {staff && [1, 2, 3, 4, 5].map((l) => (
        <line key={l} x1="2" x2="38" y1={Y(l)} y2={Y(l)} stroke="currentColor" strokeOpacity={l === 3 ? 0.14 : 0.08} strokeWidth="1" />
      ))}
      <path
        d={PATHS[tone] ?? PATHS[5]}
        pathLength={100}
        fill="none"
        stroke="currentColor"
        strokeWidth={tone === 5 ? 6 : 4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={draw ? 'nh-draw' : ''}
        style={draw ? { animationDelay: `${delayMs}ms` } : undefined}
      />
    </svg>
  )
}
