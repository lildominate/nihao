// Persistence for the motivation layer: one versioned JSON doc under its own key.
// Never throws; bad/unknown data falls back to a fresh doc.
import type { MotivationDoc, MotivationStats } from './state'
import { emptyStats, initialDoc } from './state'
import type { QuestDayState } from './quests'
import { localDay } from '../progress/dates'

export const MOTIVATION_KEY = 'nihao/motivation/v1'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const isDay = (v: unknown): v is string => typeof v === 'string' && DAY_RE.test(v)

function sanitizeQuests(v: unknown): QuestDayState | null {
  if (!isObj(v) || !isDay(v.day)) return null
  const progress: Record<string, number> = {}
  if (isObj(v.progress)) for (const [k, n] of Object.entries(v.progress)) progress[k] = Math.max(0, num(n))
  return { day: v.day, progress, chestClaimed: v.chestClaimed === true, chestNotified: v.chestNotified === true }
}

export function sanitizeDoc(raw: Record<string, unknown>, today: string): MotivationDoc {
  const base = initialDoc(today)
  const st = isObj(raw.stats) ? raw.stats : {}
  const stats = emptyStats()
  for (const k of Object.keys(stats) as (keyof MotivationStats)[]) stats[k] = Math.max(0, num(st[k]))
  const unlocked: Record<string, string> = {}
  if (isObj(raw.unlocked)) for (const [k, d] of Object.entries(raw.unlocked)) if (isDay(d)) unlocked[k] = d
  const knownByDay: Record<string, number> = {}
  if (isObj(raw.knownByDay)) for (const [d, n] of Object.entries(raw.knownByDay)) if (isDay(d)) knownByDay[d] = Math.max(0, num(n))
  const seen = isObj(raw.seen) ? raw.seen : {}
  return {
    version: 1,
    sinceDay: isDay(raw.sinceDay) ? raw.sinceDay : base.sinceDay,
    bonusXp: Math.max(0, num(raw.bonusXp)),
    quests: sanitizeQuests(raw.quests),
    stats,
    unlocked,
    seen: { level: num(seen.level, 0), streakMilestone: num(seen.streakMilestone, -1) },
    knownByDay,
  }
}

export function parseDoc(json: string | null | undefined, today: string): MotivationDoc | null {
  if (!json) return null
  try {
    const raw: unknown = JSON.parse(json)
    if (!isObj(raw) || raw.version !== 1) return null
    return sanitizeDoc(raw, today)
  } catch {
    return null
  }
}

export function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

export interface MotivationStore {
  getState(): MotivationDoc
  update(fn: (d: MotivationDoc) => MotivationDoc): void
  subscribe(l: () => void): () => void
  reload(): void
  reset(): void
  now(): Date
}

export function createMotivationStore(storage: StorageLike | null, now: () => Date = () => new Date()): MotivationStore {
  const today = () => localDay(now())
  const read = () => {
    try { return storage?.getItem(MOTIVATION_KEY) ?? null } catch { return null }
  }
  const write = (d: MotivationDoc) => {
    try { storage?.setItem(MOTIVATION_KEY, JSON.stringify(d)) } catch { /* private mode / quota: keep in memory */ }
  }
  let state = parseDoc(read(), today()) ?? initialDoc(today())
  const listeners = new Set<() => void>()
  const set = (d: MotivationDoc) => {
    if (d === state) return
    state = d
    write(d)
    listeners.forEach((l) => l())
  }
  return {
    getState: () => state,
    update: (fn) => set(fn(state)),
    subscribe(l) {
      listeners.add(l)
      return () => { listeners.delete(l) }
    },
    reload() {
      const d = parseDoc(read(), today())
      if (d) { state = d; listeners.forEach((l) => l()) }
    },
    reset: () => set(initialDoc(today())),
    now,
  }
}
