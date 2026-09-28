import { describe, expect, it } from 'vitest'
import type { ItemRef, Word } from '../../types'
import { seeded } from './random'
import { WordDeck } from './pool'
import { buildWeights, sentenceWeight, weightedPick, WeightedPicker, wordWeight, type WeightSource } from './weighting'

const w = (id: string): Word => ({ id, pinyin: id, sv: id, hanzi: '字' })
const words = ['a', 'b', 'c', 'd', 'e', 'f'].map(w)

const src = (o: { mastery?: Record<string, number>; ret?: Record<string, number>; due?: string[]; weak?: string[] }): WeightSource => ({
  mastery: (i: ItemRef) => o.mastery?.[i.id] ?? 3,
  retrievability: (i: ItemRef) => o.ret?.[i.id] ?? 0.9,
  dueItems: () => (o.due ?? []).map((id) => ({ kind: 'word', id })),
  weakItems: () => (o.weak ?? []).map((id) => ({ kind: 'word', id })),
})

describe('wordWeight', () => {
  const base = { mastery: 3, retrievability: 0.9, due: false, weak: false }
  it('ranks low mastery, due, weak and forgotten above mastered words', () => {
    expect(wordWeight({ ...base, mastery: 0 })).toBeGreaterThan(wordWeight(base))
    expect(wordWeight({ ...base, mastery: 5 })).toBeLessThan(wordWeight(base))
    expect(wordWeight({ ...base, due: true })).toBeGreaterThan(wordWeight(base))
    expect(wordWeight({ ...base, weak: true })).toBeGreaterThan(wordWeight(base))
    expect(wordWeight({ ...base, retrievability: 0.3 })).toBeGreaterThan(wordWeight(base))
  })
  it('mastered words keep a positive weight (variety)', () => {
    expect(wordWeight({ mastery: 5, retrievability: 1, due: false, weak: false })).toBeGreaterThan(0)
  })
})

describe('buildWeights', () => {
  it('gives weak+due words the highest weight', () => {
    const wt = buildWeights(words, src({ due: ['b'], weak: ['b'], mastery: { a: 5 } }))
    expect(wt.b).toBeGreaterThan(wt.c)
    expect(wt.a).toBeLessThan(wt.c)
  })
})

describe('weightedPick / WeightedPicker', () => {
  it('a weak word is chosen much more often over 1000 draws, and never back-to-back', () => {
    const wt = buildWeights(words, src({ due: ['b'], weak: ['b'], mastery: { b: 1, a: 5 } }))
    const picker = new WeightedPicker(words, (x) => wt[x.id], (x) => x.id, seeded(11))
    const counts: Record<string, number> = {}
    let prev = ''
    for (let i = 0; i < 1000; i++) {
      const id = picker.next().id
      expect(id).not.toBe(prev)
      prev = id
      counts[id] = (counts[id] ?? 0) + 1
    }
    expect(counts.b).toBeGreaterThan(counts.c * 1.3)
    expect(counts.b).toBeGreaterThan(counts.a * 2)
    for (const x of words) expect(counts[x.id]).toBeGreaterThan(20) // variety survives
  })
  it('single item is returned even if it was the last', () => {
    expect(weightedPick([w('a')], () => 1, (x) => x.id, seeded(1), ['a']).id).toBe('a')
  })
  it('WordDeck with weights favours weak words and still brings misses back', () => {
    const weights = { a: 1, b: 8, c: 1, d: 1, e: 1, f: 1 }
    const deck = new WordDeck(words, seeded(5), 2, weights)
    const n: Record<string, number> = {}
    let prev = ''
    for (let i = 0; i < 600; i++) { const id = deck.next().id; expect(id).not.toBe(prev); prev = id; n[id] = (n[id] ?? 0) + 1 }
    expect(n.b).toBeGreaterThan(n.a * 2)
    const m = deck.next()
    deck.miss(m)
    expect(Array.from({ length: 3 }, () => deck.next().id)).toContain(m.id)
  })
  it('sentenceWeight averages word weights', () => {
    const s = { id: 's', hanzi: '', chunks: [], sv: '', svChunks: [], wordIds: ['a', 'b'] }
    expect(sentenceWeight(s, { a: 1, b: 3 })).toBe(2)
  })
})
