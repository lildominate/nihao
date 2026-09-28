// FSRS-5 scheduler (Free Spaced Repetition Scheduler), implemented from the
// published formulas with the default parameters. No dependencies, pure.
//
// Memory model per card:
//   S = stability (days until recall probability falls to 90 %)
//   D = difficulty (1 = easy … 10 = hard)
//   R(t) = (1 + FACTOR · t / S) ^ DECAY   — retrievability after t days
// With target retention 0.9 the next interval equals S (by construction).
import type { ItemRef, SrsCard } from '../types'
import { addDays, daysBetween } from './dates'

/** FSRS-5 default weights (w0 … w18). */
export const W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605,
  2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
] as const

export const DECAY = -0.5
export const FACTOR = 19 / 81 // 0.9^(1/DECAY) − 1
export const TARGET_RETENTION = 0.9
export const MAX_INTERVAL = 36500
export const MIN_STABILITY = 0.1

/** 1 = Again, 2 = Hard, 3 = Good, 4 = Easy. The app grades binary: wrong → Again, right → Good. */
export type Grade = 1 | 2 | 3 | 4

/**
 * Progress-local extension of the shared `SrsCard` (types.ts is lead-owned).
 * All three fields are optional so plain v1 `SrsCard`s remain valid; readers
 * derive missing values with `memoryOf()`.
 * - `stability`  FSRS stability in days
 * - `difficulty` FSRS difficulty 1–10
 * - `lastReview` "YYYY-MM-DD" of the last graded review (null = never)
 * `ease` and `intervalDays` are still written (ease derived from difficulty,
 * interval = scheduled days) so older readers keep working.
 */
export interface ProgressCard extends SrsCard {
  stability?: number
  difficulty?: number
  lastReview?: string | null
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const round3 = (n: number) => Math.round(n * 1000) / 1000

export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY)
}

/** Days until R drops to `retention` (= S when retention is 0.9). */
export function nextInterval(stability: number, retention = TARGET_RETENTION): number {
  const i = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1)
  return clamp(Math.round(i), 1, MAX_INTERVAL)
}

export const initStability = (g: Grade) => Math.max(MIN_STABILITY, W[g - 1])
export const initDifficulty = (g: Grade) => W[4] - Math.exp(W[5] * (g - 1)) + 1

export function nextDifficulty(d: number, g: Grade): number {
  const delta = -W[6] * (g - 3)
  const dampened = d + (delta * (10 - d)) / 9 // linear damping
  const reverted = W[7] * initDifficulty(4) + (1 - W[7]) * dampened // mean reversion
  return clamp(reverted, 1, 10)
}

export function recallStability(d: number, s: number, r: number, g: Grade): number {
  const hard = g === 2 ? W[15] : 1
  const easy = g === 4 ? W[16] : 1
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy)
}

export function forgetStability(d: number, s: number, r: number): number {
  const sf = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r))
  return Math.min(sf, s)
}

/** Same-day review (FSRS-5 short-term stability). */
export function shortTermStability(s: number, g: Grade): number {
  return s * Math.exp(W[17] * (g - 3 + W[18]))
}

// ─── Ease ⇄ difficulty (compat with the v1 SM-2 fields) ─────

/** SM-2 ease (1.3–3.0) → FSRS difficulty. 2.5 (the v1 default) ↦ 5, 3.0 ↦ 3, 1.3 ↦ 9. */
export function easeToDifficulty(ease: number): number {
  const e = clamp(ease, 1.3, 3.0)
  return e >= 2.5 ? 5 - ((e - 2.5) / 0.5) * 2 : 5 + ((2.5 - e) / 1.2) * 4
}
/** Inverse of easeToDifficulty (D > 9 is floored at 1.3). */
export function difficultyToEase(d: number): number {
  const x = clamp(d, 1, 10)
  const e = x <= 5 ? 2.5 + ((5 - x) / 2) * 0.5 : 2.5 - ((x - 5) / 4) * 1.2
  return Math.round(clamp(e, 1.3, 3.0) * 100) / 100
}

/**
 * FSRS memory state of any card; derives it for v1 cards that lack it:
 * S ≈ the SM-2 interval (at 90 % retention FSRS interval = S), D from ease
 * (+0.5 per lapse), last review = due − interval.
 */
export function memoryOf(card: ProgressCard): { stability: number; difficulty: number; lastReview: string | null } {
  if (typeof card.stability === 'number' && typeof card.difficulty === 'number') {
    return { stability: card.stability, difficulty: card.difficulty, lastReview: card.lastReview ?? null }
  }
  const never = card.reps === 0 && card.intervalDays === 0 && card.lapses === 0
  const stability = never ? 0 : Math.max(card.reps === 0 ? 0.5 : 1, card.intervalDays)
  const difficulty = clamp(easeToDifficulty(card.ease) + 0.5 * Math.min(card.lapses, 4), 1, 10)
  const lastReview = never ? null : addDays(card.due, -Math.max(0, Math.round(card.intervalDays)))
  return { stability: round3(stability), difficulty: round3(difficulty), lastReview }
}

export function newCard(item: ItemRef, today: string): ProgressCard {
  return { item: { kind: item.kind, id: item.id }, ease: 2.5, intervalDays: 0, due: today, reps: 0, lapses: 0, stability: 0, difficulty: 0, lastReview: null }
}

/**
 * One graded review.
 * - First ever review: wrong → S0(Again); right → S0(Hard) ≈ 1.2 d with D0(Good).
 *   (The first scored attempt comes seconds after the intro card, so it is
 *   weak evidence; this gives the classic 1-day first interval.)
 * - Same-day repeat: a correct answer does not change the schedule (lesson
 *   replays, games and review sessions on the same day must not inflate
 *   intervals); a wrong answer applies the FSRS-5 short-term Again.
 * - Otherwise standard FSRS-5 with the real elapsed time, so early reviews
 *   gain little and overdue successes gain a lot.
 * Wrong answers always bring the card back tomorrow and count a lapse.
 */
export function reviewCard(card: ProgressCard, correct: boolean, today: string): ProgressCard {
  const g: Grade = correct ? 3 : 1
  const mem = memoryOf(card)
  let s: number
  let d: number

  if (mem.lastReview === null || mem.stability <= 0) {
    s = initStability(correct ? 2 : 1)
    d = initDifficulty(correct ? 3 : 1)
  } else {
    const elapsed = Math.max(0, daysBetween(mem.lastReview, today))
    if (elapsed === 0) {
      if (correct) return card
      s = shortTermStability(mem.stability, g)
      d = nextDifficulty(mem.difficulty, g)
    } else {
      const r = retrievability(elapsed, mem.stability)
      s = correct ? recallStability(mem.difficulty, mem.stability, r, g) : forgetStability(mem.difficulty, mem.stability, r)
      d = nextDifficulty(mem.difficulty, g)
    }
  }
  s = round3(Math.max(MIN_STABILITY, s))
  d = round3(clamp(d, 1, 10))
  const intervalDays = correct ? nextInterval(s) : 1
  return {
    ...card,
    item: { kind: card.item.kind, id: card.item.id },
    reps: correct ? card.reps + 1 : 0,
    lapses: correct ? card.lapses : card.lapses + 1,
    stability: s,
    difficulty: d,
    lastReview: today,
    ease: difficultyToEase(d),
    intervalDays,
    due: addDays(today, intervalDays),
  }
}

/**
 * Mastery 0–5 from stability and successful reps:
 * 0 unseen · 1 seen / just lapsed (no success since) · 2 S < 3 d · 3 S < 10 d ·
 * 4 S < 30 d and ≥ 3 reps · 5 S ≥ 30 d and ≥ 4 reps.
 */
export function masteryOfCard(card: ProgressCard | undefined): number {
  if (!card) return 0
  if (card.reps <= 0) return 1
  const { stability: s } = memoryOf(card)
  if (s < 3) return 2
  if (s < 10) return 3
  if (s < 30) return card.reps >= 3 ? 4 : 3
  return card.reps >= 4 ? 5 : card.reps >= 3 ? 4 : 3
}

/** Probability of recall today (1 for never-reviewed/unseen is not meaningful → 0). */
export function cardRetrievability(card: ProgressCard, today: string): number {
  const m = memoryOf(card)
  if (m.lastReview === null || m.stability <= 0) return 0
  return retrievability(daysBetween(m.lastReview, today), m.stability)
}

/** Fully migrated copy of a v1 card (fills stability/difficulty/lastReview). */
export function migrateCard(card: ProgressCard): ProgressCard {
  const m = memoryOf(card)
  return { ...card, stability: m.stability, difficulty: m.difficulty, lastReview: m.lastReview }
}
