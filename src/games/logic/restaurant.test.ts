import { describe, expect, it } from 'vitest'
import { course } from '../../data/course'
import { MENU, NO_SPICY_ID, resolveMenu } from './menu'
import { seeded } from './random'
import {
  counterFor, finalBonus, generateOrder, gridSize, kindsFor, levelFor, patienceMs, pinyinVisible, tipFor, trayMatches, CUSTOMERS,
} from './restaurant'

const menu = resolveMenu(new Map(Object.entries(course.words)))

describe('menu', () => {
  it('has 20-30 unique items with tone-marked pinyin and no written sandhi', () => {
    expect(MENU.length).toBeGreaterThanOrEqual(20)
    expect(MENU.length).toBeLessThanOrEqual(30)
    expect(new Set(MENU.map((m) => m.id)).size).toBe(MENU.length)
    for (const m of MENU) expect(m.pinyin).toMatch(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/)
    expect(MENU.some((m) => /yí|bú/.test(m.pinyin))).toBe(false)
  })
  it('wordIds exist in course.words and resolveMenu uses the course pinyin', () => {
    for (const m of MENU.filter((x) => x.wordId)) {
      const w = course.words[m.wordId!]
      expect(w, m.id).toBeTruthy()
      expect(w.hanzi).toBe(m.hanzi)
    }
    for (const m of menu.filter((x) => x.wordId)) expect(m.pinyin).toBe(course.words[m.wordId!].pinyin)
  })
})

describe('difficulty', () => {
  it('levels ramp 1..4 across 8 customers', () => {
    expect(Array.from({ length: CUSTOMERS }, (_, i) => levelFor(i))).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
  })
  it('patience shortens with level, lengthens with order size', () => {
    expect(patienceMs(4, 1)).toBeLessThan(patienceMs(1, 1))
    expect(patienceMs(2, 3)).toBeGreaterThan(patienceMs(2, 1))
    expect(patienceMs(4, 1)).toBeGreaterThanOrEqual(9000)
  })
  it('pinyin is free on levels 1-2 and needs a tap after', () => {
    expect(pinyinVisible(2, false)).toBe(true)
    expect(pinyinVisible(3, false)).toBe(false)
    expect(pinyinVisible(3, true)).toBe(true)
  })
})

describe('order generation', () => {
  it('level 1 is always one dish', () => {
    const rng = seeded(1)
    for (let i = 0; i < 40; i++) {
      const o = generateOrder(menu, 0, rng)
      expect(o.tray).toHaveLength(1)
      expect(menu.find((m) => m.id === o.tray[0])!.kind).toBe('dish')
      expect(o.hanzi.startsWith('我要')).toBe(true)
      expect(o.pinyin.startsWith('wǒ yào')).toBe(true)
    }
  })
  it('later levels use only their allowed kinds and give consistent trays', () => {
    const rng = seeded(7)
    for (let idx = 0; idx < CUSTOMERS; idx++) {
      for (let n = 0; n < 30; n++) {
        const o = generateOrder(menu, idx, rng)
        expect(kindsFor(levelFor(idx))).toContain(o.kind)
        for (const id of o.tray) if (id !== NO_SPICY_ID) expect(menu.some((m) => m.id === id)).toBe(true)
        if (o.tray.includes(NO_SPICY_ID)) {
          expect(o.pinyin).toContain('bù yào là')
          expect(menu.find((m) => m.id === o.tray[0])!.spicy).toBe(true)
        }
      }
    }
  })
  it('is deterministic per seed', () => {
    expect(generateOrder(menu, 3, seeded(3))).toEqual(generateOrder(menu, 3, seeded(3)))
  })
})

describe('tray + counter', () => {
  it('matches as a multiset regardless of order', () => {
    const o = { tray: ['a', 'b', 'b'] }
    expect(trayMatches(o, ['b', 'a', 'b'])).toBe(true)
    expect(trayMatches(o, ['a', 'b'])).toBe(false)
    expect(trayMatches(o, ['a', 'b', 'b', 'c'])).toBe(false)
  })
  it('counter has every needed card, unique, at the right size', () => {
    const rng = seeded(11)
    for (let idx = 0; idx < CUSTOMERS; idx++) {
      for (let n = 0; n < 20; n++) {
        const o = generateOrder(menu, idx, rng)
        const cards = counterFor(o, menu, rng)
        expect(cards).toHaveLength(gridSize(o.level))
        expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length)
        for (const id of o.tray) expect(cards.some((c) => c.id === id)).toBe(true)
        expect(cards.some((c) => c.id === NO_SPICY_ID)).toBe(o.level >= 3)
      }
    }
  })
})

describe('scoring', () => {
  it('tips grow with level, patience left and streak', () => {
    expect(tipFor(2, 1, 0)).toBeGreaterThan(tipFor(1, 1, 0))
    expect(tipFor(1, 1, 0)).toBeGreaterThan(tipFor(1, 0, 0))
    expect(tipFor(1, 0.5, 4)).toBeGreaterThan(tipFor(1, 0.5, 0))
    expect(tipFor(1, -3, 0)).toBe(10)
  })
  it('final bonus only for completed rounds', () => {
    expect(finalBonus(3, true)).toBe(75)
    expect(finalBonus(3, false)).toBe(0)
  })
})
