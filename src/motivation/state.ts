// Pure motivation state: the persisted document, reducers and celebration detection.
//
// BONUS XP: completing all 3 daily quests gives a chest worth CHEST_XP. That XP is
// stored here as `bonusXp` (NOT written into progress, no fake sessions). It counts
// toward the LEVEL only (levelXp = progress.xpTotal + bonusXp) – not toward the
// daily XP goal, xpByDay or the streak.
import type { LessonResult } from '../types'
import { addDays } from '../progress/dates'
import type { AchievementCtx } from './achievements'
import { ACHIEVEMENT_BY_ID, newlyEarned } from './achievements'
import { levelForXp } from './levels'
import type { QuestDayState } from './quests'
import { allQuestsDone, applySessionToQuests, CHEST_XP, longestRun, sessionSource } from './quests'
import { milestoneAtOrBelow } from './streak'

export interface MotivationStats {
  sessions: number
  perfectSessions: number
  dialogues: number
  games: number
  bestGameCorrect: number
  labSessions: number
  reviews: number
  nightOwl: number
  earlyBird: number
  bestRun: number
  totalCorrect: number
  chests: number
}

export interface MotivationDoc {
  version: 1
  /** First day the motivation layer ran (freezes only apply from here). */
  sinceDay: string
  bonusXp: number
  quests: QuestDayState | null
  stats: MotivationStats
  /** achievement id → day unlocked */
  unlocked: Record<string, string>
  /** Last values already celebrated (so we celebrate each thing once). */
  seen: { level: number; streakMilestone: number }
  /** Known-word count snapshots per day (for the weekly recap). Pruned to ~5 weeks. */
  knownByDay: Record<string, number>
}

export const emptyStats = (): MotivationStats => ({
  sessions: 0, perfectSessions: 0, dialogues: 0, games: 0, bestGameCorrect: 0, labSessions: 0,
  reviews: 0, nightOwl: 0, earlyBird: 0, bestRun: 0, totalCorrect: 0, chests: 0,
})

export function initialDoc(today: string): MotivationDoc {
  return {
    version: 1,
    sinceDay: today,
    bonusXp: 0,
    quests: null,
    stats: emptyStats(),
    unlocked: {},
    seen: { level: 0, streakMilestone: -1 }, // sentinels: "not initialised yet" → first evaluate is silent
    knownByDay: {},
  }
}

// ─── Session → stats + quests ────────────────────────────────

/** Rolls quest state to `day`. An unclaimed full chest from an earlier day is auto-claimed (never lost). */
export function rollQuests(doc: MotivationDoc, day: string): MotivationDoc {
  const q = doc.quests
  if (!q || q.day === day) return doc
  if (!q.chestClaimed && allQuestsDone(q, q.day)) {
    return { ...doc, quests: null, bonusXp: doc.bonusXp + CHEST_XP, stats: { ...doc.stats, chests: doc.stats.chests + 1 } }
  }
  return { ...doc, quests: null }
}

export function reduceSession(doc: MotivationDoc, result: LessonResult, xpEarned: number, at: Date, day: string): MotivationDoc {
  const d = rollQuests(doc, day)
  const src = sessionSource(result)
  const hour = at.getHours()
  const correct = result.items.filter((r) => r.correct).length
  const perfect = result.total > 0 && result.mistakes === 0 && result.items.every((r) => r.correct)
  const s = d.stats
  const stats: MotivationStats = {
    ...s,
    sessions: s.sessions + 1,
    perfectSessions: s.perfectSessions + (perfect && src !== 'placement' ? 1 : 0),
    dialogues: s.dialogues + (src === 'dialogue' ? 1 : 0),
    games: s.games + (src === 'game' ? 1 : 0),
    bestGameCorrect: src === 'game' ? Math.max(s.bestGameCorrect, correct) : s.bestGameCorrect,
    labSessions: s.labSessions + (src === 'lab' ? 1 : 0),
    reviews: s.reviews + (src === 'review' ? 1 : 0),
    nightOwl: s.nightOwl + (hour >= 22 || hour < 4 ? 1 : 0),
    earlyBird: s.earlyBird + (hour >= 4 && hour < 7 ? 1 : 0),
    bestRun: Math.max(s.bestRun, longestRun(result)),
    totalCorrect: s.totalCorrect + correct,
  }
  return { ...d, stats, quests: applySessionToQuests(d.quests, day, result, xpEarned) }
}

/** Opens today's chest if all quests are done. Returns the same doc if not claimable. */
export function claimChest(doc: MotivationDoc, day: string): MotivationDoc {
  const q = doc.quests
  if (!q || q.day !== day || q.chestClaimed || !allQuestsDone(q, day)) return doc
  return {
    ...doc,
    bonusXp: doc.bonusXp + CHEST_XP,
    quests: { ...q, chestClaimed: true, chestNotified: true },
    stats: { ...doc.stats, chests: doc.stats.chests + 1 },
  }
}

export function chestReady(doc: MotivationDoc, day: string): boolean {
  const q = doc.quests
  return !!q && q.day === day && !q.chestClaimed && allQuestsDone(q, day)
}

// ─── Celebrations ────────────────────────────────────────────

export type Celebration =
  | { kind: 'level'; level: number }
  | { kind: 'achievement'; id: string }
  | { kind: 'streak'; days: number; badgeId?: string }
  | { kind: 'chest' }

export interface EvalInput {
  ctx: AchievementCtx
  /** Effective streak (with freezes). */
  streak: number
  knownWords: number
  today: string
}

/**
 * Records newly-met achievements/levels/milestones and returns what to celebrate.
 * The very first evaluation (sentinel `seen`) is silent: existing v1 progress is
 * credited without a flood of pop-ups.
 */
export function evaluate(doc: MotivationDoc, input: EvalInput): { doc: MotivationDoc; celebrations: Celebration[] } {
  const { ctx, streak, today } = input
  const firstRun = doc.seen.streakMilestone < 0
  const celebrations: Celebration[] = []
  let next = doc

  // Level
  const level = levelForXp(ctx.levelXp).level
  if (level !== doc.seen.level) {
    if (!firstRun && level > doc.seen.level) celebrations.push({ kind: 'level', level })
    next = { ...next, seen: { ...next.seen, level } }
  }

  // Achievements
  const earned = newlyEarned(ctx, doc.unlocked)
  if (earned.length) {
    const unlocked = { ...doc.unlocked }
    for (const id of earned) unlocked[id] = today
    next = { ...next, unlocked }
    if (!firstRun) {
      // Gold first, then silver, then bronze.
      const rank = { gold: 0, silver: 1, bronze: 2 }
      for (const id of [...earned].sort((x, y) => rank[ACHIEVEMENT_BY_ID[x].tier] - rank[ACHIEVEMENT_BY_ID[y].tier])) {
        celebrations.push({ kind: 'achievement', id })
      }
    }
  }

  // Streak milestones (reset when the streak breaks so they can be celebrated again).
  const m = milestoneAtOrBelow(streak)
  if (m !== next.seen.streakMilestone) {
    if (!firstRun && m > next.seen.streakMilestone) {
      // Merge with the matching streak badge (one pop-up instead of two).
      const badgeId = `streak-${m}`
      const i = celebrations.findIndex((c) => c.kind === 'achievement' && c.id === badgeId)
      if (i >= 0) celebrations.splice(i, 1)
      celebrations.push(i >= 0 ? { kind: 'streak', days: m, badgeId } : { kind: 'streak', days: m })
    }
    next = { ...next, seen: { ...next.seen, streakMilestone: m } }
  }

  // Chest ready (once per day)
  if (chestReady(next, today) && next.quests && !next.quests.chestNotified) {
    celebrations.push({ kind: 'chest' })
    next = { ...next, quests: { ...next.quests, chestNotified: true } }
  }

  // Word-count snapshot for the weekly recap.
  if (next.knownByDay[today] !== input.knownWords) {
    const knownByDay: Record<string, number> = {}
    const cutoff = addDays(today, -35)
    for (const [d, n] of Object.entries(next.knownByDay)) if (d >= cutoff) knownByDay[d] = n
    // First snapshot ever: record a baseline for yesterday so old words don't count as "this week".
    if (Object.keys(knownByDay).length === 0) knownByDay[addDays(today, -1)] = input.knownWords
    knownByDay[today] = input.knownWords
    next = { ...next, knownByDay }
  }

  return { doc: next, celebrations }
}

// ─── Weekly recap ────────────────────────────────────────────

/** Monday of the week containing `day` (Swedish weeks start on Monday). */
export function weekStart(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const dow = new Date(y, m - 1, d, 12).getDay() // 0 = Sunday
  return addDays(day, -((dow + 6) % 7))
}

export interface WeeklyRecap {
  weekStart: string
  days: { day: string; xp: number }[]   // Mon..Sun of this week
  thisWeekXp: number
  lastWeekXp: number
  activeDays: number
  wordsThisWeek: number
  bestDay: { day: string; xp: number } | null
}

export function weeklyRecap(xpByDay: Record<string, number>, knownByDay: Record<string, number>, knownNow: number, today: string): WeeklyRecap {
  const start = weekStart(today)
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i)
    return { day, xp: day <= today ? xpByDay[day] ?? 0 : 0 }
  })
  const lastStart = addDays(start, -7)
  let lastWeekXp = 0
  for (let i = 0; i < 7; i++) lastWeekXp += xpByDay[addDays(lastStart, i)] ?? 0
  const thisWeekXp = days.reduce((n, d) => n + d.xp, 0)
  let bestDay: WeeklyRecap['bestDay'] = null
  for (const d of days) if (d.xp > 0 && (!bestDay || d.xp > bestDay.xp)) bestDay = d

  // Words: now minus the latest snapshot before this week (else the earliest one we have).
  const snaps = Object.keys(knownByDay).sort()
  const before = snaps.filter((d) => d < start)
  const baseDay = before.length ? before[before.length - 1] : snaps[0]
  const base = baseDay !== undefined ? knownByDay[baseDay] : knownNow
  return {
    weekStart: start,
    days,
    thisWeekXp,
    lastWeekXp,
    activeDays: days.filter((d) => d.xp > 0).length,
    wordsThisWeek: Math.max(0, knownNow - base),
    bestDay,
  }
}
