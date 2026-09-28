import { describe, expect, it } from 'vitest'
import { course } from '../data/course'
import { generateLessonExercises } from './generate'
import { lessonParts, PART_MAX_SCORED, WORDS_PER_PART } from './parts'

const lessons = course.units.flatMap((u) => u.lessons)

describe('short lesson parts', () => {
  it('keeps every new word and sentence in exactly one part, ≤3 words each', () => {
    for (const l of lessons) {
      const parts = lessonParts(l, course)
      const words = parts.flatMap((p) => p.newWords)
      const sents = parts.flatMap((p) => p.sentences)
      expect(words.sort(), l.id).toEqual(l.newWords.filter((w) => course.words[w]).sort())
      expect(sents.sort(), l.id).toEqual(l.sentences.filter((s) => course.sentences[s]).sort())
      if (l.kind === 'standard') for (const p of parts) expect(p.newWords.length, l.id).toBeLessThanOrEqual(WORDS_PER_PART)
      for (const p of parts) expect(p.id).toBe(l.id)
    }
  })

  it('a sentence only appears once all its new words have been introduced', () => {
    for (const l of lessons) {
      const parts = lessonParts(l, course)
      const seen = new Set<string>()
      for (const p of parts) {
        p.newWords.forEach((w) => seen.add(w))
        for (const sid of p.sentences) {
          for (const w of course.sentences[sid].wordIds) if (l.newWords.includes(w)) expect(seen.has(w), `${sid}:${w}`).toBe(true)
        }
      }
    }
  })

  it('parts are short: ≤ 3 intros + ≤ PART_MAX_SCORED scored steps', () => {
    const known: string[] = []
    for (const l of lessons) {
      for (const p of lessonParts(l, course)) {
        const ex = generateLessonExercises(p, course, { knownWordIds: [...known], maxScored: PART_MAX_SCORED, seed: 1 })
        expect(ex.length, p.id).toBeLessThanOrEqual(PART_MAX_SCORED + WORDS_PER_PART + 1)
        expect(ex.length, p.id).toBeGreaterThanOrEqual(4)
        known.push(...p.newWords)
      }
    }
  })
})
