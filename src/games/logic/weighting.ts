// OWNER: Games agent. Spaced-repetition weighting for prompt selection (pure, RNG injected).
import type { ItemRef, Sentence, Word } from '../../types'
import type { Rng } from './random'

/** wordId → relative draw weight (missing ids count as 1). */
export type Weights = Record<string, number>

/** The slice of the progress API the weighting needs. */
export interface WeightSource {
  mastery(item: ItemRef): number
  retrievability(item: ItemRef): number
  dueItems(limit?: number): ItemRef[]
  weakItems(limit?: number): ItemRef[]
}

export interface WordSignals { mastery: number; retrievability: number; due: boolean; weak: boolean }

/** Base weight by mastery 0..5: unfamiliar words show up ~6x as often as mastered ones. */
const MASTERY_BASE = [3, 2.6, 2.1, 1.5, 1, 0.5]
export const MIN_WEIGHT = 0.4

/** Pure: how much a word deserves to be drawn. Always > 0 so mastered words still appear (variety). */
export function wordWeight(s: WordSignals): number {
  const m = Math.max(0, Math.min(5, Math.round(s.mastery)))
  let w = MASTERY_BASE[m]
  // Forgetting: seen words with low retrievability weigh up to 2.5x. Unseen (0) is covered by mastery.
  if (s.retrievability > 0) w *= 1 + (1 - Math.min(1, s.retrievability)) * 1.5
  if (s.due) w *= 1.8
  if (s.weak) w *= 2
  return Math.max(MIN_WEIGHT, w)
}

/** Builds weights for `words` from the progress API. Safe if any call throws (falls back to 1). */
export function buildWeights(words: readonly Word[], src: WeightSource): Weights {
  const due = new Set<string>()
  const weak = new Set<string>()
  try { for (const i of src.dueItems(500)) if (i.kind === 'word') due.add(i.id) } catch { /* ignore */ }
  try { for (const i of src.weakItems(500)) if (i.kind === 'word') weak.add(i.id) } catch { /* ignore */ }
  const out: Weights = {}
  for (const w of words) {
    const ref: ItemRef = { kind: 'word', id: w.id }
    try {
      out[w.id] = wordWeight({ mastery: src.mastery(ref), retrievability: src.retrievability(ref), due: due.has(w.id), weak: weak.has(w.id) })
    } catch { out[w.id] = 1 }
  }
  return out
}

/** Sentence weight = mean of its words' weights. */
export function sentenceWeight(s: Sentence, weights: Weights): number {
  if (!s.wordIds.length) return 1
  return s.wordIds.reduce((a, id) => a + (weights[id] ?? 1), 0) / s.wordIds.length
}

/** Fraction of weight kept for a word drawn in the last few draws (soft anti-repeat on top of the hard one). */
const RECENT_FACTOR = 0.25

/**
 * Weighted draw without back-to-back repeats. `recent` (newest last) are down-weighted;
 * the previous item is excluded entirely when there is any alternative.
 */
export function weightedPick<T>(items: readonly T[], weightOf: (t: T) => number, keyOf: (t: T) => string, rng: Rng, recent: readonly string[] = []): T {
  if (items.length === 0) throw new Error('weightedPick: empty')
  const last = recent[recent.length - 1]
  const cands = items.length > 1 ? items.filter((t) => keyOf(t) !== last) : items.slice()
  const ws = cands.map((t) => {
    const idx = recent.lastIndexOf(keyOf(t))
    const w = Math.max(0.0001, weightOf(t))
    return idx >= 0 && recent.length - idx <= 3 && cands.length > 3 ? w * RECENT_FACTOR : w
  })
  const total = ws.reduce((a, b) => a + b, 0)
  let r = rng() * total
  for (let i = 0; i < cands.length; i++) {
    r -= ws[i]
    if (r < 0) return cands[i]
  }
  return cands[cands.length - 1]
}

/** Endless weighted picker with memory of the last draws. */
export class WeightedPicker<T> {
  private recent: string[] = []
  private readonly items: readonly T[]
  private readonly weightOf: (t: T) => number
  private readonly keyOf: (t: T) => string
  private readonly rng: Rng
  constructor(items: readonly T[], weightOf: (t: T) => number, keyOf: (t: T) => string, rng: Rng = Math.random) {
    this.items = items
    this.weightOf = weightOf
    this.keyOf = keyOf
    this.rng = rng
  }
  /** Record a draw made elsewhere (e.g. a retry) so it isn't repeated right away. */
  note(key: string): void {
    this.recent.push(key)
    if (this.recent.length > 4) this.recent.shift()
  }
  next(): T {
    const t = weightedPick(this.items, this.weightOf, this.keyOf, this.rng, this.recent)
    this.note(this.keyOf(t))
    return t
  }
}
