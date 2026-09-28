// Pure progress logic: SRS, XP, streak, unlocking, queries. No I/O.
import type { Course, ItemRef, LessonResult, Settings } from '../types'
import type { LessonStatus, ProgressState } from './index'
import { addDays, daysBetween } from './dates'
import { newCard, reviewCard, memoryOf, type ProgressCard } from './fsrs'

// ─── Defaults ────────────────────────────────────────────────

export const DEFAULT_SETTINGS: Settings = {
  speechRate: 0.85,
  showHanzi: false,
  toneColors: true,
  soundEffects: true,
  speakingExercises: true,
  dailyGoalXp: 30,
}

export function initialState(): ProgressState {
  return {
    version: 2,
    completedLessons: {},
    xpTotal: 0,
    xpByDay: {},
    streak: { current: 0, best: 0, lastDay: null },
    cards: {},
    settings: { ...DEFAULT_SETTINGS },
  }
}

export function clampSettings(s: Settings): Settings {
  const rate = Number.isFinite(s.speechRate) ? s.speechRate : DEFAULT_SETTINGS.speechRate
  const goal = Number.isFinite(s.dailyGoalXp) ? Math.round(s.dailyGoalXp) : DEFAULT_SETTINGS.dailyGoalXp
  return { ...s, speechRate: Math.min(1.2, Math.max(0.5, rate)), dailyGoalXp: Math.max(1, goal) }
}

// ─── SRS (FSRS-5, see ./fsrs.ts) ─────────────────────────────

export { newCard, reviewCard, masteryOfCard, cardRetrievability, memoryOf } from './fsrs'
export type { ProgressCard } from './fsrs'
/** v1 SM-2 constants, kept for compatibility (ease is now derived from FSRS difficulty). */
export const INITIAL_EASE = 2.5
export const MIN_EASE = 1.3
export const MAX_EASE = 3.0

export const cardKey = (item: ItemRef) => `${item.kind}:${item.id}`

/** First attempt per item decides quality. Returns items in first-seen order. */
export function firstAttempts(result: LessonResult): { item: ItemRef; correct: boolean }[] {
  const seen = new Map<string, { item: ItemRef; correct: boolean }>()
  for (const r of result.items) {
    const k = cardKey(r.item)
    if (!seen.has(k)) seen.set(k, { item: r.item, correct: r.correct })
  }
  return [...seen.values()]
}

// ─── XP ──────────────────────────────────────────────────────

export const XP_BASE = 10
export const XP_PER_CORRECT = 1
export const XP_PERFECT_BONUS = 5

/** 10 base + 1 per item answered correctly on first attempt + 5 if no mistakes. Same for reviews. */
export function sessionXp(result: LessonResult): number {
  const firstCorrect = firstAttempts(result).filter((a) => a.correct).length
  const perfect = result.mistakes === 0 && result.total > 0 && result.items.every((r) => r.correct)
  return XP_BASE + firstCorrect * XP_PER_CORRECT + (perfect ? XP_PERFECT_BONUS : 0)
}

export function accuracy(result: LessonResult): number {
  if (result.total <= 0) return 1
  return Math.min(1, Math.max(0, result.correct / result.total))
}

// ─── Streak ──────────────────────────────────────────────────

type Streak = ProgressState['streak']

export function nextStreak(streak: Streak, today: string): { streak: Streak; extended: boolean } {
  if (streak.lastDay === today) return { streak, extended: false }
  const consecutive = streak.lastDay !== null && daysBetween(streak.lastDay, today) === 1
  const current = consecutive ? streak.current + 1 : 1
  return { streak: { current, best: Math.max(streak.best, current), lastDay: today }, extended: true }
}

/** Streak to display today: 0 if a day was missed (the stored value only updates on the next session). */
export function displayStreak(state: ProgressState, today: string): number {
  const { lastDay, current } = state.streak
  if (lastDay === null) return 0
  return daysBetween(lastDay, today) <= 1 ? current : 0
}

// ─── Session ─────────────────────────────────────────────────

export function applySession(
  state: ProgressState,
  result: LessonResult,
  now: Date,
  today: string,
): { state: ProgressState; xpEarned: number; streakExtended: boolean } {
  const xpEarned = sessionXp(result)

  const cards = { ...state.cards }
  for (const a of firstAttempts(result)) {
    const k = cardKey(a.item)
    cards[k] = reviewCard(cards[k] ?? newCard(a.item, today), a.correct, today)
  }

  let completedLessons = state.completedLessons
  if (result.lessonId !== null) {
    const prev = completedLessons[result.lessonId]
    completedLessons = {
      ...completedLessons,
      [result.lessonId]: {
        bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, accuracy(result)),
        completions: (prev?.completions ?? 0) + 1,
        lastAt: now.toISOString(),
      },
    }
  }

  const { streak, extended } = nextStreak(state.streak, today)
  return {
    state: {
      ...state,
      cards,
      completedLessons,
      streak,
      xpTotal: state.xpTotal + xpEarned,
      xpByDay: { ...state.xpByDay, [today]: (state.xpByDay[today] ?? 0) + xpEarned },
    },
    xpEarned,
    streakExtended: extended,
  }
}

// ─── Queries ─────────────────────────────────────────────────

export function lessonOrder(course: Course): string[] {
  return course.units.flatMap((u) => u.lessons.map((l) => l.id))
}

/** Linear unlocking through course order. Empty course → 'available'. */
export function lessonStatus(state: ProgressState, course: Course, lessonId: string): LessonStatus {
  if (state.completedLessons[lessonId]) return 'completed'
  const order = lessonOrder(course)
  if (order.length === 0) return 'available'
  const i = order.indexOf(lessonId)
  if (i < 0) return 'locked'
  if (i === 0 || state.completedLessons[order[i - 1]]) return 'available'
  return 'locked'
}

/** Cards due on/before today, most overdue first, then lowest ease (= highest FSRS difficulty), then lowest stability. */
export function dueItems(state: ProgressState, today: string, limit?: number): ItemRef[] {
  const due = Object.values(state.cards)
    .filter((c) => c.due <= today)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.ease - b.ease || memoryOf(a).stability - memoryOf(b).stability))
  return take(due, limit).map((c) => c.item)
}

/** Cards with at least one lapse, most lapses first, then lowest ease. */
export function weakItems(state: ProgressState, limit?: number): ItemRef[] {
  const weak = Object.values(state.cards)
    .filter((c) => c.lapses > 0)
    .sort((a, b) => b.lapses - a.lapses || a.ease - b.ease)
  return take(weak, limit).map((c) => c.item)
}

export function knownWordIds(state: ProgressState): string[] {
  return Object.values(state.cards)
    .filter((c) => c.item.kind === 'word')
    .map((c) => c.item.id)
}

export function todayXp(state: ProgressState, today: string): number {
  return state.xpByDay[today] ?? 0
}

/** XP for the last `days` days ending today, oldest first (for charts). */
export function xpHistory(state: ProgressState, today: string, days = 7): { day: string; xp: number }[] {
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - (days - 1))
    return { day, xp: state.xpByDay[day] ?? 0 }
  })
}

// ─── Placement ───────────────────────────────────────────────

/**
 * Placement skip: marks every lesson before `lessonId` completed (existing
 * completions are kept) and seeds their new words as known-but-fragile cards
 * (S = 2 d, D = 5, 1 rep). Due dates are staggered over the next 1–4 days so
 * the verification reviews don't arrive as one flood. Existing cards are not
 * touched. No XP, no streak change. Unknown lessonId → state unchanged.
 */
export function skipToLesson(state: ProgressState, course: Course, lessonId: string, now: Date, today: string): ProgressState {
  const order = course.units.flatMap((u) => u.lessons)
  const idx = order.findIndex((l) => l.id === lessonId)
  if (idx <= 0) return state
  const completedLessons = { ...state.completedLessons }
  const cards = { ...state.cards }
  let n = 0
  for (const l of order.slice(0, idx)) {
    completedLessons[l.id] ??= { bestAccuracy: 0.8, completions: 1, lastAt: now.toISOString() }
    for (const id of l.newWords) {
      const item: ItemRef = { kind: 'word', id }
      const k = cardKey(item)
      if (cards[k] || !course.words[id]) continue
      const interval = 1 + (n++ % 4)
      const card: ProgressCard = {
        ...newCard(item, today),
        reps: 1, stability: 2, difficulty: 5, ease: 2.5, lastReview: today,
        intervalDays: interval, due: addDays(today, interval),
      }
      cards[k] = card
    }
  }
  return { ...state, completedLessons, cards }
}

function take<T>(arr: T[], limit?: number): T[] {
  return limit === undefined ? arr : arr.slice(0, Math.max(0, limit))
}
