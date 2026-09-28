// React layer: MotivationProvider, useMotivation(), useEffectiveStreak().
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { course } from '../data/course'
import { localDay, onSessionFinished, useProgress } from '../progress'
import type { ProgressApi } from '../progress'
import type { AchievementCtx, AchievementView } from './achievements'
import { achievementViews, countTonesMastered } from './achievements'
import type { LevelInfo } from './levels'
import { levelForXp } from './levels'
import type { QuestView } from './quests'
import { CHEST_XP, questViews } from './quests'
import type { Celebration, MotivationDoc, MotivationStats, WeeklyRecap } from './state'
import { chestReady, claimChest as claimChestPure, evaluate, reduceSession, rollQuests, weeklyRecap } from './state'
import type { MotivationStore } from './storage'
import { browserStorage, createMotivationStore, MOTIVATION_KEY } from './storage'
import type { EffectiveStreak } from './streak'
import { computeEffectiveStreak } from './streak'

export interface MotivationApi {
  today: string
  /** Level derived from progress.xpTotal + bonusXp. */
  level: LevelInfo
  levelXp: number
  /** XP from quest chests (counts toward level only, not daily goal/streak). */
  bonusXp: number
  quests: QuestView[]
  questsDone: number
  chestReady: boolean
  chestClaimed: boolean
  /** Opens today's chest; returns XP awarded (0 if not ready). */
  claimChest(): number
  achievements: AchievementView[]
  unlockedCount: number
  streak: EffectiveStreak
  recap: WeeklyRecap
  stats: MotivationStats
  /** Pending celebrations (head = next to show). Used by <MotivationOverlays/>. */
  queue: Celebration[]
  dismiss(count?: number): void
  /** Debug/test helper: push a celebration. */
  enqueue(c: Celebration): void
  reset(): void
}

const Ctx = createContext<MotivationApi | null>(null)

let singleton: MotivationStore | null = null
function getStore(): MotivationStore {
  singleton ??= createMotivationStore(browserStorage())
  return singleton
}

/** Calendar day that updates at midnight / when the app comes back to the foreground. */
function useToday(now: () => Date): string {
  const [today, setToday] = useState(() => localDay(now()))
  useEffect(() => {
    const tick = () => setToday(localDay(now()))
    const id = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [now])
  return today
}

function buildCtx(p: ProgressApi, doc: MotivationDoc, streak: EffectiveStreak, levelXp: number): AchievementCtx {
  const done = p.state.completedLessons
  const unitsCompleted = course.units.filter((u) => u.lessons.length > 0 && u.lessons.every((l) => done[l.id])).length
  const known = p.knownWordIds()
  const mastered: string[] = []
  for (const id of known) {
    const w = course.words[id]
    if (w && p.mastery({ kind: 'word', id }) >= 4) mastered.push(w.pinyin)
  }
  const perfectLessons = Object.values(done).filter((l) => l.bestAccuracy >= 1).length
  const s = doc.stats
  return {
    lessonsCompleted: Object.keys(done).length,
    unitsCompleted,
    wordsKnown: known.length,
    levelXp,
    level: levelForXp(levelXp).level,
    bestStreak: Math.max(streak.best, p.state.streak.best),
    perfectSessions: Math.max(s.perfectSessions, perfectLessons),
    sessions: s.sessions,
    dialogues: s.dialogues,
    games: s.games,
    bestGameCorrect: s.bestGameCorrect,
    labSessions: s.labSessions,
    reviews: s.reviews,
    nightOwl: s.nightOwl,
    earlyBird: s.earlyBird,
    bestRun: s.bestRun,
    chests: s.chests,
    tonesMastered: countTonesMastered(mastered),
    freezesUsed: streak.frozenDays.length,
  }
}

/** Wrap inside <ProgressProvider>; listens to onSessionFinished and owns its own storage. */
export function MotivationProvider({ children, store }: { children: ReactNode; store?: MotivationStore }) {
  const s = store ?? getStore()
  const doc = useSyncExternalStore(s.subscribe, s.getState, s.getState)
  const p = useProgress()
  const today = useToday(s.now)
  const [queue, setQueue] = useState<Celebration[]>([])

  // Sessions → stats + quest progress.
  useEffect(() => onSessionFinished((e) => {
    const at = new Date(e.at)
    s.update((d) => reduceSession(d, e.result, e.xpEarned, at, localDay(at)))
  }), [s])

  // Other tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === MOTIVATION_KEY) s.reload() }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [s])

  // New day: roll quests (auto-claims a forgotten full chest).
  useEffect(() => { s.update((d) => rollQuests(d, today)) }, [s, today])

  // Progress was reset ("Återställ allt") → reset motivation too.
  const ps = p.state
  const progressEmpty = ps.xpTotal === 0 && Object.keys(ps.xpByDay).length === 0 && Object.keys(ps.completedLessons).length === 0
  useEffect(() => {
    const d = s.getState()
    if (progressEmpty && (d.bonusXp > 0 || d.stats.sessions > 0 || Object.keys(d.unlocked).length > 0)) {
      s.reset()
      setQueue([])
    }
  }, [s, progressEmpty])

  const streak = useMemo(() => computeEffectiveStreak(ps.xpByDay, today, doc.sinceDay), [ps.xpByDay, today, doc.sinceDay])
  const levelXp = ps.xpTotal + doc.bonusXp
  const ctx = useMemo(() => buildCtx(p, doc, streak, levelXp), [p, doc, streak, levelXp])
  const knownWords = ctx.wordsKnown

  // Detect level-ups, badges, milestones, chest-ready → queue celebrations.
  useEffect(() => {
    const r = evaluate(s.getState(), { ctx, streak: streak.current, knownWords, today })
    if (r.doc !== s.getState()) s.update(() => r.doc)
    if (r.celebrations.length) setQueue((q) => [...q, ...r.celebrations])
  }, [s, ctx, streak, knownWords, today])

  const claimChest = useCallback(() => {
    let got = 0
    s.update((d) => {
      const n = claimChestPure(d, localDay(s.now()))
      got = n === d ? 0 : CHEST_XP
      return n
    })
    if (got) setQueue((q) => q.filter((c) => c.kind !== 'chest'))
    return got
  }, [s])
  const dismiss = useCallback((count = 1) => setQueue((q) => q.slice(count)), [])
  const enqueue = useCallback((c: Celebration) => setQueue((q) => [...q, c]), [])
  const reset = useCallback(() => { s.reset(); setQueue([]) }, [s])

  const api = useMemo<MotivationApi>(() => {
    const quests = questViews(doc.quests, today)
    const achievements = achievementViews(ctx, doc.unlocked)
    return {
      today,
      level: levelForXp(levelXp),
      levelXp,
      bonusXp: doc.bonusXp,
      quests,
      questsDone: quests.filter((q) => q.done).length,
      chestReady: chestReady(doc, today),
      chestClaimed: !!doc.quests && doc.quests.day === today && doc.quests.chestClaimed,
      claimChest,
      achievements,
      unlockedCount: achievements.filter((a) => a.unlocked).length,
      streak,
      recap: weeklyRecap(ps.xpByDay, doc.knownByDay, knownWords, today),
      stats: doc.stats,
      queue,
      dismiss,
      enqueue,
      reset,
    }
  }, [doc, today, ctx, levelXp, streak, ps.xpByDay, knownWords, queue, claimChest, dismiss, enqueue, reset])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

/** Levels, quests, achievements, streak, recap. Must be inside <MotivationProvider>. */
export function useMotivation(): MotivationApi {
  const api = useContext(Ctx)
  if (!api) throw new Error('useMotivation() must be used inside <MotivationProvider> (inside <ProgressProvider>).')
  return api
}

/**
 * Streak to DISPLAY everywhere (flame in the top bar, profile stats), including
 * "Streakskydd" freezes. Use `.current` instead of progress `displayStreak()`.
 * Works outside MotivationProvider too (then freezes are simulated over all history).
 */
export function useEffectiveStreak(): EffectiveStreak {
  const api = useContext(Ctx)
  const p = useProgress()
  const fallback = useMemo(
    () => (api ? null : computeEffectiveStreak(p.state.xpByDay, localDay(), null)),
    [api, p.state.xpByDay],
  )
  return api ? api.streak : fallback!
}
