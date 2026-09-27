// Thin adapters over the speech module's pinyin utilities + text normalisers for answer checks.
import type { Tone } from '../types'
import { numbersToMarks, parsePinyin, stripTones } from '../speech/pinyin'

/** "nǐ hǎo ma ?" → ["nǐ", "hǎo", "ma"] (punctuation dropped, marks kept). */
export function syllables(pinyin: string): string[] {
  return parsePinyin(pinyin.normalize('NFC')).filter((s) => !s.isPunct).map((s) => s.text)
}

export function syllableTone(syl: string): Tone {
  return parsePinyin(syl).find((s) => !s.isPunct)?.tone ?? 5
}

/** "shuǐ" → "shui" (ü kept). */
export function syllableBase(syl: string): string {
  return stripTones(syl.normalize('NFC'))
}

/** Put a tone mark on a (toneless or marked) syllable: ("shui", 3) → "shuǐ". */
export function withTone(syl: string, tone: Tone): string {
  const base = syllableBase(syl)
  return tone === 5 ? base : numbersToMarks(base + tone)
}

/** Loose normalisation for comparing texts (case, spacing, NFC). */
export function norm(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Normalise a Swedish answer: also drops punctuation. */
export function normSv(s: string): string {
  return norm(s.replace(/[.,!?;:"'«»()…¿¡]/g, ' '))
}
