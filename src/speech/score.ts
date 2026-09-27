// OWNER: Voice agent. Pure scoring of speech-recognition results against expected pinyin.
import { pinyin } from 'pinyin-pro'
import type { Tone } from '../types'
import { numbersToMarks, syllablesOf } from './pinyin'

export interface SpokenCheck { ok: boolean; score: number; heard: string; heardPinyin: string }

type Syl = { base: string; tone: Tone }

const DIGITS = '零一二三四五六七八九'

function numToHanzi(str: string): string {
  const n = Number(str)
  if (!Number.isInteger(n) || str.length > 2) return [...str].map((d) => DIGITS[Number(d)]).join('')
  if (n < 10) return DIGITS[n]
  const tens = Math.floor(n / 10), ones = n % 10
  return (tens === 1 ? '' : DIGITS[tens]) + '十' + (ones ? DIGITS[ones] : '')
}

/** Recognisers often return Arabic numerals ("3") — turn them into hanzi. */
export function digitsToHanzi(s: string): string {
  return s.replace(/\d+/g, numToHanzi)
}

export function normalizeHanzi(s: string): string {
  return digitsToHanzi(s).replace(/[\s\p{P}\p{S}]/gu, '')
}

/** Hanzi → toneless syllables (ü as v) with tones, via pinyin-pro. */
export function hanziToSyllables(text: string): Syl[] {
  const clean = normalizeHanzi(text)
  if (!clean) return []
  const arr = pinyin(clean, { toneType: 'num', type: 'array', nonZh: 'removed' }) as string[]
  return arr
    .map((p) => p.trim().toLowerCase())
    .filter((p) => /^[a-zü]+[0-5]?$/.test(p))
    .map((p) => {
      const m = /^([a-zü]+)([0-5])?$/.exec(p)!
      const t = Number(m[2] ?? 0)
      return { base: m[1].replace(/ü/g, 'v'), tone: (t === 0 ? 5 : t) as Tone }
    })
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

function toneOk(e: Syl, h: Syl): boolean {
  // neutral tone and tone-sandhi syllables (不 / 一) are not held against the learner
  return e.tone === 5 || h.tone === 5 || e.tone === h.tone || e.base === 'bu' || e.base === 'yi'
}

/** Similarity of two syllables: toneless match weighted heavily, tone match bonus, partial credit for near misses. */
function sylSim(e: Syl, h: Syl): { sim: number; match: boolean } {
  if (e.base === h.base) return { sim: toneOk(e, h) ? 1 : 0.8, match: true }
  const d = 1 - levenshtein(e.base, h.base) / Math.max(e.base.length, h.base.length)
  return { sim: d >= 0.5 ? d * 0.4 : 0, match: false }
}

/** Best monotone alignment of expected vs heard syllables. */
export function compareSyllables(expected: Syl[], heard: Syl[]): { score: number; matches: number } {
  const n = expected.length, m = heard.length
  if (!n || !m) return { score: 0, matches: 0 }
  type Cell = { s: number; k: number }
  const dp: Cell[][] = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => ({ s: 0, k: 0 })))
  const better = (a: Cell, b: Cell) => (a.s > b.s || (a.s === b.s && a.k > b.k) ? a : b)
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const { sim, match } = sylSim(expected[i - 1], heard[j - 1])
      const diag = { s: dp[i - 1][j - 1].s + sim, k: dp[i - 1][j - 1].k + (match ? 1 : 0) }
      dp[i][j] = better(better(dp[i - 1][j], dp[i][j - 1]), diag)
    }
  }
  const best = dp[n][m]
  return { score: best.s / Math.max(n, m), matches: best.k }
}

/**
 * Score recognition alternatives against the expected item.
 * score is 0–1. ok when ≥ ~80 % of expected syllables match (toneless) and
 * the learner didn't say lots of extra stuff — or when the hanzi match exactly.
 */
export function scoreAlternatives(expected: { hanzi: string; pinyin: string }, alternatives: string[]): SpokenCheck {
  const exp = syllablesOf(expected.pinyin)
  const expHanzi = normalizeHanzi(expected.hanzi)
  let best: SpokenCheck | null = null
  for (const alt of alternatives) {
    const heard = alt.trim()
    if (!heard) continue
    const heardSyl = hanziToSyllables(heard)
    const heardPinyin = heardSyl.map((s) => numbersToMarks(s.base + (s.tone === 5 ? '' : s.tone))).join(' ')
    let check: SpokenCheck
    if (expHanzi && normalizeHanzi(heard) === expHanzi) {
      check = { ok: true, score: 1, heard, heardPinyin }
    } else {
      const { score, matches } = compareSyllables(exp, heardSyl)
      const ok = exp.length > 0 && matches / exp.length >= 0.79 && matches / Math.max(1, heardSyl.length) >= 0.5
      check = { ok, score: Math.round(score * 100) / 100, heard, heardPinyin }
    }
    if (!best || (check.ok && !best.ok) || (check.ok === best.ok && check.score > best.score)) best = check
  }
  return best ?? { ok: false, score: 0, heard: alternatives[0] ?? '', heardPinyin: '' }
}
