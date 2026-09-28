import { describe, expect, it } from 'vitest'
import { course } from '../../data/course'
import { seeded } from './random'
import { buildWordPool } from './pool'
import { playableSentences } from './builder'
import {
  approachSeconds, clampLane, depthScale, easeLane, gateCount, gateLanes, gateSentences, layoutGates, LANES, moveLane, PHRASE_FROM,
  pickSentenceGateOptions, pickWordGateOptions, project, resolveLane, RunnerDeck, runnerFinalBonus, runnerPoints, sentenceItem, swipeDir,
  tapDir, wordItem, worldSpeed,
} from './runner'

const pool = buildWordPool(Object.keys(course.words).slice(0, 30), course)
const sentences = playableSentences(course, Object.keys(course.words))

describe('difficulty curve', () => {
  it('starts with 2 gates and moves to 3', () => {
    expect(gateCount(0)).toBe(2)
    expect(gateCount(4)).toBe(2)
    expect(gateCount(5)).toBe(3)
    expect(gateCount(19)).toBe(3)
  })
  it('gets faster but never impossible', () => {
    for (let i = 1; i < 20; i++) expect(approachSeconds(i)).toBeLessThanOrEqual(approachSeconds(i - 1))
    expect(approachSeconds(0)).toBeGreaterThan(4)
    expect(approachSeconds(19)).toBeGreaterThanOrEqual(2.8)
    expect(worldSpeed(19)).toBeGreaterThan(worldSpeed(0))
  })
  it('scores combos with a cap and a life bonus only when finished', () => {
    expect(runnerPoints(1)).toBe(100)
    expect(runnerPoints(3)).toBe(150)
    expect(runnerPoints(99)).toBe(runnerPoints(20))
    expect(runnerFinalBonus(2, true)).toBe(100)
    expect(runnerFinalBonus(2, false)).toBe(0)
  })
})

describe('lanes and gates', () => {
  it('gate lanes are distinct and within range', () => {
    for (let s = 0; s < 30; s++) {
      for (const n of [2, 3]) {
        const l = gateLanes(n, seeded(s))
        expect(l.length).toBe(n)
        expect(new Set(l).size).toBe(n)
        expect(l.every((x) => x >= 0 && x < LANES)).toBe(true)
      }
    }
  })
  it('layout has exactly one correct gate and unique labels', () => {
    for (let s = 0; s < 40; s++) {
      const rng = seeded(s)
      const w = pool.words[s % pool.words.length]
      const idx = s % 12
      const r = layoutGates(idx, wordItem(w), pickWordGateOptions(w, pool.words, Object.values(course.words), 3, rng).map(wordItem), rng)
      expect(r.gates.length).toBe(gateCount(idx))
      expect(r.gates.filter((g) => g.correct).length).toBe(1)
      expect(new Set(r.gates.map((g) => g.item.pinyin)).size).toBe(r.gates.length)
      expect(new Set(r.gates.map((g) => g.lane)).size).toBe(r.gates.length)
    }
  })
  it('resolves lanes: correct, wrong and walls', () => {
    const w = pool.words[0]
    const rng = seeded(3)
    const r = layoutGates(0, wordItem(w), pickWordGateOptions(w, pool.words, [], 2, rng).map(wordItem), rng)
    const good = r.gates.find((g) => g.correct)!
    const bad = r.gates.find((g) => !g.correct)!
    expect(resolveLane(r.gates, good.lane).kind).toBe('correct')
    expect(resolveLane(r.gates, bad.lane).kind).toBe('wrong')
    const empty = [0, 1, 2].find((l) => !r.gates.some((g) => g.lane === l))!
    expect(resolveLane(r.gates, empty).kind).toBe('wall')
  })
  it('clamps and eases lanes', () => {
    expect(clampLane(-3)).toBe(0)
    expect(clampLane(7)).toBe(2)
    expect(moveLane(0, -1)).toBe(0)
    expect(moveLane(1, 1)).toBe(2)
    let x = 0
    for (let i = 0; i < 30; i++) x = easeLane(x, 2, 1 / 60)
    expect(x).toBeGreaterThan(1)
    expect(x).toBeLessThan(2)
    for (let i = 0; i < 120; i++) x = easeLane(x, 2, 1 / 60)
    expect(x).toBe(2)
  })
})

describe('input', () => {
  it('swipes need distance and a mostly horizontal direction', () => {
    expect(swipeDir(10, 0)).toBe(0)
    expect(swipeDir(-40, 5)).toBe(-1)
    expect(swipeDir(40, 5)).toBe(1)
    expect(swipeDir(40, 90)).toBe(0)
  })
  it('taps choose left or right half', () => {
    expect(tapDir(50, 375)).toBe(-1)
    expect(tapDir(300, 375)).toBe(1)
  })
})

describe('projection', () => {
  const v = { w: 375, h: 600 }
  it('objects grow as they approach and lanes converge to the horizon', () => {
    expect(depthScale(0)).toBeCloseTo(1)
    expect(depthScale(0.5)).toBeLessThan(depthScale(0.2))
    expect(depthScale(1)).toBeLessThan(depthScale(0.5))
    const far = project(0, 1, v)
    const near = project(0, 0, v)
    expect(near.y).toBeGreaterThan(far.y)
    expect(project(1, 0.5, v).x).toBeCloseTo(v.w / 2)
    expect(Math.abs(far.x - v.w / 2)).toBeLessThan(Math.abs(near.x - v.w / 2))
    expect(project(0, 0, v).x).toBeLessThan(project(2, 0, v).x)
  })
})

describe('sentence options and deck', () => {
  it('picks sentence rivals with distinct pinyin', () => {
    const list = gateSentences(sentences)
    expect(list.length).toBeGreaterThanOrEqual(3)
    const o = pickSentenceGateOptions(list[0], list, 3, seeded(1))
    expect(o.length).toBe(3)
    expect(new Set(o.map((s) => sentenceItem(s).pinyin)).size).toBe(3)
    expect(o.some((s) => s.id === list[0].id)).toBe(true)
  })
  it('deck serves words early and mixes phrases later, all from the pool', () => {
    const deck = new RunnerDeck(pool.words, Object.values(course.words), sentences, seeded(9))
    const kinds: string[] = []
    for (let i = 0; i < 20; i++) {
      const r = deck.next(i)
      kinds.push(r.target.kind)
      expect(r.gates.filter((g) => g.correct).length).toBe(1)
      if (i < PHRASE_FROM) expect(r.target.kind).toBe('word')
    }
    expect(kinds).toContain('sentence')
  })
  it('a missed word returns', () => {
    const deck = new RunnerDeck(pool.words.slice(0, 8), pool.words, [], seeded(2))
    const first = deck.next(0).target
    deck.miss(first)
    const seen = [1, 2, 3, 4, 5, 6].map((i) => deck.next(i).target.key)
    expect(seen).toContain(first.key)
  })
})
