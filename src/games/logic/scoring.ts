// OWNER: Games agent. Scoring rules and speed curves for every game (pure).

// ─── Ordregn ────────────────────────────────────────────────
export const ORDREGN_LIVES = 3

/** How long (ms) a word takes to fall the whole screen after `hits` correct taps. */
export function ordregnFallMs(hits: number): number {
  return Math.max(1900, Math.round(6500 * Math.pow(0.94, Math.max(0, hits))))
}

export function ordregnLevel(hits: number): number {
  return 1 + Math.floor(Math.max(0, hits) / 5)
}

/** Points for a hit. `fallen` = 0 (top) … 1 (ground): faster taps are worth more. */
export function ordregnPoints(level: number, fallen: number): number {
  const f = Math.min(1, Math.max(0, fallen))
  return 10 * level + Math.round((1 - f) * 10)
}

// ─── Blixtquiz ──────────────────────────────────────────────
export const BLIXT_DURATION_MS = 60_000
export const BLIXT_TIME_BONUS_MS = 5_000

/** Score multiplier for the current combo (after this answer): ×1, ×2 from 3, ×3 from 6 … max ×5. */
export function blixtMultiplier(combo: number): number {
  return Math.min(5, 1 + Math.floor(Math.max(0, combo) / 3))
}

export function blixtPoints(combo: number): number {
  return 100 * blixtMultiplier(combo)
}

/** Extra time awarded for reaching `combo` (every 5-combo). */
export function blixtTimeBonus(combo: number): number {
  return combo > 0 && combo % 5 === 0 ? BLIXT_TIME_BONUS_MS : 0
}

// ─── Memory ─────────────────────────────────────────────────
/** Higher is better. Perfect memory (moves == pairs) in no time = pairs × 100. */
export function memoryScore(pairs: number, moves: number, ms: number): number {
  if (pairs <= 0) return 0
  const extraMoves = Math.max(0, moves - pairs)
  const secs = Math.floor(Math.max(0, ms) / 1000)
  return Math.max(pairs * 20, pairs * 100 - extraMoves * 15 - secs * 2)
}

/** 1–3 stars for the score screen. */
export function memoryStars(pairs: number, moves: number): 1 | 2 | 3 {
  const extra = moves - pairs
  if (extra <= pairs * 0.5) return 3
  if (extra <= pairs * 1.2) return 2
  return 1
}

// ─── Tonjakt ────────────────────────────────────────────────
export const TONJAKT_LIVES = 3
export const TONJAKT_PER_LEVEL = 6
export const STREAK_METER_MAX = 10

export function tonjaktLevel(solved: number): number {
  return 1 + Math.floor(Math.max(0, solved) / TONJAKT_PER_LEVEL)
}

/** Levels 1–2: single syllables, level 3+: two-syllable words (if any exist). */
export function tonjaktSyllables(level: number): 1 | 2 {
  return level >= 3 ? 2 : 1
}

/** Points for a solved prompt; streak (after this answer) multiplies. */
export function tonjaktPoints(streak: number, syllables: number): number {
  return 10 * syllables * (1 + Math.floor(Math.max(0, streak) / 5))
}

// ─── Meningsbyggaren ────────────────────────────────────────
export const BUILDER_DURATION_MS = 90_000

/** Points for a built sentence: per chunk, doubled if built without a mistake. */
export function builderPoints(chunks: number, mistakes: number): number {
  const base = 25 * Math.max(1, chunks)
  return mistakes === 0 ? base * 2 : Math.max(10, base - mistakes * 10)
}
