// Placement test logic (pure). Adaptive: a Bayesian estimate of "how many lessons
// the learner already knows" (K), updated after every answer with a slip/guess
// model, probing where the posterior is most uncertain (its median).
import type { Course, Exercise, Lesson } from '../types'
import { choiceExercise, mulberry32 } from '../exercises/generate'
import { wordRef } from '../exercises/items'

export const MIN_QUESTIONS = 10
export const MAX_QUESTIONS = 15
/** P(correct | lesson known) — allows for slips. */
const P_SLIP_OK = 0.9
/** P(correct | lesson unknown) with 4 options (guessing), a bit above 1/4 for partial knowledge. */
const P_GUESS = 0.3

export interface PlacementQuestion {
  /** Index into `probes` (lessons that introduce words). */
  probe: number
  lessonId: string
  exercise: Exercise // 'listen-choose' (listen → meaning) or 'sv-to-pinyin' (Swedish → pinyin)
}

export interface PlacementState {
  seed: number
  /** Lessons that can be probed, in course order. */
  probes: Lesson[]
  /** Posterior over K = number of probe lessons already known (0 … probes.length). */
  posterior: number[]
  asked: { q: PlacementQuestion; correct: boolean }[]
  usedWords: string[]
}

const isMetaSv = (sv: string) => /^[([]/.test(sv.trim())

export function startPlacement(course: Course, seed = Date.now()): PlacementState {
  const probes = course.units.flatMap((u) => u.lessons).filter((l) => l.newWords.some((id) => course.words[id] && !isMetaSv(course.words[id].sv)))
  const n = probes.length
  // Prior: mildly favours beginners (most people taking the test are near the start).
  const prior = Array.from({ length: n + 1 }, (_, k) => Math.pow(0.97, k))
  const z = prior.reduce((a, b) => a + b, 0)
  return { seed, probes, posterior: prior.map((p) => p / z), asked: [], usedWords: [] }
}

function quantile(post: number[], q: number): number {
  let acc = 0
  for (let k = 0; k < post.length; k++) {
    acc += post[k]
    if (acc >= q) return k
  }
  return post.length - 1
}

/** Next question, or null when the test is finished. */
export function nextQuestion(state: PlacementState, course: Course): PlacementQuestion | null {
  if (isFinished(state)) return null
  const n = state.probes.length
  if (!n) return null
  // Probe the lesson at the posterior median: "is lesson #median known?"
  // (K > i ⇔ lesson i known). Clamp into range and avoid repeating the exact same probe 3× in a row.
  // The first two questions probe lower (20th percentile) so beginners aren't met by mid-course words.
  let probe = Math.min(n - 1, Math.max(0, quantile(state.posterior, state.asked.length < 2 ? 0.2 : 0.5)))
  const last = state.asked.slice(-2).map((a) => a.q.probe)
  if (last.length === 2 && last[0] === probe && last[1] === probe) {
    const dir = state.asked[state.asked.length - 1].correct ? 1 : -1
    probe = Math.min(n - 1, Math.max(0, probe + dir))
  }
  const rng = mulberry32(state.seed + state.asked.length * 7919)
  const lesson = state.probes[probe]
  const pool = course.units.flatMap((u) => u.lessons).flatMap((l) => l.newWords)
  const words = lesson.newWords.filter((id) => course.words[id] && !isMetaSv(course.words[id].sv))
  const fresh = words.filter((id) => !state.usedWords.includes(id))
  const cands = (fresh.length ? fresh : words).slice()
  // Alternate the two directions: listen → meaning, Swedish → pinyin.
  const type = state.asked.length % 2 === 0 ? 'listen-choose' : 'sv-to-pinyin'
  for (let tries = 0; tries < cands.length; tries++) {
    const id = cands.splice(Math.floor(rng() * cands.length), 1)[0]
    const ex = choiceExercise(course, type, wordRef(id), { rng, pool }) ?? choiceExercise(course, type === 'listen-choose' ? 'sv-to-pinyin' : 'listen-choose', wordRef(id), { rng, pool })
    if (ex) return { probe, lessonId: lesson.id, exercise: ex }
  }
  return null
}

/** Bayesian update after an answer ("vet inte" = wrong). Returns a new state. */
export function answerQuestion(state: PlacementState, q: PlacementQuestion, correct: boolean): PlacementState {
  const post = state.posterior.map((p, k) => {
    const known = q.probe < k
    const like = correct ? (known ? P_SLIP_OK : P_GUESS) : known ? 1 - P_SLIP_OK : 1 - P_GUESS
    return p * like
  })
  const z = post.reduce((a, b) => a + b, 0) || 1
  const id = q.exercise.type === 'match-pairs' ? '' : q.exercise.item.id
  return { ...state, posterior: post.map((p) => p / z), asked: [...state.asked, { q, correct }], usedWords: [...state.usedWords, id] }
}

export function isFinished(state: PlacementState): boolean {
  const n = state.asked.length
  if (!state.probes.length) return true
  if (n >= MAX_QUESTIONS) return true
  // Clear beginner: stop early instead of making them fail 10 questions.
  if (n >= 4 && state.posterior[0] > 0.85) return true
  if (n < MIN_QUESTIONS) return false
  // Confident enough: 80 % credible interval spans ≤ 2 lessons.
  return quantile(state.posterior, 0.9) - quantile(state.posterior, 0.1) <= 2
}

/**
 * Estimated number of known probe lessons. Conservative (30th percentile):
 * skipping too far hurts more than repeating a little.
 */
export function estimateKnown(state: PlacementState): number {
  return quantile(state.posterior, 0.3)
}

/**
 * Lesson to start at, or null = start from the beginning.
 * The start is the first lesson (in full course order) after the last known probe lesson.
 */
export function placementResult(state: PlacementState, course: Course): string | null {
  const k = estimateKnown(state)
  // Skipping a single lesson saves little and risks gaps; only skip on clear evidence.
  if (k < 2) return null
  const all = course.units.flatMap((u) => u.lessons)
  const lastKnown = state.probes[k - 1]
  const i = all.findIndex((l) => l.id === lastKnown.id)
  if (i < 0) return null
  return (all[i + 1] ?? all[i]).id
}

/** Human summary for the result screen: unit + lesson titles. */
export function describeLesson(course: Course, lessonId: string | null): { unitTitle: string; lessonTitle: string; unitIndex: number } | null {
  if (!lessonId) return null
  for (const [ui, u] of course.units.entries()) {
    const l = u.lessons.find((x) => x.id === lessonId)
    if (l) return { unitTitle: u.title, lessonTitle: l.title, unitIndex: ui }
  }
  return null
}
