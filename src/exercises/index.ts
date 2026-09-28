// OWNER: Pedagogy agent (generator) + Lesson-experience agent (LessonPlayer). Signatures are the contract.
// generateLessonExercises(lesson, course, opts?: { knownWordIds?, speaking?, seed?, rng?,
//   v2: mastery?, reviewItems?, completedLessonIds?, multiVoice? }): Exercise[]
// generateReviewExercises(items, course, opts?: { speaking?, seed?, rng?, v2: mastery?, multiVoice? }): Exercise[]
// generateToneDrill(wordIds, course, count = 12, opts?: { seed?, rng?, v2: multiVoice? }): Exercise[]
// Tip: `lessonGenOptions(progress, settings)` in src/pedagogy builds the v2 options from useProgress().
export { generateLessonExercises, generateReviewExercises, generateToneDrill, mulberry32, preferredTypes, confusablePinyin, confusableSv, REVIEW_SHARE } from './generate'
export type { GenOpts, ReviewOpts, MasteryFn, Rng } from './generate'
export { voiceHint, lineRef, parseLineId, getLine, itemExists, itemChunks } from './items'
export type { VoiceHint, HintedExercise } from './items'

export { LessonPlayer } from './LessonPlayer'
export type { LessonPlayerProps } from './LessonPlayer'
