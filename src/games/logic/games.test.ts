import { describe, expect, it } from 'vitest'
import type { Course, Word } from '../../types'
import { course } from '../../data/course'
import { seeded, shuffle } from './random'
import { buildWordPool, pickOptions, svLabel, unitWordIds, WordDeck, MIN_POOL, optionKey } from './pool'
import {
  blixtMultiplier, blixtPoints, blixtTimeBonus, builderPoints, memoryScore, memoryStars,
  ordregnFallMs, ordregnLevel, ordregnPoints, tonjaktLevel, tonjaktPoints, tonjaktSyllables,
} from './scoring'
import { classifySwipe, tonePrompts, type Point } from './tones'
import { applyScore, loadRecords, RECORDS_KEY, saveScore } from './records'
import { AnswerTracker, wordRef } from './session'
import { closeOpen, flip, isDone, memoryColumns, newMemory } from './memory'
import { builderTiles, isNextChunk, playableSentences, sentenceChunks } from './builder'

const w = (id: string, pinyin: string, sv: string, hanzi = '字'): Word => ({ id, pinyin, sv, hanzi })

describe('random', () => {
  it('seeded rng is deterministic and shuffle keeps elements', () => {
    const a = shuffle([1, 2, 3, 4, 5], seeded(7))
    const b = shuffle([1, 2, 3, 4, 5], seeded(7))
    expect(a).toEqual(b)
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5])
  })
})

describe('word pool', () => {
  it('uses known words when there are enough', () => {
    const known = Object.keys(course.words).slice(0, 10)
    const p = buildWordPool(known, course)
    expect(p.fallback).toBe(false)
    expect(p.words.map((x) => x.id)).toEqual(known)
  })
  it('falls back to unit 1 (keeping known words) when fewer than 8 are known', () => {
    const p = buildWordPool(['xie-xie', 'nope-missing'], course)
    expect(p.fallback).toBe(true)
    expect(p.knownCount).toBe(1)
    expect(p.words[0].id).toBe('xie-xie')
    expect(p.words.length).toBeGreaterThanOrEqual(MIN_POOL)
    const u1 = new Set(unitWordIds(course, 0))
    expect(p.words.every((x) => u1.has(x.id))).toBe(true)
    expect(new Set(p.words.map((x) => x.id)).size).toBe(p.words.length)
  })
  it('svLabel keeps the first two alternatives', () => {
    expect(svLabel(w('a', 'nǐ hǎo', 'hej/hallå/god dag'))).toBe('hej / hallå')
    expect(svLabel(w('a', 'shuǐ', 'vatten'))).toBe('vatten')
  })
  it('pickOptions: target included, unique labels, no synonyms, tops up from extra', () => {
    const t = w('t', 'nǐ', 'du')
    const pool = [t, w('a', 'nín', 'du (artigt)/du'), w('b', 'nǐ', 'dig'), w('c', 'wǒ', 'jag')]
    const extra = [w('d', 'tā', 'han'), w('e', 'hǎo', 'bra')]
    for (let s = 0; s < 20; s++) {
      const opts = pickOptions(t, pool, (x) => x.pinyin, 4, seeded(s), extra)
      expect(opts).toHaveLength(4)
      expect(opts).toContain(t)
      expect(new Set(opts.map((o) => optionKey(o.pinyin))).size).toBe(4)
      expect(opts.find((o) => o.id === 'a')).toBeUndefined() // shares meaning "du"
      expect(opts.find((o) => o.id === 'b')).toBeUndefined() // same pinyin
    }
  })
  it('WordDeck cycles through all words, never repeats back-to-back, and brings misses back', () => {
    const words = ['a', 'b', 'c', 'd', 'e'].map((id) => w(id, id, id))
    const deck = new WordDeck(words, seeded(3), 2)
    const firstRound = Array.from({ length: 5 }, () => deck.next().id)
    expect(new Set(firstRound).size).toBe(5)
    let prev = firstRound[4]
    for (let i = 0; i < 50; i++) { const n = deck.next().id; expect(n).not.toBe(prev); prev = n }
    const missed = deck.next()
    deck.miss(missed)
    const soon = Array.from({ length: 3 }, () => deck.next().id)
    expect(soon).toContain(missed.id)
  })
})

describe('scoring & speed curves', () => {
  it('ordregn gets faster but never below the floor', () => {
    expect(ordregnFallMs(0)).toBe(6500)
    expect(ordregnFallMs(10)).toBeLessThan(ordregnFallMs(5))
    expect(ordregnFallMs(500)).toBe(1900)
    expect(ordregnLevel(0)).toBe(1)
    expect(ordregnLevel(5)).toBe(2)
    expect(ordregnPoints(1, 0)).toBe(20)
    expect(ordregnPoints(1, 1)).toBe(10)
    expect(ordregnPoints(3, 0.5)).toBe(35)
  })
  it('blixt combos multiply and give time bonus every 5', () => {
    expect([0, 1, 2, 3, 5, 6, 30].map(blixtMultiplier)).toEqual([1, 1, 1, 2, 2, 3, 5])
    expect(blixtPoints(3)).toBe(200)
    expect(blixtTimeBonus(5)).toBe(5000)
    expect(blixtTimeBonus(10)).toBe(5000)
    expect(blixtTimeBonus(4)).toBe(0)
    expect(blixtTimeBonus(0)).toBe(0)
  })
  it('memory: fewer moves and less time is better', () => {
    expect(memoryScore(6, 6, 0)).toBe(600)
    expect(memoryScore(6, 10, 0)).toBeLessThan(memoryScore(6, 8, 0))
    expect(memoryScore(6, 8, 30_000)).toBeLessThan(memoryScore(6, 8, 10_000))
    expect(memoryScore(6, 100, 999_000)).toBe(120)
    expect(memoryStars(6, 6)).toBe(3)
    expect(memoryStars(6, 20)).toBe(1)
  })
  it('tonjakt levels, syllables and streak points', () => {
    expect(tonjaktLevel(0)).toBe(1)
    expect(tonjaktLevel(12)).toBe(3)
    expect(tonjaktSyllables(2)).toBe(1)
    expect(tonjaktSyllables(3)).toBe(2)
    expect(tonjaktPoints(1, 1)).toBe(10)
    expect(tonjaktPoints(5, 2)).toBe(40)
  })
  it('builder points reward clean builds', () => {
    expect(builderPoints(3, 0)).toBe(150)
    expect(builderPoints(3, 1)).toBe(65)
    expect(builderPoints(3, 99)).toBe(10)
  })
})

describe('tones', () => {
  const line = (x0: number, y0: number, x1: number, y1: number, n = 8): Point[] =>
    Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n }))

  it('classifies straight swipes', () => {
    expect(classifySwipe(line(0, 100, 150, 105))).toBe(1)
    expect(classifySwipe(line(0, 100, 120, 20))).toBe(2)
    expect(classifySwipe(line(0, 100, 0, 0))).toBe(2) // straight up
    expect(classifySwipe(line(0, 0, 120, 90))).toBe(4)
    expect(classifySwipe(line(0, 0, 0, 100))).toBe(4) // straight down
    expect(classifySwipe(line(150, 100, 0, 20))).toBe(2) // mirrored rising
  })
  it('classifies a dip (down then up) as tone 3', () => {
    const v = [...line(0, 0, 60, 80), ...line(60, 80, 130, 10).slice(1)]
    expect(classifySwipe(v)).toBe(3)
    const shallowEnd = [...line(0, 0, 80, 90), ...line(80, 90, 120, 85).slice(1)]
    expect(classifySwipe(shallowEnd)).toBe(4) // barely comes back up → falling
  })
  it('ignores taps', () => {
    expect(classifySwipe([{ x: 10, y: 10 }])).toBeNull()
    expect(classifySwipe(line(10, 10, 14, 12))).toBeNull()
  })
  it('builds prompts: skips neutral tone and sandhi words', () => {
    const words = [
      w('ma', 'mǎ', 'häst', '马'), w('mama', 'mā ma', 'mamma', '妈妈'), w('nihao', 'nǐ hǎo', 'hej', '你好'),
      w('zaijian', 'zài jiàn', 'hej då', '再见'), w('buyao', 'bú yào', 'vill inte', '不要'), w('ma5', 'ma', 'fråga', '吗'),
    ]
    expect(tonePrompts(words, 1).map((p) => [p.word.id, p.tones, p.bases])).toEqual([['ma', [3], ['ma']]])
    expect(tonePrompts(words, 2).map((p) => [p.word.id, p.tones, p.bases])).toEqual([['zaijian', [4, 4], ['zai', 'jian']]])
  })
  it('the real course has single- and two-syllable prompts in unit 1–2', () => {
    const words = [...unitWordIds(course, 0), ...unitWordIds(course, 1)].map((id) => course.words[id])
    expect(tonePrompts(words, 1).length).toBeGreaterThanOrEqual(4)
    expect(tonePrompts(words, 2).length).toBeGreaterThanOrEqual(1)
  })
})

describe('records', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m } }
  it('first positive score is a record; lower score is not', () => {
    const s = mem()
    expect(saveScore('ordregn', 120, s).isNewRecord).toBe(true)
    expect(saveScore('ordregn', 80, s).isNewRecord).toBe(false)
    const r = loadRecords(s)
    expect(r.ordregn).toEqual({ best: 120, plays: 2, lastWasRecord: false })
    expect(JSON.parse(s.m.get(RECORDS_KEY)!).ordregn.best).toBe(120)
  })
  it('zero is never a record and corrupt storage never throws', () => {
    expect(applyScore({}, 'memory', 0).isNewRecord).toBe(false)
    const bad = { getItem: () => '{nope', setItem: () => { throw new Error('quota') } }
    expect(loadRecords(bad)).toEqual({})
    expect(() => saveScore('blixt', 10, bad)).not.toThrow()
    const throwing = { getItem: () => { throw new Error('denied') }, setItem: () => {} }
    expect(loadRecords(throwing)).toEqual({})
  })
})

describe('AnswerTracker', () => {
  it('first attempt per word decides; all wrong answers are mistakes', () => {
    const t = new AnswerTracker()
    t.record(wordRef('a'), false)
    t.record(wordRef('a'), true)
    t.record(wordRef('b'), true)
    t.record(wordRef('b'), false)
    const r = t.result(1234.4)
    expect(r).toEqual({
      lessonId: null, source: 'game', total: 2, correct: 1, mistakes: 2, durationMs: 1234,
      items: [{ item: wordRef('a'), correct: false }, { item: wordRef('b'), correct: true }],
    })
  })
})

describe('memory', () => {
  const words = [w('a', 'ā', 'A'), w('b', 'bā', 'B'), w('c', 'cā', 'C')]
  const idxOf = (s: ReturnType<typeof newMemory>, id: string, face: 'pinyin' | 'sv') => s.cards.findIndex((c) => c.wordId === id && c.face === face)

  it('matches pairs and counts moves', () => {
    let s = newMemory(words, seeded(1))
    expect(s.cards).toHaveLength(6)
    let r = flip(s, idxOf(s, 'a', 'pinyin')); s = r.state
    expect(r.event.kind).toBe('first')
    r = flip(s, idxOf(s, 'a', 'sv')); s = r.state
    expect(r.event).toMatchObject({ kind: 'match', wordId: 'a' })
    expect(s.moves).toBe(1)
    expect(flip(s, idxOf(s, 'a', 'pinyin')).event.kind).toBe('ignored')
    for (const id of ['b', 'c']) { s = flip(s, idxOf(s, id, 'sv')).state; s = flip(s, idxOf(s, id, 'pinyin')).state }
    expect(isDone(s)).toBe(true)
    expect(s.moves).toBe(3)
  })
  it('blind mismatches are not blamed, deliberate ones are', () => {
    let s = newMemory(words, seeded(2))
    let r = flip(s, idxOf(s, 'a', 'pinyin')); s = r.state
    r = flip(s, idxOf(s, 'b', 'sv')); s = r.state // never seen b-sv → blind
    expect(r.event).toMatchObject({ kind: 'mismatch', blame: null })
    expect(flip(s, idxOf(s, 'c', 'sv')).event.kind).toBe('ignored') // two open
    s = closeOpen(s)
    r = flip(s, idxOf(s, 'a', 'pinyin')); s = r.state
    r = flip(s, idxOf(s, 'b', 'sv')); s = r.state // seen before → deliberate
    expect(r.event).toMatchObject({ kind: 'mismatch', blame: 'a' })
  })
  it('columns fit the phone', () => {
    expect(memoryColumns(8)).toBe(2)
    expect(memoryColumns(12)).toBe(3)
    expect(memoryColumns(16)).toBe(4)
  })
})

describe('builder', () => {
  const c: Course = {
    units: [],
    words: {},
    sentences: {
      s1: { id: 's1', hanzi: '我是瑞典人', chunks: ['wǒ', 'shì ,', 'Ruì diǎn rén', '?'], sv: 'jag är svensk', svChunks: ['jag', 'är', 'svensk'], wordIds: ['wo', 'shi', 'rui'] },
      s2: { id: 's2', hanzi: '你好', chunks: ['nǐ', 'hǎo'], sv: 'hej', svChunks: ['hej'], wordIds: ['ni', 'hao'] },
    },
  }
  it('selects sentences made from known words only', () => {
    expect(playableSentences(c, ['wo', 'shi', 'rui', 'ni']).map((s) => s.id)).toEqual(['s1'])
    expect(sentenceChunks(c.sentences.s1)).toEqual(['wǒ', 'shì', 'Ruì diǎn rén'])
  })
  it('tiles = chunks + distinct distractors; order check by text', () => {
    const tiles = builderTiles(c.sentences.s1, ['wǒ', 'nǐ', 'hǎo', 'tā'], seeded(4), 2)
    expect(tiles).toHaveLength(5)
    expect(tiles.filter((t) => t.text === 'wǒ')).toHaveLength(1)
    expect(isNextChunk(c.sentences.s1, 0, 'wǒ')).toBe(true)
    expect(isNextChunk(c.sentences.s1, 0, 'shì')).toBe(false)
    expect(isNextChunk(c.sentences.s1, 2, 'Ruì diǎn rén')).toBe(true)
    expect(isNextChunk(c.sentences.s1, 3, 'wǒ')).toBe(false)
  })
  it('the real course offers sentences for unit-1 words', () => {
    expect(playableSentences(course, unitWordIds(course, 0)).length).toBeGreaterThan(3)
  })
})
