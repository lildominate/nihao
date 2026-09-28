// End-of-lesson data for the shell ("Ord du övade"). Pure; the player does not render a second result screen.
import type { Course, Exercise, ItemRef, LessonResult } from '../../types'
import { itemKey } from '../items'
import { infoFor } from './lineInfo'

export interface PractisedItem {
  item: ItemRef
  pinyin: string
  sv: string
  hanzi: string
  /** Right on the first attempt in this session. */
  firstTry: boolean
  /** Graded attempts in this session (retries included). */
  attempts: number
  /** Introduced as a new word in this lesson. */
  isNew: boolean
}

export interface LessonSummary {
  /** Same as result.items (every graded attempt, in order). */
  items: LessonResult['items']
  /** One entry per distinct item, in first-seen order: new words first, then the rest. */
  practised: PractisedItem[]
  /** Longest run of correct answers. */
  bestCombo: number
}

export function summarizeLesson(result: LessonResult, course: Course, exercises: Exercise[] = [], bestCombo = 0): LessonSummary {
  const intro = new Set(exercises.filter((e) => e.type === 'intro').map((e) => itemKey((e as Extract<Exercise, { type: 'intro' }>).item)))
  const map = new Map<string, PractisedItem>()
  for (const r of result.items) {
    const k = itemKey(r.item)
    const prev = map.get(k)
    if (prev) { prev.attempts++; continue }
    const info = infoFor(course, r.item)
    map.set(k, { item: r.item, pinyin: info.pinyin, sv: info.sv, hanzi: info.hanzi, firstTry: r.correct, attempts: 1, isNew: intro.has(k) })
  }
  // Intro-only words (never scored) still count as practised new words.
  for (const k of intro) {
    if (map.has(k)) continue
    const [kind, ...rest] = k.split(':')
    const item = { kind, id: rest.join(':') } as ItemRef
    const info = infoFor(course, item)
    map.set(k, { item, pinyin: info.pinyin, sv: info.sv, hanzi: info.hanzi, firstTry: true, attempts: 0, isNew: true })
  }
  const practised = [...map.values()].sort((a, b) => Number(b.isNew) - Number(a.isNew))
  return { items: [...result.items], practised, bestCombo }
}
