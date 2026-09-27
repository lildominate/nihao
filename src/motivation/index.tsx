// OWNER: Motivation agent. Levels, achievements, daily quests, streak freeze. Signatures = contract.
import type { ReactNode } from 'react'

/** Wrap inside <ProgressProvider>; listens to onSessionFinished and owns its own storage. */
export function MotivationProvider({ children }: { children: ReactNode }) { return children }
/** Compact card for the home screen: today's 3 quests with progress. */
export function DailyQuestsCard() { return null }
/** Small level chip (e.g. "Nivå 4") with progress to next level, for the top bar. */
export function LevelBadge() { return null }
/** Full achievements/stats section for the Profile tab. */
export function AchievementsSection() { return null }
/** Global overlay host: shows level-up / achievement / streak-milestone celebrations when they happen. */
export function MotivationOverlays() { return null }
