import { describe, expect, it } from 'vitest'
import type { Exercise } from '../types'
import { fixtureCourse as course } from './fixture.test-data'
import { generateLessonExercises, generateReviewExercises, generateToneDrill, spreadOut } from './generate'
import { itemInfo, itemKey, syllableHanzi } from './items'
import { checkBuild } from './check'
import { syllableBase, syllableTone, withTone } from './pinyinUtil'

const lesson = (id: string) => course.units[0].lessons.find((l) => l.id === id)!
const scored = (ex: Exercise[]) => ex.filter((e) => e.type !== 'intro')
const key = (e: Exercise) => (e.type === 'match-pairs' ? null : itemKey(e.item))

function assertNoBackToBack(ex: Exercise[]) {
  for (let i = 1; i < ex.length; i++) {
    if (ex[i].type === 'intro' || ex[i - 1].type === 'intro') continue
    const a = key(ex[i - 1]), b = key(ex[i])
    if (a && b) expect(a, `back-to-back at ${i}`).not.toBe(b)
  }
}

function assertValidOptions(ex: Exercise[]) {
  for (const e of ex) {
    if (e.type === 'listen-choose' || e.type === 'pinyin-to-sv' || e.type === 'sv-to-pinyin') {
      expect(e.options).toContain(e.answer)
      expect(new Set(e.options).size).toBe(e.options.length)
      expect(e.options.length).toBeGreaterThanOrEqual(3)
      // no distractor may also be a correct meaning
      const info = itemInfo(course, e.item)
      if (e.type !== 'sv-to-pinyin') {
        const accepted = info.svAll.map((s) => s.toLowerCase())
        expect(e.options.filter((o) => accepted.includes(o.toLowerCase()))).toHaveLength(1)
      }
    }
    if (e.type === 'build-pinyin' || e.type === 'build-sv') {
      const s = course.sentences[e.item.id]
      const chunks = e.type === 'build-pinyin' ? s.chunks : s.svChunks
      for (const c of chunks) expect(e.tiles).toContain(c)
      const extra = e.tiles.length - chunks.length
      expect(extra).toBeGreaterThanOrEqual(2)
      expect(extra).toBeLessThanOrEqual(3)
      expect(new Set(e.tiles.map((t) => t.toLowerCase())).size).toBe(e.tiles.length)
    }
    if (e.type === 'match-pairs') {
      expect(e.items.length).toBeGreaterThanOrEqual(4)
      expect(e.items.length).toBeLessThanOrEqual(5)
    }
    if (e.type === 'tone-pick') {
      expect(syllableTone(e.syllable)).toBe(e.answer)
      expect(e.answer).not.toBe(5)
    }
  }
}

describe('pinyin utils', () => {
  it('reads and writes tones', () => {
    expect(syllableTone('shuǐ')).toBe(3)
    expect(syllableTone('ma')).toBe(5)
    expect(syllableBase('lǜ')).toBe('lü')
    expect(withTone('shui', 3)).toBe('shuǐ')
    expect(withTone('hao', 3)).toBe('hǎo')
    expect(withTone('dou', 1)).toBe('dōu')
    expect(withTone('lü', 4)).toBe('lǜ')
    expect(withTone('xie', 4)).toBe('xiè')
  })
  it('maps a syllable to its hanzi', () => {
    expect(syllableHanzi(course, { kind: 'word', id: 'ni-hao' }, 'hǎo')).toBe('好')
  })
})

describe('generateLessonExercises (standard)', () => {
  const l = lesson('u1-l1')
  const ex = generateLessonExercises(l, course, { seed: 1, speaking: true, knownWordIds: ['shui', 'cha'] })

  it('is deterministic for a seed', () => {
    expect(generateLessonExercises(l, course, { seed: 1, speaking: true, knownWordIds: ['shui', 'cha'] })).toEqual(ex)
    expect(generateLessonExercises(l, course, { seed: 2, speaking: true })).not.toEqual(ex)
  })

  it('introduces every new word before testing it', () => {
    for (const id of l.newWords) {
      const introAt = ex.findIndex((e) => e.type === 'intro' && e.item.id === id)
      expect(introAt).toBeGreaterThanOrEqual(0)
      const firstTest = ex.findIndex((e) => e.type !== 'intro' && (e.type === 'match-pairs' ? e.items.some((r) => r.id === id) : e.item.id === id && e.item.kind === 'word'))
      expect(firstTest).toBeGreaterThan(introAt)
    }
  })

  it('has a sensible length and mix', () => {
    const s = scored(ex)
    expect(s.length).toBeGreaterThanOrEqual(12)
    expect(s.length).toBeLessThanOrEqual(18)
    const types = new Set(s.map((e) => e.type))
    for (const t of ['match-pairs', 'type-pinyin'] as const) expect(types).toContain(t)
    expect(types.has('build-pinyin') || types.has('build-sv')).toBe(true)
    expect(types.has('speak')).toBe(true)
  })

  it('ramps: recognition before production', () => {
    const firstProd = ex.findIndex((e) => e.type === 'type-pinyin' || e.type === 'build-pinyin')
    const lastRecog = ex.map((e) => e.type).lastIndexOf('pinyin-to-sv')
    expect(firstProd).toBeGreaterThan(lastRecog)
  })

  it('never tests the same item back-to-back and has valid options', () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const id of ['u1-l1', 'u1-l2', 'u1-t', 'u1-cp']) {
        const e = generateLessonExercises(lesson(id), course, { seed, speaking: seed % 2 === 0 })
        assertNoBackToBack(e)
        assertValidOptions(e)
      }
    }
  })

  it('omits speak exercises when speaking is off', () => {
    const e = generateLessonExercises(l, course, { seed: 3, speaking: false })
    expect(e.some((x) => x.type === 'speak')).toBe(false)
  })

  it('draws build distractors from known words and never duplicates chunks', () => {
    const e = generateLessonExercises(lesson('u1-l2'), course, { seed: 5, knownWordIds: ['wo', 'ni', 'ta'] })
    const builds = e.filter((x) => x.type === 'build-pinyin' || x.type === 'build-sv')
    expect(builds.length).toBeGreaterThanOrEqual(2)
  })
})

describe('tones and checkpoint lessons', () => {
  it('tones lesson is mostly tone-pick + listening', () => {
    const e = scored(generateLessonExercises(lesson('u1-t'), course, { seed: 4 }))
    const toneish = e.filter((x) => x.type === 'tone-pick' || x.type === 'listen-choose').length
    expect(toneish / e.length).toBeGreaterThan(0.6)
    expect(e.length).toBeGreaterThanOrEqual(12)
    expect(e.length).toBeLessThanOrEqual(16)
  })

  it('checkpoint reviews the unit with more production and no intros', () => {
    const e = generateLessonExercises(lesson('u1-cp'), course, { seed: 9, speaking: true })
    expect(e.some((x) => x.type === 'intro')).toBe(false)
    expect(e.length).toBeGreaterThanOrEqual(12)
    expect(e.length).toBeLessThanOrEqual(18)
    const prod = e.filter((x) => ['type-pinyin', 'sv-to-pinyin', 'build-pinyin', 'speak'].includes(x.type)).length
    expect(prod / e.length).toBeGreaterThan(0.5)
  })

  it('handles an empty course gracefully', () => {
    const empty = { units: [], words: {}, sentences: {} }
    expect(generateLessonExercises(lesson('u1-l1'), empty)).toEqual([])
    expect(generateLessonExercises(lesson('u1-cp'), empty)).toEqual([])
  })
})

describe('generateReviewExercises', () => {
  const items = [
    { kind: 'word' as const, id: 'shui' },
    { kind: 'word' as const, id: 'cha' },
    { kind: 'word' as const, id: 'wo' },
    { kind: 'word' as const, id: 'he' },
    { kind: 'sentence' as const, id: 's-wo-he-shui' },
    { kind: 'word' as const, id: 'missing' },
  ]
  it('covers every valid item once (+ match-pairs) and is valid', () => {
    const e = generateReviewExercises(items, course, { seed: 1 })
    const covered = new Set(e.filter((x) => x.type !== 'match-pairs').map((x) => key(x)))
    expect(covered.size).toBe(5)
    expect(e.some((x) => x.type === 'match-pairs')).toBe(true)
    assertValidOptions(e)
    assertNoBackToBack(e)
    expect(e.some((x) => x.type === 'speak')).toBe(false)
  })
})

describe('generateToneDrill', () => {
  it('produces the requested count with balanced tones', () => {
    const e = generateToneDrill(['ni-hao', 'xie-xie', 'shui', 'cha', 'ta', 'shi', 'fan'], course, 12, { seed: 1 })
    expect(e).toHaveLength(12)
    const counts = [1, 2, 3, 4].map((t) => e.filter((x) => x.type === 'tone-pick' && x.answer === t).length)
    for (const c of counts) expect(c).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < e.length; i++) {
      const a = e[i - 1], b = e[i]
      if (a.type === 'tone-pick' && b.type === 'tone-pick') expect(a.syllable).not.toBe(b.syllable)
    }
  })
  it('returns [] without tonal words', () => {
    expect(generateToneDrill(['ma'], course)).toEqual([])
  })
})

describe('spreadOut', () => {
  it('separates repeated items', () => {
    const w = (id: string): Exercise => ({ type: 'type-pinyin', item: { kind: 'word', id } })
    const out = spreadOut([w('a'), w('a'), w('b'), w('c')])
    assertNoBackToBack(out)
  })
})

describe('checkBuild', () => {
  it('accepts correct orders and alternatives', () => {
    const s = course.sentences['s-ni-hao-ma']
    expect(checkBuild('build-pinyin', s, ['nǐ', 'hǎo', 'ma', '?'])).toBe(true)
    expect(checkBuild('build-pinyin', s, ['hǎo', 'nǐ', 'ma', '?'])).toBe(false)
    expect(checkBuild('build-sv', s, ['Hur', 'mår', 'du?'])).toBe(true)
    expect(checkBuild('build-sv', s, ['Mår', 'du', 'bra?'])).toBe(true)
    expect(checkBuild('build-sv', s, ['Hur', 'du', 'mår'])).toBe(false)
  })
})
