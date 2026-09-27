// OWNER: Voice agent. Pinyin utilities — pure functions, unit tested.
import type { Tone } from '../types'

export interface Syllable { text: string; base: string; tone: Tone; isPunct: boolean }

// ─── Low-level helpers ───────────────────────────────────────

/** Combining diacritics (NFD) that carry a tone. */
const TONE_COMBINING: Record<string, Tone> = { '\u0304': 1, '\u0301': 2, '\u030C': 3, '\u0300': 4 }
const TONE_COMBINING_BY_TONE: Record<number, string> = { 1: '\u0304', 2: '\u0301', 3: '\u030C', 4: '\u0300' }
const TONE_RE = /[\u0304\u0301\u030C\u0300]/g

/** Splits a (NFC) character into its toneless form + tone (undefined if unmarked). */
function charTone(ch: string): { base: string; tone?: Tone } {
  const nfd = ch.normalize('NFD')
  let tone: Tone | undefined
  for (const c of nfd) if (TONE_COMBINING[c]) tone = TONE_COMBINING[c]
  return { base: tone ? nfd.replace(TONE_RE, '').normalize('NFC') : ch, tone }
}

/** A "letter" in the pinyin sense (latin letters incl. tone-marked vowels, ü, ê). */
function isLetter(ch: string): boolean {
  return /\p{L}/u.test(ch)
}

function isDigit(ch: string) { return ch >= '0' && ch <= '9' }

/** Remove tone marks: "shuǐ" → "shui", "lǜ" → "lü". Keeps case and everything else. */
export function stripTones(pinyin: string): string {
  return pinyin.normalize('NFD').replace(TONE_RE, '').normalize('NFC')
}

// ─── numbers → marks ─────────────────────────────────────────

/** Puts a tone mark on the right vowel of a single toneless syllable. */
function markSyllable(letters: string, tone: number): string {
  // v / u: → ü (v is never a pinyin letter otherwise)
  let s = letters.replace(/u:/g, 'ü').replace(/U:/g, 'Ü').replace(/v/g, 'ü').replace(/V/g, 'Ü')
  if (tone < 1 || tone > 4) return s
  const lower = s.toLowerCase()
  let idx = lower.indexOf('a')
  if (idx < 0) idx = lower.indexOf('e')
  if (idx < 0) idx = lower.indexOf('ou') // "ou" → o
  if (idx < 0) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('aeiouüê'.includes(lower[i])) { idx = i; break }
    }
  }
  if (idx < 0) {
    // syllabic nasals: m, n, ng, hm, hng
    idx = lower.search(/[mn]/)
    if (idx < 0) return s
  }
  return s.slice(0, idx) + (s[idx] + TONE_COMBINING_BY_TONE[tone]).normalize('NFC') + s.slice(idx + 1)
}

/** "shui3" → "shuǐ", "lv4" → "lǜ", "ni3 hao3" → "nǐ hǎo", "ma5"/"ma0" → "ma" */
export function numbersToMarks(input: string): string {
  return input.replace(/([a-zA-ZüÜ:]+)([0-5])/g, (_m, letters: string, digit: string) =>
    markSyllable(letters, Number(digit)))
}

// ─── Segmentation (for unspaced input like "nǐhǎo") ──────────

const INITIAL = '(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])'
const FINAL = '(?:iang|iong|uang|ueng|ang|eng|ing|ong|ian|iao|uai|uan|van|ai|ei|ao|ou|an|en|er|in|un|vn|ia|ie|iu|ua|uo|ui|ve|a|o|e|i|u|v|ê)'
const SYLLABLE_RE = new RegExp(`^(?:${INITIAL}?${FINAL}|m|n|ng|hm|hng)$`)

/** Split a run of pinyin letters (toneless, lowercase, ü as v) into syllable lengths (longest-first). */
function segmentLengths(s: string): number[] | null {
  const memo = new Map<number, number[] | null>()
  const go = (i: number): number[] | null => {
    if (i === s.length) return []
    if (memo.has(i)) return memo.get(i)!
    let res: number[] | null = null
    for (let len = Math.min(6, s.length - i); len >= 1; len--) {
      if (!SYLLABLE_RE.test(s.slice(i, i + len))) continue
      const rest = go(i + len)
      if (rest) { res = [len, ...rest]; break }
    }
    memo.set(i, res)
    return res
  }
  return go(0)
}

function parseLetterRun(chars: string[]): Syllable[] {
  const info = chars.map(charTone)
  const key = info.map((c) => c.base.toLowerCase()).join('').replace(/ü/g, 'v')
  const make = (from: number, to: number): Syllable => {
    const part = info.slice(from, to)
    return {
      text: chars.slice(from, to).join(''),
      base: part.map((p) => p.base).join('').toLowerCase(),
      tone: part.find((p) => p.tone)?.tone ?? 5,
      isPunct: false,
    }
  }
  // key has exactly one char per NFC char (ü → v), so indices line up
  const lengths = key.length === chars.length ? segmentLengths(key) : null
  if (!lengths || lengths.length <= 1) return [make(0, chars.length)]
  const out: Syllable[] = []
  let pos = 0
  for (const len of lengths) { out.push(make(pos, pos + len)); pos += len }
  return out
}

/** Parse a single whitespace-free token into syllables + punctuation. */
function parseToken(token: string): Syllable[] {
  const out: Syllable[] = []
  const chars = [...numbersToMarks(token).normalize('NFC')]
  let i = 0
  while (i < chars.length) {
    const letter = isLetter(chars[i])
    let j = i
    while (j < chars.length && isLetter(chars[j]) === letter) j++
    if (letter) out.push(...parseLetterRun(chars.slice(i, j)))
    else {
      const text = chars.slice(i, j).join('')
      out.push({ text, base: text, tone: 5, isPunct: true })
    }
    i = j
  }
  return out
}

/** "nǐ hǎo ma ?" → syllables with tone info. Also accepts tone numbers ("ni3 hao3") and unspaced "nǐhǎo". */
export function parsePinyin(pinyin: string): Syllable[] {
  return pinyin.split(/\s+/).filter(Boolean).flatMap(parseToken)
}

/** Toneless syllables (ü written as v) + tones of a pinyin string, punctuation dropped. */
export function syllablesOf(pinyin: string): { base: string; tone: Tone }[] {
  return parsePinyin(pinyin).filter((s) => !s.isPunct).map((s) => ({ base: s.base.replace(/ü/g, 'v'), tone: s.tone }))
}

// ─── Typed-answer checking ───────────────────────────────────

interface Normalized { letters: string; tones: (Tone | undefined)[]; digits: Map<number, number> }

/** Flatten any pinyin string into lowercase letters (ü = v) with tone info per letter index. */
function normalizeTyped(input: string): Normalized {
  const s = input.normalize('NFC').replace(/u:/gi, 'ü')
  let letters = ''
  const tones: (Tone | undefined)[] = []
  const digits = new Map<number, number>()
  for (const ch of s) {
    if (isDigit(ch)) {
      if (letters.length) digits.set(letters.length - 1, Number(ch))
      continue
    }
    if (!isLetter(ch)) continue
    const { base, tone } = charTone(ch)
    for (const c of base.toLowerCase().replace(/ü/g, 'v')) { letters += c; tones.push(tone) }
  }
  return { letters, tones, digits }
}

/**
 * Compare learner-typed pinyin to the expected answer.
 * Accepts marks or numbers, ignores spacing/case/punctuation.
 * 'exact' = right tones; 'tones-wrong' = right letters, wrong/missing tones; 'wrong'.
 * Neutral tone may be written without number (or as 5/0). "v" / "u:" = ü.
 * Typing "u" where "ü" is expected (lu for lü) counts as 'tones-wrong' (near miss).
 */
export function checkTypedPinyin(typed: string, expected: string): 'exact' | 'tones-wrong' | 'wrong' {
  const t = normalizeTyped(typed)
  const expSyl = syllablesOf(expected)
  const expLetters = expSyl.map((s) => s.base).join('')
  if (!t.letters || !expLetters) return 'wrong'
  if (t.letters !== expLetters) {
    if (t.letters.replace(/v/g, 'u') === expLetters.replace(/v/g, 'u')) return 'tones-wrong'
    return 'wrong'
  }
  let pos = 0
  for (const syl of expSyl) {
    const len = syl.base.length
    let typedTone: number | undefined
    for (let k = pos; k < pos + len; k++) if (t.tones[k]) typedTone = t.tones[k]
    if (typedTone === undefined) typedTone = t.digits.get(pos + len - 1)
    if (typedTone === undefined || typedTone === 0) typedTone = 5
    if (typedTone !== syl.tone) return 'tones-wrong'
    pos += len
  }
  return 'exact'
}

// ─── Colours ─────────────────────────────────────────────────

/** Tone color token (CSS var) for a tone. */
export function toneColorVar(t: Tone): string { return `var(--tone-${t})` }

/** Tailwind text-colour class for a tone (text-tone-1 … text-tone-5). */
export function toneTextClass(t: Tone): string {
  return ['', 'text-tone-1', 'text-tone-2', 'text-tone-3', 'text-tone-4', 'text-tone-5'][t]
}
