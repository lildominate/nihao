// OWNER: Lesson-engine agent. Public API — signatures are the contract.
// generateLessonExercises(lesson, course, opts?: { knownWordIds?, speaking?, seed?, rng? }): Exercise[]
// generateReviewExercises(items, course, opts?: { speaking?, seed?, rng? }): Exercise[]
// generateToneDrill(wordIds, course, count = 12, opts?: { seed?, rng? }): Exercise[]
export { generateLessonExercises, generateReviewExercises, generateToneDrill, mulberry32 } from './generate'
export type { GenOpts, Rng } from './generate'

export { LessonPlayer } from './LessonPlayer'
export type { LessonPlayerProps } from './LessonPlayer'
