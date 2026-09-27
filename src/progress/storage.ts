// Persistence: one versioned JSON document, safe parsing, migrations, and an
// observable store (used by ProgressProvider via useSyncExternalStore).
import type { ItemRef, LessonResult, Settings, SrsCard } from '../types'
import type { ProgressState } from './index'
import { applySession, clampSettings, DEFAULT_SETTINGS, initialState } from './logic'
import { localDay } from './dates'

export const STORAGE_KEY = 'nihao/v1'
export const CURRENT_VERSION = 1

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

// ─── Parsing / migration ─────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const isDay = (v: unknown): v is string => typeof v === 'string' && DAY_RE.test(v)

/**
 * Migration hook: upgrades older document shapes to the current version.
 * Add `case` branches here when ProgressState.version is bumped.
 */
export function migrate(raw: Record<string, unknown>): Record<string, unknown> | null {
  const version = raw.version
  switch (version) {
    case 1:
      return raw
    default:
      return null // unknown/newer version → caller falls back to defaults
  }
}

function sanitizeCard(v: unknown): SrsCard | null {
  if (!isObj(v) || !isObj(v.item)) return null
  const kind = v.item.kind
  const id = v.item.id
  if ((kind !== 'word' && kind !== 'sentence') || typeof id !== 'string') return null
  const item: ItemRef = { kind, id }
  return {
    item,
    ease: Math.max(1.3, num(v.ease, 2.5)),
    intervalDays: Math.max(0, num(v.intervalDays, 0)),
    due: isDay(v.due) ? v.due : localDay(),
    reps: Math.max(0, num(v.reps, 0)),
    lapses: Math.max(0, num(v.lapses, 0)),
  }
}

function sanitizeSettings(v: unknown): Settings {
  const s = isObj(v) ? v : {}
  const bool = (k: keyof Settings) => (typeof s[k] === 'boolean' ? (s[k] as boolean) : (DEFAULT_SETTINGS[k] as boolean))
  return clampSettings({
    speechRate: num(s.speechRate, DEFAULT_SETTINGS.speechRate),
    showHanzi: bool('showHanzi'),
    toneColors: bool('toneColors'),
    soundEffects: bool('soundEffects'),
    speakingExercises: bool('speakingExercises'),
    dailyGoalXp: num(s.dailyGoalXp, DEFAULT_SETTINGS.dailyGoalXp),
  })
}

/** Coerces an already-migrated document into a valid ProgressState (drops bad entries). */
export function sanitize(doc: Record<string, unknown>): ProgressState {
  const base = initialState()

  const completedLessons: ProgressState['completedLessons'] = {}
  if (isObj(doc.completedLessons)) {
    for (const [id, v] of Object.entries(doc.completedLessons)) {
      if (!isObj(v)) continue
      completedLessons[id] = {
        bestAccuracy: Math.min(1, Math.max(0, num(v.bestAccuracy, 0))),
        completions: Math.max(1, num(v.completions, 1)),
        lastAt: typeof v.lastAt === 'string' ? v.lastAt : new Date(0).toISOString(),
      }
    }
  }

  const xpByDay: Record<string, number> = {}
  if (isObj(doc.xpByDay)) {
    for (const [day, xp] of Object.entries(doc.xpByDay)) if (isDay(day)) xpByDay[day] = Math.max(0, num(xp, 0))
  }

  const cards: Record<string, SrsCard> = {}
  if (isObj(doc.cards)) {
    for (const v of Object.values(doc.cards)) {
      const c = sanitizeCard(v)
      if (c) cards[`${c.item.kind}:${c.item.id}`] = c
    }
  }

  const st = isObj(doc.streak) ? doc.streak : {}
  const current = Math.max(0, num(st.current, 0))
  const streak = {
    current,
    best: Math.max(current, num(st.best, 0)),
    lastDay: isDay(st.lastDay) ? st.lastDay : null,
  }

  return {
    ...base,
    completedLessons,
    xpTotal: Math.max(0, num(doc.xpTotal, 0)),
    xpByDay,
    streak,
    cards,
    settings: sanitizeSettings(doc.settings),
  }
}

/** Parses a stored/imported JSON string. Returns null if unusable. */
export function parseState(json: string | null | undefined): ProgressState | null {
  if (!json) return null
  try {
    const raw: unknown = JSON.parse(json)
    if (!isObj(raw)) return null
    const migrated = migrate(raw)
    return migrated ? sanitize(migrated) : null
  } catch {
    return null
  }
}

// ─── Storage access (never throws) ───────────────────────────

export function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

function readStorage(storage: StorageLike | null): string | null {
  try {
    return storage?.getItem(STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

function writeStorage(storage: StorageLike | null, state: ProgressState): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // quota exceeded / private mode — keep working in memory
  }
}

// ─── Store ───────────────────────────────────────────────────

export interface ProgressStore {
  getState(): ProgressState
  setState(next: ProgressState): void
  subscribe(listener: () => void): () => void
  /** Re-reads storage (e.g. after another tab wrote). */
  reload(): void
  finishSession(result: LessonResult): { xpEarned: number; streakExtended: boolean }
  updateSettings(patch: Partial<Settings>): void
  resetAll(): void
  exportJson(): string
  importJson(json: string): boolean
  now(): Date
}

export function createProgressStore(storage: StorageLike | null, now: () => Date = () => new Date()): ProgressStore {
  let state = parseState(readStorage(storage)) ?? initialState()
  const listeners = new Set<() => void>()

  const setState = (next: ProgressState) => {
    state = next
    writeStorage(storage, state)
    listeners.forEach((l) => l())
  }

  return {
    getState: () => state,
    setState,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    reload() {
      const loaded = parseState(readStorage(storage))
      if (loaded) {
        state = loaded
        listeners.forEach((l) => l())
      }
    },
    finishSession(result) {
      const t = now()
      const r = applySession(state, result, t, localDay(t))
      setState(r.state)
      return { xpEarned: r.xpEarned, streakExtended: r.streakExtended }
    },
    updateSettings(patch) {
      setState({ ...state, settings: clampSettings({ ...state.settings, ...patch }) })
    },
    resetAll() {
      setState(initialState())
    },
    exportJson: () => JSON.stringify(state),
    importJson(json) {
      const parsed = parseState(json)
      if (!parsed) return false
      setState(parsed)
      return true
    },
    now,
  }
}

let singleton: ProgressStore | null = null

/** App-wide store backed by localStorage (lazy, so tests/SSR don't touch it). */
export function getProgressStore(): ProgressStore {
  singleton ??= createProgressStore(browserStorage())
  return singleton
}
