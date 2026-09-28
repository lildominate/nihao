// Pure "Streakskydd" (streak freeze) layer on top of progress history.
//
// The raw streak lives in src/progress (resets to 1 after a missed day). Here we
// re-derive an *effective* streak from progress.xpByDay (every finished session
// writes XP for its day), simulating day by day:
//   • active day            → streak +1; every 7th active day in a row earns 1 freeze (max 2)
//   • missed day (not today) → a freeze is consumed and the streak survives; no freeze → streak 0
//   • today without activity → nothing yet (the day isn't over)
// Freezes are only earned/consumed from `sinceDay` (when v2 motivation first ran);
// before that, missed days break the streak exactly like v1.
import { addDays, daysBetween } from '../progress/dates'

export const FREEZE_EVERY = 7
export const MAX_FREEZES = 2

export interface EffectiveStreak {
  /** Streak to display (days). */
  current: number
  /** Best effective streak ever. */
  best: number
  /** Freezes in stock right now (0–2). */
  freezes: number
  /** Days that were saved by a freeze (all history, oldest first). */
  frozenDays: string[]
  /** Practised today already. */
  activeToday: boolean
  /** Active days until the next freeze is earned (null when stock is full). */
  daysToNextFreeze: number | null
}

export function computeEffectiveStreak(
  xpByDay: Record<string, number>,
  today: string,
  sinceDay: string | null = null,
): EffectiveStreak {
  const active = Object.keys(xpByDay).filter((d) => (xpByDay[d] ?? 0) > 0 && d <= today).sort()
  const empty: EffectiveStreak = { current: 0, best: 0, freezes: 0, frozenDays: [], activeToday: false, daysToNextFreeze: FREEZE_EVERY }
  if (active.length === 0) return empty
  const activeSet = new Set(active)

  let streak = 0
  let best = 0
  let freezes = 0
  let sinceActive = 0 // active days since the last freeze was earned (within this streak)
  const frozenDays: string[] = []
  const span = daysBetween(active[0], today)
  let day = active[0]
  for (let i = 0; i <= span; i++, day = addDays(day, 1)) {
    const freezeOn = sinceDay === null || day >= sinceDay
    if (activeSet.has(day)) {
      streak++
      sinceActive++
      if (streak > best) best = streak
      if (freezeOn && sinceActive >= FREEZE_EVERY) {
        sinceActive = 0
        if (freezes < MAX_FREEZES) freezes++
      }
    } else if (day === today) {
      // Day not over yet.
    } else if (freezeOn && freezes > 0 && streak > 0) {
      freezes--
      frozenDays.push(day)
    } else {
      streak = 0
      sinceActive = 0
    }
  }
  return {
    current: streak,
    best,
    freezes,
    frozenDays,
    activeToday: activeSet.has(today),
    daysToNextFreeze: freezes >= MAX_FREEZES ? null : FREEZE_EVERY - sinceActive,
  }
}

/** Streak milestones that trigger a celebration. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 365]

/** Highest milestone ≤ n (0 if none). */
export function milestoneAtOrBelow(n: number): number {
  let m = 0
  for (const x of STREAK_MILESTONES) if (n >= x) m = x
  return m
}
