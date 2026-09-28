// OWNER: Games agent. Best scores in localStorage "nihao/games/v1" (never throws).

export const RECORDS_KEY = 'nihao/games/v1'

export type GameId = 'ordregn' | 'runner' | 'memory' | 'blixt' | 'tonjakt' | 'bygg' | 'snake' | 'bridge' | 'restaurant'

export interface GameRecord {
  best: number
  plays: number
  /** true if the latest play set a new record → "Nytt rekord!" badge in the hub. */
  lastWasRecord: boolean
}

export type Records = Partial<Record<GameId, GameRecord>>

interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }

function defaultStorage(): StorageLike | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}

export function loadRecords(storage: StorageLike | null = defaultStorage()): Records {
  try {
    const raw = storage?.getItem(RECORDS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Records = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const r = v as Partial<GameRecord>
      if (r && typeof r.best === 'number' && Number.isFinite(r.best)) {
        out[k as GameId] = { best: r.best, plays: typeof r.plays === 'number' ? r.plays : 0, lastWasRecord: !!r.lastWasRecord }
      }
    }
    return out
  } catch {
    return {}
  }
}

/** Pure: new records after a play. A record needs score > 0 and > previous best. */
export function applyScore(records: Records, game: GameId, score: number): { records: Records; isNewRecord: boolean; previousBest: number } {
  const prev = records[game]
  const previousBest = prev?.best ?? 0
  const isNewRecord = score > 0 && score > previousBest
  const next: GameRecord = {
    best: Math.max(previousBest, score),
    plays: (prev?.plays ?? 0) + 1,
    lastWasRecord: isNewRecord,
  }
  return { records: { ...records, [game]: next }, isNewRecord, previousBest }
}

export function saveScore(game: GameId, score: number, storage: StorageLike | null = defaultStorage()) {
  const r = applyScore(loadRecords(storage), game, score)
  try { storage?.setItem(RECORDS_KEY, JSON.stringify(r.records)) } catch { /* private mode / quota */ }
  return r
}
