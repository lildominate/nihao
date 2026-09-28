// Builds the v2 generator options from the progress API, so callers wire pedagogy in one line:
//   generateLessonExercises(lesson, course, lessonGenOptions(progress, { speaking }))
//   generateReviewExercises(items, course, reviewGenOptions(progress, { speaking }))
//   generateToneDrill(ids, course, 15, { multiVoice: multiVoiceOn(progress) })
import type { ItemRef } from '../types'
import type { GenOpts, ReviewOpts } from '../exercises/generate'
import type { ProgressApi } from '../progress'

type Api = Pick<ProgressApi, 'state' | 'knownWordIds' | 'mastery' | 'dueItems' | 'weakItems'>

export const multiVoiceOn = (p: Pick<ProgressApi, 'state'>) => p.state.settings.multiVoice ?? true

/** Due items first (most overdue), then weak ones — the pool for interleaved review. */
export function interleaveCandidates(p: Api, limit = 10): ItemRef[] {
  const seen = new Set<string>()
  const out: ItemRef[] = []
  for (const r of [...p.dueItems(limit), ...p.weakItems(Math.ceil(limit / 2))]) {
    const k = `${r.kind}:${r.id}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(r)
  }
  return out.slice(0, limit)
}

export function lessonGenOptions(p: Api, o: { speaking: boolean; seed?: number }): GenOpts {
  return {
    knownWordIds: p.knownWordIds(),
    speaking: o.speaking,
    seed: o.seed,
    mastery: p.mastery,
    reviewItems: interleaveCandidates(p),
    completedLessonIds: Object.keys(p.state.completedLessons),
    multiVoice: multiVoiceOn(p),
  }
}

export function reviewGenOptions(p: Api, o: { speaking: boolean; seed?: number }): ReviewOpts {
  return { speaking: o.speaking, seed: o.seed, mastery: p.mastery, multiVoice: multiVoiceOn(p) }
}
