import { describe, expect, it } from 'vitest'
import { course } from '../data/course'
import { answerQuestion, isFinished, MAX_QUESTIONS, MIN_QUESTIONS, nextQuestion, placementResult, startPlacement } from './placement'
import type { PlacementState } from './placement'
import { interleaveCandidates, lessonGenOptions } from './options'

const lessons = course.units.flatMap((u) => u.lessons)

/** Simulated learner who knows every word introduced before lesson index `k` (guesses otherwise). */
function simulate(knownBefore: number, seed: number, guessRate = 0.25) {
  const knownWords = new Set(lessons.slice(0, knownBefore).flatMap((l) => l.newWords))
  let st: PlacementState = startPlacement(course, seed)
  let rnd = seed
  const rand = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648)
  let guard = 0
  while (!isFinished(st) && guard++ < 50) {
    const q = nextQuestion(st, course)
    if (!q) break
    const ex = q.exercise
    expect(ex.type === 'listen-choose' || ex.type === 'sv-to-pinyin').toBe(true)
    if (ex.type !== 'listen-choose' && ex.type !== 'sv-to-pinyin') break
    expect(ex.options).toContain(ex.answer)
    const correct = knownWords.has(ex.item.id) ? true : rand() < guessRate
    st = answerQuestion(st, q, correct)
  }
  return { st, result: placementResult(st, course) }
}

const idx = (id: string | null) => (id === null ? 0 : lessons.findIndex((l) => l.id === id))

describe('placement test', () => {
  it('asks between 4 and 15 questions; ≥10 unless clearly a beginner', () => {
    for (const k of [0, 10, 30, lessons.length]) {
      const { st } = simulate(k, 7 + k)
      expect(st.asked.length).toBeLessThanOrEqual(MAX_QUESTIONS)
      if (k > 0) expect(st.asked.length).toBeGreaterThanOrEqual(MIN_QUESTIONS)
      else expect(st.asked.length).toBeGreaterThanOrEqual(4)
    }
  })
  it('beginners start from the beginning', () => {
    for (let seed = 1; seed < 6; seed++) expect(simulate(0, seed, 0.1).result).toBeNull()
  })
  it('places learners near their level, erring on the low side', () => {
    for (const k of [12, 25, 40]) {
      if (k >= lessons.length) continue
      const errs: number[] = []
      for (let seed = 1; seed <= 8; seed++) errs.push(idx(simulate(k, seed * 31).result) - k)
      const mean = errs.reduce((a, b) => a + b, 0) / errs.length
      expect(mean).toBeLessThanOrEqual(2)
      expect(mean).toBeGreaterThanOrEqual(-10)
    }
  })
  it('is deterministic for a seed', () => {
    expect(simulate(20, 5).st.asked.map((a) => a.q.exercise)).toEqual(simulate(20, 5).st.asked.map((a) => a.q.exercise))
  })
})

describe('generator options', () => {
  it('builds lesson options from the progress api', () => {
    const api = {
      state: { completedLessons: { 'u1-l1': { bestAccuracy: 1, completions: 1, lastAt: '' } }, settings: { multiVoice: undefined } },
      knownWordIds: () => ['a'],
      mastery: () => 3,
      dueItems: () => [{ kind: 'word' as const, id: 'a' }, { kind: 'word' as const, id: 'b' }],
      weakItems: () => [{ kind: 'word' as const, id: 'b' }, { kind: 'word' as const, id: 'c' }],
    } as unknown as Parameters<typeof lessonGenOptions>[0]
    const o = lessonGenOptions(api, { speaking: true })
    expect(o).toMatchObject({ knownWordIds: ['a'], speaking: true, completedLessonIds: ['u1-l1'], multiVoice: true })
    expect(interleaveCandidates(api).map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(o.mastery!({ kind: 'word', id: 'x' })).toBe(3)
  })
})
