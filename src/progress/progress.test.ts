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
  sessionXp,
  todayXp,
  weakItems,
  xpHistory,
} from './logic'
import { createProgressStore, parseState, STORAGE_KEY } from './storage'
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

describe('SRS', () => {
  const T = '2026-09-01'
  it('grows interval 1d, 3d, then ×ease', () => {
    let c = reviewCard(newCard(w('a'), T), true, T)
    expect(c).toMatchObject({ intervalDays: 1, due: '2026-09-02', reps: 1 })
    c = reviewCard(c, true, c.due)
    expect(c).toMatchObject({ intervalDays: 3, due: '2026-09-05', reps: 2 })
    const ease = c.ease
    c = reviewCard(c, true, c.due)
    expect(c.intervalDays).toBe(Math.round(3 * ease))
    expect(c.reps).toBe(3)
  })
  it('lapses on wrong: reset interval, ease −0.2, floor 1.3', () => {
    let c = reviewCard(newCard(w('a'), T), true, T)
    c = reviewCard(c, false, c.due)
    expect(c).toMatchObject({ reps: 0, lapses: 1, intervalDays: 1, due: '2026-09-03' })
    expect(c.ease).toBeCloseTo(2.35)
    for (let i = 0; i < 20; i++) c = reviewCard(c, false, T)
    expect(c.ease).toBe(1.3)
  })
  it('does not advance a card reviewed correctly before it is due', () => {
    const c = reviewCard(newCard(w('a'), T), true, T)
    expect(reviewCard(c, true, T)).toBe(c)
  })
  it('first attempt decides quality within a session', () => {
    const r = applySession(initialState(), result([[w('a'), false], [w('a'), true], [w('b'), true], [w('b'), false]]), at(T), T)
    expect(r.state.cards['word:a'].lapses).toBe(1)
    expect(r.state.cards['word:b']).toMatchObject({ reps: 1, lapses: 0 })
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
