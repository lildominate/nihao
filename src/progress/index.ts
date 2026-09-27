// OWNER: Progress agent. Public API — signatures are the contract.
import { createContext, createElement, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { ItemRef, LessonResult, Settings, SrsCard } from '../types'
import { course } from '../data/course'
import * as logic from './logic'
import { localDay } from './dates'
import { getProgressStore, STORAGE_KEY } from './storage'
import type { ProgressStore } from './storage'

export interface ProgressState {
  version: 1
  completedLessons: Record<string, { bestAccuracy: number; completions: number; lastAt: string }>
  xpTotal: number
  xpByDay: Record<string, number>        // "YYYY-MM-DD" → xp
  streak: { current: number; best: number; lastDay: string | null }
  cards: Record<string, SrsCard>          // key = `${kind}:${id}`
  settings: Settings
}

export type LessonStatus = 'locked' | 'available' | 'completed'

export interface ProgressApi {
  state: ProgressState
  /** Records a finished lesson/review; returns xp earned. */
  finishSession(result: LessonResult): { xpEarned: number; streakExtended: boolean }
  lessonStatus(lessonId: string): LessonStatus
  /** Items due for review today, most overdue first. */
  dueItems(limit?: number): ItemRef[]
  /** Items the learner struggles with most (lapses / low ease). */
  weakItems(limit?: number): ItemRef[]
  knownWordIds(): string[]
  todayXp(): number
  updateSettings(patch: Partial<Settings>): void
  resetAll(): void
}

// Extra exports (pure helpers usable outside React).
export { DEFAULT_SETTINGS, displayStreak, xpHistory, sessionXp, cardKey } from './logic'
export { localDay, addDays } from './dates'
export { STORAGE_KEY } from './storage'

/** Serialized progress backup (JSON string). */
export function exportProgress(): string {
  return getProgressStore().exportJson()
}

/** Restores a backup; returns false (and changes nothing) if the JSON is invalid. Updates the live UI. */
export function importProgress(json: string): boolean {
  return getProgressStore().importJson(json)
}

export function buildApi(store: ProgressStore, state: ProgressState, c = course): ProgressApi {
  const today = () => localDay(store.now())
  return {
    state,
    finishSession: (result) => store.finishSession(result),
    lessonStatus: (id) => logic.lessonStatus(state, c, id),
    dueItems: (limit) => logic.dueItems(state, today(), limit),
    weakItems: (limit) => logic.weakItems(state, limit),
    knownWordIds: () => logic.knownWordIds(state),
    todayXp: () => logic.todayXp(state, today()),
    updateSettings: (patch) => store.updateSettings(patch),
    resetAll: () => store.resetAll(),
  }
}

const ProgressContext = createContext<ProgressApi | null>(null)

export function useProgress(): ProgressApi {
  const api = useContext(ProgressContext)
  if (!api) throw new Error('useProgress() must be used inside <ProgressProvider>. Wrap the app in <ProgressProvider>.')
  return api
}

/** `store` is optional (tests); defaults to the app-wide localStorage-backed store. */
export function ProgressProvider({ children, store }: { children: ReactNode; store?: ProgressStore }) {
  const s = store ?? getProgressStore()
  const state = useSyncExternalStore(s.subscribe, s.getState, s.getState)

  // Keep multiple open tabs in sync.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) s.reload()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [s])

  const api = useMemo(() => buildApi(s, state), [s, state])
  return createElement(ProgressContext.Provider, { value: api }, children)
}
