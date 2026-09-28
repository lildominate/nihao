// Lead: end-to-end check that the real course works with the real generator.
import { describe, expect, it } from 'vitest'
import { course } from './data/course'
import { generateLessonExercises, generateReviewExercises, generateToneDrill } from './exercises'
import type { Exercise } from './types'

const known: string[] = []
const lessons = course.units.flatMap((u) => u.lessons)

function itemsOf(e: Exercise) {
  return e.type === 'match-pairs' ? e.items : [e.item]
}

describe('real course × generator', () => {
  it.each(lessons.map((l) => [l.id, l] as const))('%s generates valid exercises', (_id, lesson) => {
    for (const speaking of [true, false]) {
      const ex = generateLessonExercises(lesson, course, { knownWordIds: known, speaking })
      const scored = ex.filter((e) => e.type !== 'intro')
      expect(scored.length).toBeGreaterThanOrEqual(6)
      expect(scored.length).toBeLessThanOrEqual(20)
      if (!speaking) expect(ex.some((e) => e.type === 'speak')).toBe(false)
      // Learner feedback: no tone guessing, no free-text pinyin, no mic exercises inside lessons.
      for (const banned of ['tone-pick', 'type-pinyin', 'speak', 'shadow'] as const) {
        expect(ex.some((e) => e.type === banned), `${lesson.id} contains ${banned}`).toBe(false)
      }
      for (const e of ex) {
        for (const it of itemsOf(e)) {
          const ok = it.kind === 'word' ? course.words[it.id] : course.sentences[it.id]
          expect(ok, `${e.type} → ${it.kind}:${it.id}`).toBeTruthy()
        }
        if ('options' in e) {
          expect(e.options).toContain(e.answer)
          expect(new Set(e.options).size).toBe(e.options.length)
        }
      }
    }
    known.push(...lesson.newWords)
  })

  it('review and tone drill work on the full vocabulary', () => {
    const items = Object.keys(course.words).slice(0, 30).map((id) => ({ kind: 'word' as const, id }))
    expect(generateReviewExercises(items, course).length).toBeGreaterThan(0)
    expect(generateToneDrill(Object.keys(course.words), course, 15).length).toBeGreaterThan(0)
  })
})

describe('build answers', () => {
  it('accepts an equivalent course sentence ("hej lärare" = nǐ hǎo, lǎo shī)', async () => {
    const { checkBuild } = await import('./exercises/check')
    const target = Object.values(course.sentences).find((s) => s.chunks.join(' ').replace(/ ,/g, '') === 'lǎo shī hǎo')!
    expect(target).toBeTruthy()
    expect(checkBuild('build-pinyin', target, ['nǐ', 'hǎo', 'lǎo shī'], course)).toBe(true)
    expect(checkBuild('build-pinyin', target, ['lǎo shī', 'hǎo'], course)).toBe(true)
    expect(checkBuild('build-pinyin', target, ['hǎo', 'lǎo shī'], course)).toBe(false)
  })
})
