// OWNER: Games agent. Tone ↔ direction mapping, swipe classification, tone prompts (pure).
import type { Tone, Word } from '../../types'
import { syllablesOf } from '../../speech/pinyin'

export type PlayTone = 1 | 2 | 3 | 4

export const TONE_INFO: Record<PlayTone, { arrow: string; name: string; hint: string }> = {
  1: { arrow: '→', name: 'Hög', hint: 'hög och rak' },
  2: { arrow: '↗', name: 'Stigande', hint: 'stiger som en fråga' },
  3: { arrow: '↘↗', name: 'Dipp', hint: 'går ner och upp' },
  4: { arrow: '↘', name: 'Fallande', hint: 'faller bestämt' },
}

/** SVG path (in a 0..40 × 0..40 box, y down) that draws the tone's contour. */
export const TONE_PATH: Record<PlayTone, string> = {
  1: 'M6 12 H34',
  2: 'M6 30 L34 8',
  3: 'M6 16 Q16 38 22 30 T34 10',
  4: 'M6 8 L34 32',
}

export interface Point { x: number; y: number }

/**
 * Classify a finger stroke into a tone. Screen coordinates (y grows downward).
 * - dip (✓ shape: goes clearly down, then clearly up) → 3
 * - mostly flat → 1, upward → 2, downward → 4
 * Direction left/right doesn't matter (mirrored strokes count).
 * Returns null for taps / tiny strokes.
 */
export function classifySwipe(points: readonly Point[], minDist = 24): PlayTone | null {
  if (points.length < 2) return null
  const s = points[0]
  const e = points[points.length - 1]
  let minX = s.x, maxX = s.x, minY = s.y, maxY = s.y, lowIdx = 0
  points.forEach((p, i) => {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) { maxY = p.y; lowIdx = i }
  })
  const span = Math.hypot(maxX - minX, maxY - minY)
  if (span < minDist) return null

  // Dip: the lowest point is in the middle and both ends are well above it.
  const down = maxY - s.y
  const up = maxY - e.y
  const dipMin = Math.max(minDist * 0.6, span * 0.22)
  if (lowIdx > 0 && lowIdx < points.length - 1 && down >= dipMin && up >= dipMin) return 3

  const dx = Math.abs(e.x - s.x)
  const dy = s.y - e.y // up = positive
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI // -90 … 90
  if (Math.hypot(dx, dy) < minDist) return null
  if (angle > 22) return 2
  if (angle < -22) return 4
  return 1
}

export interface TonePrompt {
  word: Word
  /** Toneless syllables ("ma"), shown while guessing. */
  bases: string[]
  tones: PlayTone[]
}

/** Tone sandhi changes what TTS says (nǐ hǎo → ní hǎo, bù kè → bú kè): skip those words. */
function hasSandhi(word: Word, tones: Tone[]): boolean {
  for (let i = 0; i + 1 < tones.length; i++) if (tones[i] === 3 && tones[i + 1] === 3) return true
  return tones.length > 1 && /[不一]/.test(word.hanzi)
}

/** Words usable as tone prompts with `syllables` syllables: no neutral tone, no sandhi, hanzi length matches. */
export function tonePrompts(words: readonly Word[], syllables: 1 | 2): TonePrompt[] {
  const out: TonePrompt[] = []
  for (const w of words) {
    const syl = syllablesOf(w.pinyin)
    if (syl.length !== syllables) continue
    if ([...w.hanzi].length !== syllables) continue
    const tones = syl.map((s) => s.tone)
    if (tones.some((t) => t === 5)) continue
    if (hasSandhi(w, tones)) continue
    out.push({ word: w, bases: syl.map((s) => s.base.replace(/v/g, 'ü')), tones: tones as PlayTone[] })
  }
  return out
}
