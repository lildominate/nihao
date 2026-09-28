import { describe, expect, it } from 'vitest'
import type { LessonResult } from '../types'
import { addDays } from '../progress/dates'
import { levelForXp, xpForLevel, titleForLevel, MAX_LEVEL } from './levels'
import { applySessionToQuests, CHEST_XP, longestRun, questDelta, questsForDay, questViews, QUEST_POOL } from './quests'
import { computeEffectiveStreak, milestoneAtOrBelow } from './streak'
import { ACHIEVEMENTS, achievementViews, countTonesMastered, newlyEarned, tonesIn, type AchievementCtx } from './achievements'
import { claimChest, evaluate, initialDoc, reduceSession, rollQuests, weekStart, weeklyRecap, type MotivationDoc } from './state'
import { createMotivationStore, MOTIVATION_KEY, parseDoc } from './storage'

const w = (id: string) => ({ kind: 'word' as const, id })
function result(p: Partial<LessonResult> & { pattern?: boolean[] } = {}): LessonResult {
  const pattern = p.pattern ?? [true, true, true]
  const items = pattern.map((c, i) => ({ item: w(`w${i}`), correct: c }))
  const mistakes = pattern.filter((c) => !c).length
  return { lessonId: 'u1-l1', source: 'lesson', total: pattern.length, correct: pattern.length - mistakes, mistakes, durationMs: 1000, items, ...p }
}
const ctx0 = (): AchievementCtx => ({
  lessonsCompleted: 0, unitsCompleted: 0, wordsKnown: 0, levelXp: 0, level: 1, bestStreak: 0, perfectSessions: 0, sessions: 0,
  dialogues: 0, games: 0, bestGameCorrect: 0, labSessions: 0, reviews: 0, nightOwl: 0, earlyBird: 0, bestRun: 0, chests: 0,
  tonesMastered: 0, freezesUsed: 0,
})
const xpDays = (days: string[], xp = 20) => Object.fromEntries(days.map((d) => [d, xp]))
const range = (start: string, n: number) => Array.from({ length: n }, (_, i) => addDays(start, i))

describe('levels', () => {
  it('uses a 50·(n−1)^1.5 cumulative curve', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(50)
    expect(xpForLevel(3)).toBe(141)
    expect(xpForLevel(MAX_LEVEL)).toBe(17150)
    for (let n = 2; n <= MAX_LEVEL; n++) expect(xpForLevel(n)).toBeGreaterThan(xpForLevel(n - 1))
  })
  it('derives level, progress and remaining xp', () => {
    expect(levelForXp(0)).toMatchObject({ level: 1, progress: 0, xpToNext: 50 })
    expect(levelForXp(49).level).toBe(1)
    expect(levelForXp(50)).toMatchObject({ level: 2, progress: 0 })
    expect(levelForXp(95).progress).toBeCloseTo(45 / 91)
    expect(levelForXp(1e9)).toMatchObject({ level: 50, isMax: true, progress: 1, xpToNext: 0, nextLevelXp: null })
    expect(levelForXp(NaN).level).toBe(1)
    expect(levelForXp(-5).level).toBe(1)
  })
  it('has band titles', () => {
    expect(titleForLevel(1).sv).toBe('Nybörjare')
    expect(titleForLevel(5).sv).toBe('Tebutiksstammis')
    expect(titleForLevel(27).sv).toBe('Pinyin-mästare')
    expect(titleForLevel(50).sv).toBe('Mandarinlegend')
  })
})

describe('daily quests', () => {
  it('is deterministic per day, 3 quests, distinct kinds, one xp quest first', () => {
    const a = questsForDay('2026-09-27')
    expect(questsForDay('2026-09-27')).toEqual(a)
    expect(a).toHaveLength(3)
    expect(a[0].kind).toBe('xp')
    expect(new Set(a.map((q) => q.kind)).size).toBe(3)
    // Variety across days
    const sets = new Set(range('2026-01-01', 30).map((d) => questsForDay(d).map((q) => q.id).join()))
    expect(sets.size).toBeGreaterThan(10)
    // Every pool quest appears eventually
    const seen = new Set(range('2026-01-01', 365).flatMap((d) => questsForDay(d).map((q) => q.id)))
    expect(seen.size).toBe(QUEST_POOL.length)
  })
  it('computes deltas from source and items', () => {
    const r = result({ pattern: [true, true, false, true, true, true] })
    expect(longestRun(r)).toBe(3)
    expect(questDelta('xp', r, 17)).toBe(17)
    expect(questDelta('lessons', r, 0)).toBe(1)
    expect(questDelta('lessons', { ...r, source: 'review', lessonId: null }, 0)).toBe(0)
    expect(questDelta('game', { ...r, source: 'game', lessonId: null }, 0)).toBe(1)
    expect(questDelta('lab', { ...r, source: 'lab', lessonId: null }, 0)).toBe(1)
    expect(questDelta('dialogue', { ...r, source: 'dialogue', lessonId: null }, 0)).toBe(1)
    expect(questDelta('review', { ...r, source: 'review', lessonId: null }, 0)).toBe(6)
    expect(questDelta('review', { ...r, source: undefined, lessonId: null }, 0)).toBe(6) // default source = review
    expect(questDelta('perfect', r, 0)).toBe(0)
    expect(questDelta('perfect', result(), 0)).toBe(1)
    expect(questDelta('correct', r, 0)).toBe(5)
  })
  it('accumulates within a day, keeps max for runs, resets on a new day', () => {
    const day = '2026-09-27'
    const qs = questsForDay(day)
    let s = applySessionToQuests(null, day, result({ pattern: Array(12).fill(true) }), 30)
    s = applySessionToQuests(s, day, result({ pattern: [true, false] }), 11)
    const views = questViews(s, day)
    for (const v of views) {
      if (v.kind === 'xp') expect(s.progress[v.id]).toBe(41)
      if (v.kind === 'run') expect(s.progress[v.id]).toBe(12)
      expect(v.value).toBeLessThanOrEqual(v.target)
    }
    expect(views.map((v) => v.id)).toEqual(qs.map((q) => q.id))
    const tomorrow = applySessionToQuests(s, addDays(day, 1), result(), 5)
    expect(tomorrow.day).toBe(addDays(day, 1))
    expect(Object.values(tomorrow.progress).every((n) => n <= 5)).toBe(true)
  })
})

describe('streak freeze', () => {
  const today = '2026-09-27'
  it('matches the plain streak with no gaps', () => {
    const s = computeEffectiveStreak(xpDays(range(addDays(today, -4), 5)), today)
    expect(s).toMatchObject({ current: 5, best: 5, freezes: 0, activeToday: true, daysToNextFreeze: 2 })
  })
  it('keeps the streak alive today before practising', () => {
    const s = computeEffectiveStreak(xpDays(range(addDays(today, -3), 3)), today)
    expect(s.current).toBe(3)
    expect(s.activeToday).toBe(false)
  })
  it('earns one freeze per 7 days (max 2) and uses it for a missed day', () => {
    const start = addDays(today, -9)
    const active = range(start, 8) // 8 active days, then yesterday missed, today not yet
    const s = computeEffectiveStreak(xpDays(active), today)
    expect(s.frozenDays).toEqual([addDays(today, -1)])
    expect(s.freezes).toBe(0)
    expect(s.current).toBe(8)
    // Without a freeze (streak < 7) a miss breaks it
    const s2 = computeEffectiveStreak(xpDays(range(addDays(today, -5), 4)), today)
    expect(s2.current).toBe(0)
    expect(s2.best).toBe(4)
  })
  it('caps at 2 freezes and covers a 2-day gap', () => {
    const active = range(addDays(today, -32), 30) // 30 days → 4 earned, capped at 2; then 2 missed days
    const s = computeEffectiveStreak(xpDays(active), today)
    expect(s.frozenDays).toHaveLength(2)
    expect(s.current).toBe(30)
    const s3 = computeEffectiveStreak(xpDays(range(addDays(today, -33), 30)), today) // 3 missed days
    expect(s3.current).toBe(0)
  })
  it('does not apply freezes before sinceDay', () => {
    const active = range(addDays(today, -9), 8)
    expect(computeEffectiveStreak(xpDays(active), today, today).current).toBe(0)
  })
  it('ignores zero-xp and future days; empty history', () => {
    expect(computeEffectiveStreak({}, today).current).toBe(0)
    expect(computeEffectiveStreak({ [today]: 0, [addDays(today, 1)]: 5 }, today).current).toBe(0)
  })
  it('finds milestones', () => {
    expect(milestoneAtOrBelow(2)).toBe(0)
    expect(milestoneAtOrBelow(8)).toBe(7)
    expect(milestoneAtOrBelow(100)).toBe(100)
  })
})

describe('achievements', () => {
  it('has 25–35 unique badges with all tiers', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(25)
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(35)
    expect(new Set(ACHIEVEMENTS.map((x) => x.id)).size).toBe(ACHIEVEMENTS.length)
    expect(new Set(ACHIEVEMENTS.map((x) => x.tier))).toEqual(new Set(['bronze', 'silver', 'gold']))
  })
  it('detects newly earned and shows progress', () => {
    const ctx = { ...ctx0(), lessonsCompleted: 4, bestStreak: 7 }
    const earned = newlyEarned(ctx, {})
    expect(earned).toContain('first-lesson')
    expect(earned).toContain('streak-7')
    expect(earned).not.toContain('lessons-10')
    expect(newlyEarned(ctx, { 'first-lesson': '2026-01-01' })).not.toContain('first-lesson')
    const v = achievementViews(ctx, { 'first-lesson': '2026-01-01' }).find((x) => x.id === 'lessons-10')!
    expect(v).toMatchObject({ value: 4, unlocked: false })
    expect(v.ratio).toBeCloseTo(0.4)
  })
  it('counts tones from pinyin', () => {
    expect([...tonesIn('nǐ hǎo')]).toEqual([3])
    expect([...tonesIn('xiè xie')]).toEqual([4])
    expect(tonesIn('lǜ chá')).toEqual(new Set([4, 2]))
    const words = ['mā', 'fēi', 'chī', 'hē', 'shū', 'má', 'chá', 'lái', 'nián', 'rén', 'hǎo']
    expect(countTonesMastered(words)).toBe(2)
    expect(countTonesMastered([], 5)).toBe(0)
  })
})

describe('state reducers', () => {
  const day = '2026-09-27'
  const at = (h: number) => new Date(2026, 8, 27, h)
  it('tracks stats from sessions', () => {
    let d = initialDoc(day)
    d = reduceSession(d, result(), 18, at(23), day)
    d = reduceSession(d, { ...result({ pattern: Array(22).fill(true) }), source: 'game', lessonId: null }, 30, at(6), day)
    d = reduceSession(d, { ...result(), source: 'dialogue', lessonId: null }, 10, at(12), day)
    expect(d.stats).toMatchObject({ sessions: 3, perfectSessions: 3, games: 1, bestGameCorrect: 22, dialogues: 1, nightOwl: 1, earlyBird: 1, bestRun: 22 })
    expect(d.quests?.day).toBe(day)
  })
  it('claims the chest once, only when all quests are done', () => {
    let d: MotivationDoc = initialDoc(day)
    expect(claimChest(d, day)).toBe(d)
    const progress = Object.fromEntries(questsForDay(day).map((q) => [q.id, q.target]))
    d = { ...d, quests: { day, progress, chestClaimed: false, chestNotified: false } }
    const c = claimChest(d, day)
    expect(c.bonusXp).toBe(CHEST_XP)
    expect(c.stats.chests).toBe(1)
    expect(claimChest(c, day)).toBe(c)
    // An unclaimed full chest is auto-claimed at day rollover.
    const rolled = rollQuests(d, addDays(day, 1))
    expect(rolled.bonusXp).toBe(CHEST_XP)
    expect(rolled.quests).toBeNull()
  })
  it('first evaluation is silent, later ones celebrate once', () => {
    let d = initialDoc(day)
    const input = { ctx: { ...ctx0(), lessonsCompleted: 1, levelXp: 60, level: 2, bestStreak: 3 }, streak: 3, knownWords: 5, today: day }
    let r = evaluate(d, input)
    expect(r.celebrations).toEqual([])
    expect(r.doc.unlocked['first-lesson']).toBe(day)
    expect(r.doc.seen).toEqual({ level: 2, streakMilestone: 3 })
    d = r.doc
    r = evaluate(d, input)
    expect(r.celebrations).toEqual([])
    expect(r.doc).toBe(d)
    r = evaluate(d, { ...input, ctx: { ...input.ctx, levelXp: 150, level: 3, lessonsCompleted: 10, bestStreak: 7 }, streak: 7 })
    expect(r.celebrations).toEqual([{ kind: 'level', level: 3 }, { kind: 'achievement', id: 'lessons-10' }, { kind: 'streak', days: 7, badgeId: 'streak-7' }])
    // Streak breaks → milestones reset and can be celebrated again.
    r = evaluate(r.doc, { ...input, streak: 0 })
    expect(r.doc.seen.streakMilestone).toBe(0)
    r = evaluate(r.doc, { ...input, streak: 3 })
    expect(r.celebrations).toEqual([{ kind: 'streak', days: 3 }])
  })
  it('announces a ready chest once', () => {
    const progress = Object.fromEntries(questsForDay(day).map((q) => [q.id, q.target]))
    let d: MotivationDoc = { ...initialDoc(day), seen: { level: 1, streakMilestone: 0 }, quests: { day, progress, chestClaimed: false, chestNotified: false } }
    const input = { ctx: ctx0(), streak: 0, knownWords: 0, today: day }
    const r = evaluate(d, input)
    expect(r.celebrations).toEqual([{ kind: 'chest' }])
    d = r.doc
    expect(evaluate(d, input).celebrations).toEqual([])
  })
})

describe('weekly recap', () => {
  it('computes monday-based week, last week and best day', () => {
    expect(weekStart('2026-09-27')).toBe('2026-09-21') // Sunday → Monday before
    expect(weekStart('2026-09-21')).toBe('2026-09-21')
    const xp = { '2026-09-14': 10, '2026-09-20': 15, '2026-09-21': 20, '2026-09-23': 45, '2026-09-27': 30 }
    const r = weeklyRecap(xp, { '2026-09-19': 40, '2026-09-25': 50 }, 58, '2026-09-27')
    expect(r).toMatchObject({ thisWeekXp: 95, lastWeekXp: 25, activeDays: 3, wordsThisWeek: 18, bestDay: { day: '2026-09-23', xp: 45 } })
    expect(r.days).toHaveLength(7)
    expect(weeklyRecap({}, {}, 10, '2026-09-27')).toMatchObject({ thisWeekXp: 0, bestDay: null, wordsThisWeek: 0 })
  })
})

describe('storage', () => {
  const mem = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
  }
  it('parses safely', () => {
    expect(parseDoc(null, '2026-09-27')).toBeNull()
    expect(parseDoc('{bad', '2026-09-27')).toBeNull()
    expect(parseDoc('{"version":2}', '2026-09-27')).toBeNull()
    const d = parseDoc(JSON.stringify({ version: 1, bonusXp: -3, stats: { games: 'x', chests: 2 }, unlocked: { a: '2026-01-01', b: 7 }, quests: { day: 'nope' } }), '2026-09-27')!
    expect(d.bonusXp).toBe(0)
    expect(d.stats.games).toBe(0)
    expect(d.stats.chests).toBe(2)
    expect(d.unlocked).toEqual({ a: '2026-01-01' })
    expect(d.quests).toBeNull()
    expect(d.sinceDay).toBe('2026-09-27')
  })
  it('persists through the store and survives throwing storage', () => {
    const s = mem()
    const store = createMotivationStore(s, () => new Date(2026, 8, 27, 12))
    store.update((d) => ({ ...d, bonusXp: 25 }))
    expect(JSON.parse(s.m.get(MOTIVATION_KEY)!).bonusXp).toBe(25)
    expect(createMotivationStore(s).getState().bonusXp).toBe(25)
    const broken = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => {} }
    const b = createMotivationStore(broken)
    b.update((d) => ({ ...d, bonusXp: 1 }))
    expect(b.getState().bonusXp).toBe(1)
  })
})
