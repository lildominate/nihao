import { describe, expect, it } from 'vitest'
import type { Theme } from '../types'
import { seeded } from '../games/logic/random'
import { fixtureThemed } from './fixture'
import {
  buildQuestion, buildRound, loadThemeBests, nearCountFor, pickDistractors, planThemeLesson, saveThemeScore,
  themeMastery, themeProgress, themesOf, THEMES_KEY,
} from './logic'

const all = fixtureThemed.themes as Theme[]
const [food, animals, cars] = all
const words = Object.values(fixtureThemed.words)

describe('planThemeLesson', () => {
  it('starts with 3 unlearned words as Del 1', () => {
    const p = planThemeLesson(food, fixtureThemed, new Set())
    expect(p.mode).toBe('learn')
    if (p.mode !== 'learn') return
    expect(p.lesson).toEqual({ id: 'theme:t-food:1', kind: 'standard', title: 'Mat · Del 1', newWords: ['ping-guo', 'shui', 'mi-fan'], sentences: [] })
  })
  it('skips known words and advances the part number', () => {
    const p = planThemeLesson(food, fixtureThemed, new Set(['ping-guo', 'shui', 'mi-fan', 'ji-dan']))
    if (p.mode !== 'learn') throw new Error('learn')
    expect(p.n).toBe(2)
    expect(p.lesson.newWords).toEqual(['cha', 'mian-bao'])
  })
  it('falls back to review, weakest first, when all are known', () => {
    const p = planThemeLesson(food, fixtureThemed, new Set(food.words), (i) => (i.id === 'cha' ? 0 : 3))
    if (p.mode !== 'review') throw new Error('review')
    expect(p.items[0].id).toBe('cha')
    expect(p.items).toHaveLength(6)
  })
})

describe('progress', () => {
  it('counts known words and ignores unknown ids', () => {
    expect(themeProgress(food, fixtureThemed, new Set(['shui', 'gou']))).toEqual({ known: 1, total: 6 })
    expect(themeMastery(food, fixtureThemed, () => 5)).toBe(1)
  })
  it('handles a course without themes', () => {
    expect(themesOf({ ...fixtureThemed, themes: undefined })).toEqual([])
  })
})

describe('pickDistractors', () => {
  it('never duplicates or repeats the pinyin, at every mastery level', () => {
    for (let seed = 0; seed < 40; seed++) for (const w of words) for (const m of [0, 2, 5]) {
      const theme = all.find((t) => t.words.includes(w.id))!
      const d = pickDistractors(w, theme, fixtureThemed, all, m, seeded(seed))
      const ids = [w.id, ...d.map((x) => x.id)]
      expect(new Set(ids).size).toBe(ids.length)
      expect(new Set([w, ...d].map((x) => x.pinyin)).size).toBe(d.length + 1)
      expect(d.length).toBe(3)
    }
  })
  it('low mastery draws from other themes, high mastery stays in the theme', () => {
    const t = fixtureThemed.words['ping-guo']
    let farOther = 0
    for (let s = 0; s < 40; s++) {
      farOther += pickDistractors(t, food, fixtureThemed, all, 0, seeded(s)).filter((x) => !food.words.includes(x.id)).length
      const hi = pickDistractors(t, food, fixtureThemed, all, 5, seeded(s))
      expect(hi.every((x) => food.words.includes(x.id))).toBe(true)
    }
    expect(farOther).toBeGreaterThan(40)
  })
  it('works for a tiny theme by borrowing from others', () => {
    const q = buildQuestion(fixtureThemed.words.che, cars, fixtureThemed, all, 0, seeded(1))
    expect(q.options).toHaveLength(4)
    expect(q.options.some((o) => o.id === 'che')).toBe(true)
  })
  it('nearCountFor grows with mastery', () => {
    expect([0, 1, 2, 3, 4, 5].map(nearCountFor)).toEqual([0, 0, 1, 1, 3, 3])
  })
})

describe('buildRound', () => {
  it('draws distinct theme words, up to the round size', () => {
    const r = buildRound(food, fixtureThemed, {}, seeded(3))
    expect(r).toHaveLength(6)
    expect(new Set(r.map((w) => w.id)).size).toBe(6)
    expect(buildRound(animals, fixtureThemed, {}, seeded(3), 2)).toHaveLength(2)
  })
  it('favours heavily weighted (weak/unseen) words', () => {
    let first = 0
    for (let s = 0; s < 200; s++) if (buildRound(food, fixtureThemed, { cha: 50 }, seeded(s), 1)[0].id === 'cha') first++
    expect(first).toBeGreaterThan(150)
  })
})

describe('best score', () => {
  it('saves per theme and tolerates broken storage', () => {
    const m = new Map<string, string>()
    const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
    expect(saveThemeScore('t-food', 50, s)).toEqual({ best: 50, isNewRecord: true })
    expect(saveThemeScore('t-food', 40, s)).toEqual({ best: 50, isNewRecord: false })
    expect(loadThemeBests(s)['t-food']).toEqual({ best: 50, plays: 2 })
    m.set(THEMES_KEY, '{bad')
    expect(loadThemeBests(s)).toEqual({})
    expect(saveThemeScore('x', 5, null).best).toBe(5)
  })
})
