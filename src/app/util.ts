// Shell helpers.
import type { Course, Dialogue, Unit } from '../types'

/** Per-unit colour theme (cycled). `soft` adapts to light/dark via color-mix with the surface. */
const mk = (bg: string, dark: string, light: string) => ({ bg, dark, light, soft: `color-mix(in oklab, ${bg} 15%, var(--color-surface))` })
export const UNIT_COLORS = [
  mk('#12a179', '#0a7a5a', '#3fcf9f'), // jade
  mk('#e0533f', '#a93523', '#f47e68'), // lacquer red
  mk('#2f8fe0', '#1a67ad', '#62b2f5'), // porcelain blue
  mk('#8b5cf6', '#6a3fd0', '#ab88ff'), // plum
  mk('#f08a24', '#bb5f08', '#ffac55'), // persimmon
  mk('#11a3a8', '#0a787c', '#3fcacd'), // teal
  mk('#d9a007', '#9f7200', '#f5c233'), // imperial gold
  mk('#4f63d8', '#3345a8', '#7b8cf0'), // indigo
  mk('#e2517f', '#b02e5a', '#f57ea2'), // peony
  mk('#5fa32a', '#427a17', '#86c451'), // bamboo
] as const
export const unitColor = (i: number) => UNIT_COLORS[i % UNIT_COLORS.length]

/** Lowercase, strip diacritics (tone marks, å/ä/ö are kept as base letters). */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** word id → the unit that introduces it. */
export function wordUnitMap(course: Course): Map<string, Unit> {
  const m = new Map<string, Unit>()
  for (const u of course.units) for (const l of u.lessons) for (const w of l.newWords) if (!m.has(w)) m.set(w, u)
  return m
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

export const ONBOARDED_KEY = 'nihao/onboarded'
export function safeGet(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } }
export function safeSet(key: string, v: string): void { try { localStorage.setItem(key, v) } catch { /* ignore */ } }
export function safeRemove(key: string): void { try { localStorage.removeItem(key) } catch { /* ignore */ } }

// Dialogues/stories the learner has played through (for the "done" state on the path).
const DIALOGUES_SEEN_KEY = 'nihao/dialogues-seen'
export function seenDialogues(): Set<string> {
  try { return new Set(JSON.parse(safeGet(DIALOGUES_SEEN_KEY) ?? '[]') as string[]) } catch { return new Set() }
}
export function markDialogueSeen(id: string): void {
  const s = seenDialogues(); s.add(id); safeSet(DIALOGUES_SEEN_KEY, JSON.stringify([...s]))
}

/** Dialogues/stories that sit on the path right after `lessonId`. */
export function dialoguesAfter(course: Course, lessonId: string): Dialogue[] {
  return Object.values(course.dialogues ?? {}).filter((d) => d.afterLessonId === lessonId)
}
