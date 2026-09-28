// OWNER: Pedagogy agent. Placement test + learning-method helpers. Signatures = contract.
/** Optional placement test offered in onboarding: onDone(lessonId | null) → shell calls skipToLesson(lessonId). */
export { PlacementTest } from './PlacementTest'
export type { PlacementTestProps } from './PlacementTest'
export { startPlacement, nextQuestion, answerQuestion, isFinished, placementResult, estimateKnown, describeLesson, MIN_QUESTIONS, MAX_QUESTIONS } from './placement'
export type { PlacementQuestion, PlacementState } from './placement'
export { lessonGenOptions, reviewGenOptions, interleaveCandidates, multiVoiceOn } from './options'
