// OWNER: Speech/Lab agent. Pitch contours → syllables → tone shapes → scores + Swedish feedback. Pure, unit tested.
import type { Tone } from '../../types'
import { syllablesOf } from '../pinyin'

/** One analysis frame from the pitch tracker. */
export interface PitchFrame {
  /** ms since the recording started */
  t: number
  /** null = silence / unvoiced */
  hz: number | null
  rms: number
}

/** Speaker's pitch range in semitones re 100 Hz (≈ Chao levels 1 … 5). */
export interface PitchRange { low: number; high: number }

export type ToneShape = 'level' | 'rising' | 'dip' | 'falling' | 'low' | 'unclear'

export const SHAPE_SV: Record<ToneShape, string> = {
  level: 'rak', rising: 'stigande', dip: 'dal (ner–upp)', falling: 'fallande', low: 'låg', unclear: 'otydlig',
}

/** Hz → semitones re 100 Hz. */
export function hzToSt(hz: number): number {
  return 12 * Math.log2(hz / 100)
}

function median(a: number[]): number {
  if (!a.length) return NaN
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function percentile(a: number[], p: number): number {
  if (!a.length) return NaN
  const s = [...a].sort((x, y) => x - y)
  const idx = Math.min(s.length - 1, Math.max(0, (s.length - 1) * p))
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  return s[lo] + (s[hi] - s[lo]) * (idx - lo)
}

/**
 * Cleans a semitone contour: fixes octave jumps (a classic pitch-tracker error), drops wild
 * outliers, then median-3 + moving-average-3 smoothing.
 */
export function cleanContour(st: number[]): number[] {
  if (st.length < 3) return [...st]
  const med = median(st)
  const fixed: number[] = []
  for (const v of st) {
    let x = v
    if (x - med > 8) x -= 12
    else if (med - x > 8) x += 12
    if (Math.abs(x - med) <= 9) fixed.push(x)
  }
  if (fixed.length < 3) return fixed
  const m3 = fixed.map((_, i) => {
    if (i === 0 || i === fixed.length - 1) return fixed[i]
    return median([fixed[i - 1], fixed[i], fixed[i + 1]])
  })
  return m3.map((_, i) => {
    const a = m3[Math.max(0, i - 1)], b = m3[i], c = m3[Math.min(m3.length - 1, i + 1)]
    return (a + b + c) / 3
  })
}

// ─── Range tracking (normalise to the learner's own voice) ──────

export const DEFAULT_SPAN = 10 // semitones between Chao level 1 and 5 for a typical speaker
const MIN_SPAN = 6
const MAX_SPAN = 18

/**
 * Updates the learner's pitch range from one utterance (semitones). The range widens quickly
 * and narrows slowly, so one flat syllable doesn't collapse it.
 */
export function updateRange(prev: PitchRange | null, st: number[]): PitchRange | null {
  if (st.length < 6) return prev
  const lo = percentile(st, 0.05), hi = percentile(st, 0.95)
  let next: PitchRange
  if (!prev) {
    // first utterance: centre a default span on it
    const mid = (lo + hi) / 2
    const span = Math.min(MAX_SPAN, Math.max(DEFAULT_SPAN, hi - lo + 2))
    next = { low: mid - span / 2, high: mid + span / 2 }
  } else {
    const low = lo < prev.low ? prev.low + (lo - prev.low) * 0.6 : prev.low + (lo - prev.low) * 0.1
    const high = hi > prev.high ? prev.high + (hi - prev.high) * 0.6 : prev.high + (hi - prev.high) * 0.1
    next = { low, high }
  }
  const span = next.high - next.low
  if (span < MIN_SPAN) {
    const mid = (next.high + next.low) / 2
    next = { low: mid - MIN_SPAN / 2, high: mid + MIN_SPAN / 2 }
  } else if (span > MAX_SPAN) {
    const mid = (next.high + next.low) / 2
    next = { low: mid - MAX_SPAN / 2, high: mid + MAX_SPAN / 2 }
  }
  return next
}

/** A semitone value → 0 (bottom of the learner's range) … 1 (top). May overshoot slightly. */
export function normalizeSt(v: number, range: PitchRange): number {
  return (v - range.low) / Math.max(1e-6, range.high - range.low)
}

// ─── Classification ─────────────────────────────────────────

export interface ContourFeatures {
  start: number
  end: number
  min: number
  max: number
  /** 0–1 relative position of the minimum */
  minPos: number
  delta: number
  drop: number
  rise: number
  /** mean height 0–1 within the learner's range (undefined without a range) */
  height?: number
  /** start height 0–1 (undefined without a range) */
  startHeight?: number
}

export interface Classification { shape: ToneShape; features: ContourFeatures | null }

/**
 * Classify one syllable's (cleaned) semitone contour as level / rising / dip / falling / low.
 * Uses the shape in semitones; the optional range adds height info (for "low" and feedback).
 */
export function classifyContour(stIn: number[], range?: PitchRange | null): Classification {
  // trim onset/offset transients
  const cut = stIn.length >= 10 ? Math.floor(stIn.length * 0.08) : 0
  const st = stIn.slice(cut, stIn.length - cut)
  if (st.length < 4) return { shape: 'unclear', features: null }
  const k = Math.max(1, Math.round(st.length * 0.2))
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const start = mean(st.slice(0, k))
  const end = mean(st.slice(-k))
  let min = Infinity, max = -Infinity, minIdx = 0
  st.forEach((v, i) => { if (v < min) { min = v; minIdx = i } if (v > max) max = v })
  const minPos = minIdx / (st.length - 1)
  const delta = end - start
  const drop = start - min
  const rise = end - min
  const features: ContourFeatures = { start, end, min, max, minPos, delta, drop, rise }
  if (range) {
    features.height = normalizeSt(mean(st), range)
    features.startHeight = normalizeSt(start, range)
  }

  let shape: ToneShape
  if (drop >= 1.2 && rise >= 1.5 && minPos >= 0.25 && minPos <= 0.85 && !(minPos < 0.45 && drop < 2)) {
    shape = 'dip'
  } else if (delta <= -2.5) {
    shape = 'falling'
  } else if (delta >= 2 && minPos < 0.5) {
    shape = 'rising'
  } else if (Math.abs(delta) < 1.5 && max - min < 3) {
    shape = features.height !== undefined && features.height < 0.35 ? 'low' : 'level'
  } else if (delta <= -1.5) {
    shape = features.height !== undefined && features.height < 0.35 ? 'low' : 'falling'
  } else if (delta >= 1.5) {
    shape = 'rising'
  } else {
    shape = features.height !== undefined && features.height < 0.35 ? 'low' : 'level'
  }
  return { shape, features }
}

// ─── Targets: sandhi + ideal contours ───────────────────────

const CJK = /[㐀-鿿]/

/**
 * Surface (spoken) tones after tone sandhi: 3+3 → 2+3; 不 bù → bú before a 4th tone;
 * 一 yī → yí before a 4th tone and yì before 1st/2nd/3rd (not at the end of a word).
 */
export function surfaceTones(tones: Tone[], bases: string[], hanzi?: string): Tone[] {
  const chars = hanzi ? [...hanzi].filter((c) => CJK.test(c)) : []
  const aligned = chars.length === tones.length
  const out = [...tones]
  for (let i = 0; i < out.length - 1; i++) {
    const next = tones[i + 1]
    const ch = aligned ? chars[i] : null
    if (tones[i] === 3 && next === 3) out[i] = 2
    else if (bases[i] === 'bu' && tones[i] === 4 && (ch === null || ch === '不') && next === 4) out[i] = 2
    else if (bases[i] === 'yi' && tones[i] === 1 && ch === '一') {
      if (next === 4 || next === 5) out[i] = 2
      else if (next === 1 || next === 2 || next === 3) out[i] = 4
    }
  }
  return out
}

/** Ideal contour of a tone on the 0–1 scale (Chao 1–5), sampled points left → right. */
export function idealContour(tone: Tone, opts?: { final?: boolean }): number[] {
  const chao = (...v: number[]) => v.map((x) => (x - 1) / 4)
  switch (tone) {
    case 1: return chao(5, 5, 5, 5)
    case 2: return chao(3, 2.8, 3.3, 4.2, 5)
    case 3: return opts?.final === false ? chao(2.2, 1.4, 1, 1) : chao(2.2, 1.3, 1, 1.6, 3.6)
    case 4: return chao(5, 4.2, 3, 1.8, 1)
    default: return chao(2.6, 2.3)
  }
}

export interface ToneScore { score: number; ok: boolean; feedback: string }

const PRAISE: Record<number, string> = {
  1: 'Bra! Hög och rak, som en sjungen ton.',
  2: 'Bra! Stigande som en fråga.',
  3: 'Bra! Ner i botten – precis rätt.',
  4: 'Bra! Bestämt fallande, som ett "Nej!".',
}

/** Score a detected shape against the expected (surface) tone. 0–100, ok ≥ 60, Swedish feedback. */
export function scoreTone(expected: Tone, c: Classification, opts?: { final?: boolean }): ToneScore {
  const f = c.features
  const final = opts?.final ?? true
  const r = (score: number, feedback: string): ToneScore => ({ score, ok: score >= 60, feedback })
  if (expected === 5) return r(100, 'Neutral ton – kort och lätt.')
  if (c.shape === 'unclear' || !f) return r(0, 'Jag hörde inte tonen tydligt. Säg det lite längre och högre.')
  switch (expected) {
    case 1:
      if (c.shape === 'level') {
        if (f.height !== undefined && f.height < 0.45) return r(72, 'Rak – bra! Försök börja högre, ettan ligger högt.')
        return r(100, PRAISE[1])
      }
      if (c.shape === 'low') return r(55, 'Rak men för låg. Försök börja högre, som när du sjunger.')
      if (c.shape === 'rising') return r(35, 'Den steg. Håll rösten hög och rak hela vägen.')
      if (c.shape === 'falling') return r(30, 'Den föll. Håll rösten hög och rak hela vägen.')
      return r(25, 'Håll rösten hög och rak, som en sjungen ton.')
    case 2:
      if (c.shape === 'rising') {
        if (f.rise < 3) return r(80, 'Stigande – bra! Stig lite mer, som när du frågar "va?".')
        return r(100, PRAISE[2])
      }
      if (c.shape === 'dip') return r(55, 'Nästan! Du gick ner först. Börja i mitten och stig direkt.')
      if (c.shape === 'level' || c.shape === 'low') return r(30, 'Låt rösten stiga, som när du frågar "va?".')
      return r(10, 'Den föll – tvåan ska stiga, som en fråga.')
    case 3:
      if (c.shape === 'dip') return r(100, PRAISE[3])
      if (c.shape === 'low') return final
        ? r(85, 'Bra, låg och knarrig! Sist i en fras kan du låta den stiga lite på slutet.')
        : r(100, 'Bra! Låg och kort – så låter trean mitt i en fras.')
      if (c.shape === 'falling') {
        if (f.startHeight !== undefined && f.startHeight > 0.6) return r(45, 'Börja lägre – trean ligger i botten av rösten.')
        return r(65, 'Nästan! Gå ner ännu lägre och stanna där.')
      }
      if (c.shape === 'rising') return r(45, 'Gå ner lågt först, sedan upp.')
      return r(35, 'Gå ner i botten av rösten – trean är låg.')
    case 4:
      if (c.shape === 'falling') {
        if (f.startHeight !== undefined && f.startHeight < 0.5) return r(75, 'Fallande – bra! Försök börja högre.')
        if (f.drop < 4) return r(80, 'Fallande – bra! Fall hela vägen ner.')
        return r(100, PRAISE[4])
      }
      if (c.shape === 'low') return r(45, 'Börja högt och fall snabbt, som ett bestämt "Nej!".')
      if (c.shape === 'dip') return r(40, 'Den gick upp igen på slutet. Bara fall – kort och bestämt.')
      if (c.shape === 'level') return r(25, 'Fall snabbt från högt till lågt, som ett "Nej!".')
      return r(5, 'Den steg – fyran ska falla, som ett "Nej!".')
  }
}

// ─── Segmentation ───────────────────────────────────────────

export interface Segment { from: number; to: number; frames: PitchFrame[] }

/**
 * Splits voiced frames into `n` syllables: voiced runs separated by gaps; too many runs → merge
 * across the smallest gaps; too few → split the longest run at its deepest energy dip.
 */
export function segmentSyllables(frames: PitchFrame[], n: number, opts?: { gapMs?: number; minRunMs?: number }): Segment[] {
  const gapMs = opts?.gapMs ?? 45
  const minRunMs = opts?.minRunMs ?? 50
  const voiced = frames.filter((f) => f.hz !== null)
  if (!voiced.length || n <= 0) return []
  let runs: PitchFrame[][] = []
  let cur: PitchFrame[] = [voiced[0]]
  for (let i = 1; i < voiced.length; i++) {
    if (voiced[i].t - voiced[i - 1].t > gapMs) { runs.push(cur); cur = [] }
    cur.push(voiced[i])
  }
  runs.push(cur)
  const dur = (r: PitchFrame[]) => r[r.length - 1].t - r[0].t
  const long = runs.filter((r) => dur(r) >= minRunMs && r.length >= 3)
  if (long.length) runs = long

  while (runs.length > n) {
    let bi = 0, best = Infinity
    for (let i = 0; i < runs.length - 1; i++) {
      const g = runs[i + 1][0].t - runs[i][runs[i].length - 1].t
      if (g < best) { best = g; bi = i }
    }
    runs.splice(bi, 2, [...runs[bi], ...runs[bi + 1]])
  }
  while (runs.length < n) {
    let li = -1, len = 0
    runs.forEach((r, i) => { if (r.length > len && r.length >= 6) { len = r.length; li = i } })
    if (li < 0) break
    const r = runs[li]
    // deepest energy dip in the middle 60 % (consonants / syllable boundaries are quieter)
    const a = Math.floor(r.length * 0.2), b = Math.ceil(r.length * 0.8)
    let cutAt = r.length >> 1, low = Infinity
    for (let i = Math.max(3, a); i < Math.min(r.length - 3, b); i++) {
      const e = (r[i - 1].rms + r[i].rms + r[i + 1].rms) / 3
      if (e < low * 0.97) { low = e; cutAt = i }
    }
    runs.splice(li, 1, r.slice(0, cutAt), r.slice(cutAt))
  }
  return runs.map((r) => ({ from: r[0].t, to: r[r.length - 1].t, frames: r }))
}

// ─── Whole attempt ──────────────────────────────────────────

export interface SyllableTarget { text: string; tone: Tone; surface: Tone; final: boolean }

/** Target syllables (with sandhi) for a pinyin string + optional hanzi. */
export function toneTargets(pinyin: string, hanzi?: string): SyllableTarget[] {
  const syl = syllablesOf(pinyin)
  const tones = syl.map((s) => s.tone)
  const surface = surfaceTones(tones, syl.map((s) => s.base), hanzi)
  // display text with marks: take from the pinyin string itself
  const texts = pinyin.split(/\s+/).filter((t) => /\p{L}/u.test(t))
  const aligned = texts.length === syl.length
  return syl.map((s, i) => ({
    text: aligned ? texts[i] : s.base,
    tone: s.tone,
    surface: surface[i],
    // a 3rd tone is "final" (full dip) at the end or before a pause; otherwise a half-third
    final: i === syl.length - 1 || surface[i + 1] === undefined,
  }))
}

export interface SyllableResult extends SyllableTarget {
  /** cleaned contour in semitones */
  st: number[]
  /** contour normalised to the learner's range (0–1) */
  norm: number[]
  shape: ToneShape
  score: number
  ok: boolean
  feedback: string
  /** scored? (neutral tones are not) */
  scored: boolean
}

export interface AttemptResult {
  syllables: SyllableResult[]
  /** 0–100 over the scored syllables */
  score: number
  ok: boolean
  /** short Swedish summary */
  feedback: string
  voicedMs: number
  range: PitchRange | null
}

/** Analyse a recording against the target. `range` = the learner's stored range (updated copy returned). */
export function analyzeAttempt(frames: PitchFrame[], target: { pinyin: string; hanzi?: string }, range: PitchRange | null): AttemptResult {
  const targets = toneTargets(target.pinyin, target.hanzi)
  const voiced = frames.filter((f) => f.hz !== null)
  const voicedMs = voiced.length >= 2 ? Math.min(voiced[voiced.length - 1].t - voiced[0].t, voiced.length * 20) : 0
  const allSt = cleanContour(voiced.map((f) => hzToSt(f.hz!)))
  const newRange = updateRange(range, allSt)
  const useRange = newRange

  if (voiced.length < 5) {
    return {
      syllables: targets.map((t) => ({ ...t, st: [], norm: [], shape: 'unclear', score: 0, ok: false, scored: t.surface !== 5, feedback: '' })),
      score: 0, ok: false, voicedMs, range,
      feedback: 'Jag hörde nästan inget. Håll telefonen nära och säg det lite högre.',
    }
  }

  const segs = segmentSyllables(frames, targets.length)
  const syllables: SyllableResult[] = targets.map((t, i) => {
    const seg = segs[i]
    const st = seg ? cleanContour(seg.frames.map((f) => hzToSt(f.hz!))) : []
    const norm = useRange ? st.map((v) => normalizeSt(v, useRange)) : []
    const cls = classifyContour(st, useRange)
    const sc = scoreTone(t.surface, cls, { final: t.final })
    return { ...t, st, norm, shape: cls.shape, score: sc.score, ok: sc.ok, feedback: sc.feedback, scored: t.surface !== 5 }
  })
  const scored = syllables.filter((s) => s.scored)
  const score = scored.length ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length) : 100
  const ok = score >= 60 && scored.every((s) => s.score >= 40)
  let feedback: string
  if (scored.length === 1) feedback = scored[0].feedback
  else if (score >= 85) feedback = 'Snyggt! Alla toner satt.'
  else {
    const worst = [...scored].sort((a, b) => a.score - b.score)[0]
    feedback = ok ? `Bra! Finputsa ${worst.text}: ${lcFirst(worst.feedback)}` : `Titta på ${worst.text}: ${lcFirst(worst.feedback)}`
  }
  return { syllables, score, ok, feedback, voicedMs, range: newRange }
}

function lcFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s
}
