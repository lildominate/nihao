// Short lessons: a standard lesson is played as 1–3 parts of ≤3 new words each.
// Parts keep the lesson id, so progress/SRS/unlocking are unchanged — the lesson only
// counts as completed when its LAST part is finished. No words are dropped: every new
// word and sentence lands in exactly one part.
import type { Course, Lesson } from '../types'

export const WORDS_PER_PART = 3
/** Scored exercises per part (plus ≤3 intro cards) → ~10–13 steps instead of ~27. */
export const PART_MAX_SCORED = 10

export function lessonParts(lesson: Lesson, course: Course): Lesson[] {
  const words = lesson.newWords.filter((id) => course.words[id])
  if (lesson.kind !== 'standard' || words.length <= WORDS_PER_PART) return [lesson]

  const count = Math.ceil(words.length / WORDS_PER_PART)
  // Balanced sizes: 7 words → 3+2+2, 5 → 3+2, 8 → 3+3+2.
  const chunks: string[][] = []
  let at = 0
  for (let i = 0; i < count; i++) {
    const n = Math.ceil((words.length - at) / (count - i))
    chunks.push(words.slice(at, at + n))
    at += n
  }
  const partOf = new Map<string, number>()
  chunks.forEach((c, i) => c.forEach((id) => partOf.set(id, i)))

  // A sentence belongs to the part that introduces its last new word (so all its words are known by then).
  const sentences: string[][] = chunks.map(() => [])
  for (const sid of lesson.sentences) {
    const s = course.sentences[sid]
    if (!s) continue
    const idx = Math.max(-1, ...s.wordIds.map((w) => partOf.get(w) ?? -1))
    sentences[idx < 0 ? chunks.length - 1 : idx].push(sid)
  }

  return chunks.map((newWords, i) => ({
    ...lesson,
    newWords,
    sentences: sentences[i],
    tip: i === 0 ? lesson.tip : undefined,
  }))
}

// ─── Which part is next (per device; tiny, separate from the progress doc) ───
const KEY = 'nihao/lesson-parts/v1'

function read(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number> } catch { return {} }
}

export function nextPartIndex(lessonId: string, count: number): number {
  const i = read()[lessonId] ?? 0
  return i >= 0 && i < count ? i : 0
}

/** Call when a part is finished. Returns true if that was the last part (lesson complete). */
export function finishPart(lessonId: string, index: number, count: number): boolean {
  const last = index >= count - 1
  try {
    const all = read()
    if (last) delete all[lessonId]
    else all[lessonId] = index + 1
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch { /* storage unavailable: parts just restart */ }
  return last
}
