// OWNER: Motivation agent. Levels, achievements, daily quests, streak freeze. Signatures = contract.
//
// Wiring (shell):
//   <ProgressProvider><MotivationProvider><App/><MotivationOverlays paused={inSession}/></MotivationProvider></ProgressProvider>
// Display the streak with useEffectiveStreak().current (includes "Streakskydd"), not displayStreak().
// Level XP = progress.xpTotal + bonusXp (quest chests). bonusXp lives in "nihao/motivation/v1".
export { MotivationProvider, useMotivation, useEffectiveStreak } from './context'
export type { MotivationApi } from './context'
export { DailyQuestsCard, LevelBadge, AchievementsSection, WeeklyRecapCard, StreakFreezeInfo } from './components'
export { MotivationOverlays } from './overlays'
export { Medal, Chest, FreezeIcon } from './art'
export { levelForXp, xpForLevel, titleForLevel, LEVEL_TITLES, MAX_LEVEL } from './levels'
export type { LevelInfo } from './levels'
export { ACHIEVEMENTS } from './achievements'
export type { AchievementView } from './achievements'
export type { QuestView } from './quests'
export type { EffectiveStreak } from './streak'
export type { Celebration, WeeklyRecap } from './state'
export { MOTIVATION_KEY } from './storage'
