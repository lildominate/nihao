// OWNER: Games agent. Word pool + question/option selection (pure).
import type { Course, Word } from '../../types'
import { shuffle, type Rng } from './random'
import { WeightedPicker, type Weights } from './weighting'

export const MIN_POOL = 8

export interface WordPool {
  words: Word[]
  /** true when the learner knows < MIN_POOL words and we borrowed the first unit's words. */
  fallback: boolean
  knownCount: number
}

/** All word ids of a unit, in lesson order, without duplicates. */
export function unitWordIds(course: Course, unitIndex = 0): string[] {
  const unit = course.units[unitIndex]
  if (!unit) return []
  return [...new Set(unit.lessons.flatMap((l) => l.newWords))]
}

/** Known words, or (if fewer than `min`) the first unit's words. */
export function buildWordPool(knownIds: readonly string[], course: Course, min = MIN_POOL): WordPool {
  const known = [...new Set(knownIds)].map((id) => course.words[id]).filter((w): w is Word => !!w)
  if (known.length >= min) return { words: known, fallback: false, knownCount: known.length }
  // Keep what they know first, then top up with unit 1 (and unit 2 if unit 1 is tiny).
  const ids = new Set(known.map((w) => w.id))
  const words = known.slice()
  for (let u = 0; u < course.units.length && words.length < min; u++) {
    for (const id of unitWordIds(course, u)) {
      const w = course.words[id]
      if (w && !ids.has(id)) { ids.add(id); words.push(w) }
    }
    if (u === 0 && words.length >= min) break
  }
  return { words, fallback: true, knownCount: known.length }
}

/** Short Swedish label: first two alternatives of "hej/hallå/god dag". */
export function svLabel(w: Word): string {
  return w.sv.split('/').map((s) => s.trim()).filter(Boolean).slice(0, 2).join(' / ')
}

/** Normalised key used to make sure no two options look the same. */
export function optionKey(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/[\s?!.,]+/g, ' ').trim()
}

/**
 * Pick `n` options (target + distractors) where every option's `label` is unique.
 * Distractors come from `pool` first, then from `extra` (e.g. the whole course).
 */
export function pickOptions(target: Word, pool: readonly Word[], label: (w: Word) => string, n = 4, rng: Rng = Math.random, extra: readonly Word[] = []): Word[] {
  const seen = new Set([optionKey(label(target))])
  // Words sharing a Swedish meaning are also bad distractors (e.g. two words for "du").
  const targetSv = new Set(target.sv.split('/').map(optionKey))
  const out: Word[] = [target]
  const consider = (cands: readonly Word[]) => {
    for (const w of shuffle(cands, rng)) {
      if (out.length >= n) return
      if (w.id === target.id) continue
      const k = optionKey(label(w))
      if (seen.has(k)) continue
      if (w.sv.split('/').some((s) => targetSv.has(optionKey(s)))) continue
      seen.add(k)
      out.push(w)
    }
  }
  consider(pool)
  if (out.length < n) consider(extra)
  return shuffle(out, rng)
}

/**
 * Endless deck: shuffled rounds through the pool; a missed word comes back
 * again `retryAfter` draws later (spaced a little so it isn't a giveaway).
 */
export class WordDeck {
  private queue: Word[] = []
  private retries: { word: Word; due: number }[] = []
  private draws = 0
  private last: string | null = null
  private readonly words: readonly Word[]
  private readonly rng: Rng
  private readonly retryAfter: number

  private readonly picker: WeightedPicker<Word> | null

  /** With `weights` (see weighting.ts) fresh words are drawn by weight instead of in shuffled rounds. */
  constructor(words: readonly Word[], rng: Rng = Math.random, retryAfter = 3, weights?: Weights) {
    this.words = words
    this.picker = weights ? new WeightedPicker(words, (w) => weights[w.id] ?? 1, (w) => w.id, rng) : null
    this.rng = rng
    this.retryAfter = retryAfter
  }

  next(): Word {
    this.draws++
    const dueIdx = this.retries.findIndex((r) => r.due <= this.draws && r.word.id !== this.last)
    let w: Word
    if (dueIdx >= 0) {
      w = this.retries.splice(dueIdx, 1)[0].word
      this.picker?.note(w.id)
    } else if (this.picker) {
      w = this.picker.next()
    } else {
      if (this.queue.length === 0) {
        this.queue = shuffle(this.words, this.rng)
        // avoid the same word twice in a row across round boundaries
        if (this.queue.length > 1 && this.queue[this.queue.length - 1].id === this.last) {
          ;[this.queue[0], this.queue[this.queue.length - 1]] = [this.queue[this.queue.length - 1], this.queue[0]]
        }
      }
      w = this.queue.pop()!
    }
    this.last = w.id
    return w
  }

  /** Bring a missed word back soon. */
  miss(word: Word): void {
    if (this.retries.some((r) => r.word.id === word.id)) return
    this.retries.push({ word, due: this.draws + this.retryAfter })
  }
}
