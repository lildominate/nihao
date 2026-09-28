import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import type { Course, ItemRef, LessonResult } from '../types'
import { addDays, daysBetween, localDay } from './dates'
import {
  applySession,
  DEFAULT_SETTINGS,
  displayStreak,
  dueItems,
  initialState,
  knownWordIds,
  lessonStatus,
  newCard,
  reviewCard,
  masteryOfCard,
  sessionXp,
  todayXp,
  weakItems,
  xpHistory,
} from './logic'
import { createProgressStore, parseState, STORAGE_KEY } from './storage'
import { nextInterval, retrievability } from './fsrs'
import type { StorageLike } from './storage'
import { buildApi, ProgressProvider, useProgress } from './index'
import type { ProgressState } from './index'

const w = (id: string): ItemRef => ({ kind: 'word', id })
const s = (id: string): ItemRef => ({ kind: 'sentence', id })

function result(items: [ItemRef, boolean][], lessonId: string | null = 'u1-l1'): LessonResult {
  const correct = items.filter(([, c]) => c).length
  return { lessonId, total: items.length, correct, mistakes: items.length - correct, durationMs: 1000, items: items.map(([item, c]) => ({ item, correct: c })) }
}

const fixtureCourse: Course = {
  units: [
    { id: 'u1', title: 'A', description: '', emoji: 'x', lessons: [
      { id: 'u1-l1', title: '1', kind: 'standard', newWords: [], sentences: [] },
      { id: 'u1-l2', title: '2', kind: 'standard', newWords: [], sentences: [] },
    ] },
    { id: 'u2', title: 'B', description: '', emoji: 'y', lessons: [
      { id: 'u2-l1', title: '3', kind: 'standard', newWords: [], sentences: [] },
    ] },
  ],
  words: {},
  sentences: {},
}

class MemStorage implements StorageLike {
  data = new Map<string, string>()
  getItem(k: string) { return this.data.get(k) ?? null }
  setItem(k: string, v: string) { this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
}

const at = (day: string, h = 10) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, h) }

describe('dates', () => {
  it('uses local date and handles month/year boundaries', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-03-28', '2026-04-02')).toBe(5)
  })
})

describe('defaults', () => {
  it('matches documented settings', () => {
    expect(DEFAULT_SETTINGS).toEqual({ speechRate: 0.85, showHanzi: false, toneColors: true, soundEffects: true, speakingExercises: true, dailyGoalXp: 30 })
  })
})

describe('SRS (FSRS-5)', () => {
  const T = '2026-09-01'
  it('first correct answer → ~1 day, then growing intervals', () => {
    let c = reviewCard(newCard(w('a'), T), true, T)
    expect(c).toMatchObject({ intervalDays: 1, due: '2026-09-02', reps: 1, lastReview: T })
    const intervals = [c.intervalDays]
    for (let i = 0; i < 4; i++) {
      c = reviewCard(c, true, c.due)
      intervals.push(c.intervalDays)
    }
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1])
    expect(intervals[2]).toBeGreaterThanOrEqual(7)
    expect(c.reps).toBe(5)
  })
  it('at 90 % target retention the interval equals stability', () => {
    expect(nextInterval(10)).toBe(10)
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 5)
  })
  it('lapses on wrong: due tomorrow, stability drops, difficulty rises', () => {
    let c = reviewCard(newCard(w('a'), T), true, T)
    c = reviewCard(c, true, c.due)
    const before = c
    c = reviewCard(c, false, c.due)
    expect(c).toMatchObject({ reps: 0, lapses: 1, intervalDays: 1, due: addDays(before.due, 1) })
    expect(c.stability!).toBeLessThan(before.stability!)
    expect(c.difficulty!).toBeGreaterThan(before.difficulty!)
    expect(c.ease).toBeLessThan(before.ease)
    for (let i = 0; i < 20; i++) c = reviewCard(c, false, addDays(T, 10 + i))
    expect(c.difficulty!).toBeLessThanOrEqual(10)
    expect(c.ease).toBeGreaterThanOrEqual(1.3)
  })
  it('does not advance a card reviewed correctly again the same day', () => {
    const c = reviewCard(newCard(w('a'), T), true, T)
    expect(reviewCard(c, true, T)).toBe(c)
  })
  it('an early (not yet due) success grows stability less than an on-time one', () => {
    let c = reviewCard(newCard(w('a'), T), true, T)
    c = reviewCard(c, true, c.due)
    c = reviewCard(c, true, c.due)
    const early = reviewCard(c, true, addDays(c.lastReview!, 1))
    const onTime = reviewCard(c, true, c.due)
    expect(early.stability!).toBeLessThan(onTime.stability!)
  })
  it('first attempt decides quality within a session', () => {
    const r = applySession(initialState(), result([[w('a'), false], [w('a'), true], [w('b'), true], [w('b'), false]]), at(T), T)
    expect(r.state.cards['word:a'].lapses).toBe(1)
    expect(r.state.cards['word:b']).toMatchObject({ reps: 1, lapses: 0 })
  })
  it('mastery 0–5 grows with stability and reps', () => {
    expect(masteryOfCard(undefined)).toBe(0)
    let c = reviewCard(newCard(w('a'), T), false, T)
    expect(masteryOfCard(c)).toBe(1)
    c = reviewCard(newCard(w('a'), T), true, T)
    const seen = [masteryOfCard(c)]
    for (let i = 0; i < 5; i++) { c = reviewCard(c, true, c.due); seen.push(masteryOfCard(c)) }
    expect(seen[0]).toBe(2)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1])
    expect(seen[seen.length - 1]).toBe(5)
  })
  it('api exposes mastery and retrievability', () => {
    const store = createProgressStore(new MemStorage(), () => at(T))
    store.finishSession(result([[w('a'), true]]))
    const api = buildApi(store, store.getState(), fixtureCourse)
    expect(api.mastery(w('a'))).toBe(2)
    expect(api.mastery(w('zz'))).toBe(0)
    expect(api.retrievability(w('a'))).toBe(1)
  })
  it('records dialogue-line items', () => {
    const line: ItemRef = { kind: 'line', id: 'u1-d1:1' }
    const st = applySession(initialState(), result([[line, true]], null), at(T), T).state
    expect(parseState(JSON.stringify(st))!.cards['line:u1-d1:1']).toMatchObject({ reps: 1 })
  })
})

describe('v1 → v2 migration', () => {
  const v1 = {
    version: 1,
    xpTotal: 120,
    completedLessons: { 'u1-l1': { bestAccuracy: 0.9, completions: 2, lastAt: '2026-08-01T10:00:00.000Z' } },
    cards: {
      'word:a': { item: w('a'), ease: 2.6, intervalDays: 8, due: '2026-09-10', reps: 3, lapses: 0 },
      'word:b': { item: w('b'), ease: 1.5, intervalDays: 1, due: '2026-09-02', reps: 0, lapses: 3 },
      'sentence:s': { item: s('s'), ease: 2.5, intervalDays: 3, due: '2026-09-04', reps: 2, lapses: 0 },
    },
    settings: { speechRate: 0.9, multiVoice: false, theme: 'dark' },
  }
  it('keeps every card, due date and counts, and adds FSRS state', () => {
    const st = parseState(JSON.stringify(v1))!
    expect(st.version).toBe(2)
    expect(Object.keys(st.cards).sort()).toEqual(['sentence:s', 'word:a', 'word:b'])
    const a = st.cards['word:a']
    expect(a).toMatchObject({ due: '2026-09-10', reps: 3, lapses: 0, intervalDays: 8, stability: 8, lastReview: '2026-09-02' })
    expect(a.difficulty!).toBeGreaterThan(3)
    expect(a.difficulty!).toBeLessThan(5)
    const b = st.cards['word:b']
    expect(b.difficulty!).toBeGreaterThan(8)
    expect(b.stability!).toBeGreaterThan(0)
    expect(st.xpTotal).toBe(120)
    expect(st.completedLessons['u1-l1'].completions).toBe(2)
    expect(st.settings).toMatchObject({ speechRate: 0.9, multiVoice: false, theme: 'dark' })
  })
  it('migrated cards keep scheduling sensibly', () => {
    const st = parseState(JSON.stringify(v1))!
    const a2 = reviewCard(st.cards['word:a'], true, '2026-09-10')
    expect(a2.intervalDays).toBeGreaterThan(8)
    expect(masteryOfCard(st.cards['word:a'])).toBe(3)
    expect(masteryOfCard(st.cards['word:b'])).toBe(1)
  })
  it('v2 docs roundtrip unchanged', () => {
    const st = parseState(JSON.stringify(v1))!
    expect(parseState(JSON.stringify(st))).toEqual(st)
  })
})

describe('skipToLesson (placement)', () => {
  const course: Course = {
    ...fixtureCourse,
    words: { a: { id: 'a', hanzi: 'a', pinyin: 'ā', sv: 'a' }, b: { id: 'b', hanzi: 'b', pinyin: 'bā', sv: 'b' }, c: { id: 'c', hanzi: 'c', pinyin: 'cā', sv: 'c' } },
    units: [
      { ...fixtureCourse.units[0], lessons: [
        { id: 'u1-l1', title: '1', kind: 'standard', newWords: ['a', 'b'], sentences: [] },
        { id: 'u1-l2', title: '2', kind: 'standard', newWords: ['c'], sentences: [] },
      ] },
      fixtureCourse.units[1],
    ],
  }
  it('completes earlier lessons and seeds their words as fragile known cards', () => {
    const store = createProgressStore(new MemStorage(), () => at('2026-09-01'))
    store.skipToLesson('u2-l1', course)
    const st = store.getState()
    expect(Object.keys(st.completedLessons).sort()).toEqual(['u1-l1', 'u1-l2'])
    expect(lessonStatus(st, course, 'u2-l1')).toBe('available')
    expect(Object.keys(st.cards).sort()).toEqual(['word:a', 'word:b', 'word:c'])
    for (const c of Object.values(st.cards)) {
      expect(c.stability).toBe(2)
      expect(c.due > '2026-09-01').toBe(true)
      expect(masteryOfCard(c)).toBe(2)
    }
    expect(st.xpTotal).toBe(0)
    expect(st.streak.current).toBe(0)
  })
  it('keeps existing cards and is a no-op for the first/unknown lesson', () => {
    const store = createProgressStore(new MemStorage(), () => at('2026-09-01'))
    store.finishSession(result([[w('a'), false]], null))
    const before = store.getState().cards['word:a']
    store.skipToLesson('u1-l2', course)
    expect(store.getState().cards['word:a']).toEqual(before)
    const snap = store.getState()
    store.skipToLesson('u1-l1', course)
    store.skipToLesson('nope', course)
    expect(store.getState()).toBe(snap)
  })
})

describe('XP', () => {
  it('10 base + 1 per first-attempt correct + 5 perfect', () => {
    expect(sessionXp(result([[w('a'), true], [w('b'), true]]))).toBe(10 + 2 + 5)
    expect(sessionXp(result([[w('a'), true], [w('b'), false], [w('b'), true]]))).toBe(10 + 1)
    expect(sessionXp(result([[w('a'), true]], null))).toBe(16)
  })
  it('tracks daily XP by local date', () => {
    let st = initialState()
    st = applySession(st, result([[w('a'), true]]), at('2026-09-01', 23), '2026-09-01').state
    st = applySession(st, result([[w('a'), true]], null), at('2026-09-01', 23), '2026-09-01').state
    expect(todayXp(st, '2026-09-01')).toBe(32)
    expect(st.xpTotal).toBe(32)
    expect(xpHistory(st, '2026-09-02', 2)).toEqual([{ day: '2026-09-01', xp: 32 }, { day: '2026-09-02', xp: 0 }])
  })
})

describe('streak', () => {
  const run = (st: ProgressState, day: string) => applySession(st, result([[w('a'), true]], null), at(day), day)
  it('extends on first session of a day, consecutive days, resets on miss, keeps best', () => {
    let r = run(initialState(), '2026-09-01')
    expect(r.streakExtended).toBe(true)
    expect(r.state.streak.current).toBe(1)
    r = run(r.state, '2026-09-01')
    expect(r.streakExtended).toBe(false)
    expect(r.state.streak.current).toBe(1)
    r = run(r.state, '2026-09-02'); r = run(r.state, '2026-09-03')
    expect(r.state.streak).toEqual({ current: 3, best: 3, lastDay: '2026-09-03' })
    expect(displayStreak(r.state, '2026-09-04')).toBe(3)
    expect(displayStreak(r.state, '2026-09-05')).toBe(0)
    r = run(r.state, '2026-09-05')
    expect(r.streakExtended).toBe(true)
    expect(r.state.streak).toEqual({ current: 1, best: 3, lastDay: '2026-09-05' })
  })
})

describe('lesson unlocking', () => {
  it('is linear across units; completed stays completed', () => {
    let st = initialState()
    expect(lessonStatus(st, fixtureCourse, 'u1-l1')).toBe('available')
    expect(lessonStatus(st, fixtureCourse, 'u1-l2')).toBe('locked')
    st = applySession(st, result([], 'u1-l1'), at('2026-09-01'), '2026-09-01').state
    st = applySession(st, result([], 'u1-l2'), at('2026-09-01'), '2026-09-01').state
    expect(lessonStatus(st, fixtureCourse, 'u1-l1')).toBe('completed')
    expect(lessonStatus(st, fixtureCourse, 'u2-l1')).toBe('available')
    expect(st.completedLessons['u1-l1'].completions).toBe(1)
  })
  it('empty course → available', () => {
    expect(lessonStatus(initialState(), { units: [], words: {}, sentences: {} }, 'x')).toBe('available')
  })
  it('review sessions do not complete lessons', () => {
    const st = applySession(initialState(), result([[w('a'), true]], null), at('2026-09-01'), '2026-09-01').state
    expect(st.completedLessons).toEqual({})
  })
})

describe('queries', () => {
  it('dueItems: most overdue first then lowest ease; weakItems; knownWordIds', () => {
    const st = initialState()
    st.cards = {
      'word:a': { item: w('a'), ease: 2.5, intervalDays: 1, due: '2026-09-05', reps: 1, lapses: 0 },
      'word:b': { item: w('b'), ease: 2.1, intervalDays: 1, due: '2026-09-03', reps: 1, lapses: 2 },
      'word:c': { item: w('c'), ease: 1.9, intervalDays: 1, due: '2026-09-05', reps: 1, lapses: 2 },
      'sentence:d': { item: s('d'), ease: 2.5, intervalDays: 1, due: '2026-09-09', reps: 1, lapses: 1 },
    }
    expect(dueItems(st, '2026-09-05')).toEqual([w('b'), w('c'), w('a')])
    expect(dueItems(st, '2026-09-05', 1)).toEqual([w('b')])
    expect(weakItems(st)).toEqual([w('c'), w('b'), s('d')])
    expect(knownWordIds(st).sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('persistence', () => {
  it('corrupt or unknown data falls back to defaults', () => {
    expect(parseState('{nope')).toBeNull()
    expect(parseState('[]')).toBeNull()
    expect(parseState('{"version":99}')).toBeNull()
    const mem = new MemStorage()
    mem.setItem(STORAGE_KEY, 'garbage')
    expect(createProgressStore(mem).getState()).toEqual(initialState())
  })
  it('sanitizes partial docs', () => {
    const st = parseState(JSON.stringify({ version: 1, xpTotal: 'x', settings: { speechRate: 5, showHanzi: true }, cards: { bad: 1, ok: { item: w('a'), ease: 2 } } }))!
    expect(st.xpTotal).toBe(0)
    expect(st.settings).toMatchObject({ speechRate: 1.2, showHanzi: true, dailyGoalXp: 30 })
    expect(Object.keys(st.cards)).toEqual(['word:a'])
  })
  it('saves on every change and reloads; survives throwing storage', () => {
    const mem = new MemStorage()
    const store = createProgressStore(mem, () => at('2026-09-01'))
    store.finishSession(result([[w('a'), true]]))
    store.updateSettings({ dailyGoalXp: 50 })
    const again = createProgressStore(mem)
    expect(again.getState().xpTotal).toBe(16)
    expect(again.getState().settings.dailyGoalXp).toBe(50)

    const broken: StorageLike = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') }, removeItem() {} }
    const b = createProgressStore(broken)
    expect(() => b.finishSession(result([[w('a'), true]]))).not.toThrow()
    expect(b.getState().xpTotal).toBe(16)
  })
  it('export/import roundtrip; invalid import returns false', () => {
    const a = createProgressStore(new MemStorage(), () => at('2026-09-01'))
    a.finishSession(result([[w('a'), true]]))
    const json = a.exportJson()
    const b = createProgressStore(new MemStorage())
    expect(b.importJson('not json')).toBe(false)
    expect(b.getState().xpTotal).toBe(0)
    expect(b.importJson(json)).toBe(true)
    expect(b.getState()).toEqual(a.getState())
    b.resetAll()
    expect(b.getState()).toEqual(initialState())
  })
})

describe('React', () => {
  it('useProgress throws outside the provider', () => {
    const Comp = () => { useProgress(); return null }
    expect(() => renderToString(createElement(Comp))).toThrow(/ProgressProvider/)
  })
  it('provider exposes the api', () => {
    const store = createProgressStore(new MemStorage(), () => at('2026-09-01'))
    store.finishSession(result([[w('a'), true]]))
    let xp = -1
    const Comp = () => { xp = useProgress().todayXp(); return null }
    renderToString(createElement(ProgressProvider, { store, children: createElement(Comp) }))
    expect(xp).toBe(16)
    expect(buildApi(store, store.getState(), fixtureCourse).lessonStatus('u1-l2')).toBe('available')
  })
})
