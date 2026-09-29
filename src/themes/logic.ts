// OWNER: Themes agent. Pure logic for picture themes (lesson chunking, distractors, round building, best score).
import type { Course, ItemRef, Lesson, Theme, Word } from '../types'
import { syllablesOf, stripTones } from '../speech/pinyin'
import { optionKey } from '../games/logic/pool'
import { weightedPick } from '../games/logic/weighting'
import { shuffle, type Rng } from '../games/logic/random'

export const THEME_WORDS_PER_LESSON = 3
export const ROUND_SIZE = 10
export const THEMES_KEY = 'nihao/themes/v1'

export const wordRef = (id: string): ItemRef => ({ kind: 'word', id })

/** Theme words that exist in the course (deduplicated, theme order). */
export function themeWords(theme: Theme, course: Course): Word[] {
  const out: Word[] = []
  const seen = new Set<string>()
  for (const id of theme.words) {
    const w = course.words[id]
    if (!w || seen.has(id)) continue
    seen.add(id)
    out.push(w)
  }
  return out
}

/** Themes that exist and have at least one resolvable word. Safe when `course.themes` is undefined. */
export function themesOf(course: Course): Theme[] {
  return (course.themes ?? []).filter((t) => t && Array.isArray(t.words) && themeWords(t, course).length > 0)
}

export function themeProgress(theme: Theme, course: Course, known: ReadonlySet<string>): { known: number; total: number } {
  const ws = themeWords(theme, course)
  return { known: ws.filter((w) => known.has(w.id)).length, total: ws.length }
}

/** 0..1 mean mastery of the theme's words (mastery is 0..5). */
export function themeMastery(theme: Theme, course: Course, mastery: (i: ItemRef) => number): number {
  const ws = themeWords(theme, course)
  if (!ws.length) return 0
  const sum = ws.reduce((a, w) => a + Math.max(0, Math.min(5, mastery(wordRef(w.id)))), 0)
  return sum / (ws.length * 5)
}

export type ThemeLessonPlan =
  | { mode: 'learn'; lesson: Lesson; n: number }
  | { mode: 'review'; items: ItemRef[]; title: string }

/**
 * Next theme session. While the learner has unlearned theme words: a synthetic lesson with the next 3
 * (theme order, easiest first). Afterwards: a review of the theme's words (weakest first).
 * `n` = 1-based part number = words already known / 3 rounded down + 1.
 */
export function planThemeLesson(
  theme: Theme, course: Course, known: ReadonlySet<string>, mastery: (i: ItemRef) => number = () => 0, reviewCount = 12,
): ThemeLessonPlan {
  const ws = themeWords(theme, course)
  const unlearned = ws.filter((w) => !known.has(w.id))
  if (unlearned.length > 0) {
    const n = Math.floor((ws.length - unlearned.length) / THEME_WORDS_PER_LESSON) + 1
    const lesson: Lesson = {
      id: `theme:${theme.id}:${n}`,
      kind: 'standard',
      title: `${theme.title} · Del ${n}`,
      newWords: unlearned.slice(0, THEME_WORDS_PER_LESSON).map((w) => w.id),
      sentences: [],
    }
    return { mode: 'learn', lesson, n }
  }
  const sorted = ws.map((w, i) => ({ w, i, m: mastery(wordRef(w.id)) })).sort((a, b) => a.m - b.m || a.i - b.i)
  return { mode: 'review', title: `${theme.title} · Repetition`, items: sorted.slice(0, reviewCount).map((x) => wordRef(x.w.id)) }
}

// ─── Distractors ─────────────────────────────────────────────

/** Higher = more alike (pinyin shape). Used both to avoid and to seek confusable options. */
export function similarity(a: Word, b: Word): number {
  const sa = syllablesOf(a.pinyin), sb = syllablesOf(b.pinyin)
  let s = 0
  const bases = new Set(sb.map((x) => x.base))
  for (const x of new Set(sa.map((y) => y.base))) if (bases.has(x)) s += 2
  if (sa.length === sb.length) s += 1
  if (sa[0] && sb[0] && sa[0].base[0] === sb[0].base[0]) s += 1
  if (sa[0] && sb[0] && sa[0].tone === sb[0].tone) s += 0.5
  if (sa.map((x) => x.tone).join() === sb.map((x) => x.tone).join()) s += 0.5
  return s
}

/** How many of the 3 distractors should be "near" (same theme, similar sound) for a word of this mastery. */
export const nearCountFor = (mastery: number): number => (mastery < 2 ? 0 : mastery < 4 ? 1 : 3)

/**
 * Distractors for `target` (n − 1 words). Low mastery: far away (other themes, different pinyin shape).
 * Higher mastery: nearer words from the same theme. Never duplicates, never the same pinyin/hanzi/emoji/meaning.
 */
export function pickDistractors(
  target: Word, theme: Theme, course: Course, allThemes: readonly Theme[], mastery: number, rng: Rng, n = 4,
): Word[] {
  const need = n - 1
  const seen = new Set<string>([optionKey(target.pinyin), optionKey(stripTones(target.pinyin))])
  const hanzi = new Set([target.hanzi])
  const svs = new Set(target.sv.split('/').map(optionKey))
  const ok = (w: Word) =>
    w.id !== target.id && !hanzi.has(w.hanzi) && !seen.has(optionKey(w.pinyin)) &&
    !(w.emoji && w.emoji === target.emoji) && !w.sv.split('/').some((s) => svs.has(optionKey(s)))

  const inTheme = themeWords(theme, course).filter(ok)
  const themeIds = new Set(theme.words)
  const others: Word[] = []
  const otherSeen = new Set<string>()
  for (const t of allThemes) {
    if (t.id === theme.id) continue
    for (const w of themeWords(t, course)) {
      if (!themeIds.has(w.id) && !otherSeen.has(w.id) && ok(w)) { otherSeen.add(w.id); others.push(w) }
    }
  }
  const near = inTheme.map((w) => ({ w, s: similarity(target, w) + rng() * 1.5 })).sort((a, b) => b.s - a.s).map((x) => x.w)
  // Far: other themes get a semantic bonus, then the least similar pinyin.
  const far = [
    ...inTheme.map((w) => ({ w, s: -similarity(target, w) + rng() * 1.5 })),
    ...others.map((w) => ({ w, s: 2 - similarity(target, w) + rng() * 1.5 })),
  ].sort((a, b) => b.s - a.s).map((x) => x.w)

  const out: Word[] = []
  const take = (list: readonly Word[], count: number) => {
    for (const w of list) {
      if (out.length >= need || count <= 0) return
      const k = optionKey(w.pinyin)
      if (seen.has(k) || hanzi.has(w.hanzi) || out.some((o) => o.id === w.id)) continue
      seen.add(k); hanzi.add(w.hanzi); count--
      out.push(w)
    }
  }
  take(near, Math.min(need, nearCountFor(mastery)))
  take(far, need - out.length)
  take(near, need - out.length)
  if (out.length < need) take(shuffle(Object.values(course.words).filter(ok), rng), need - out.length)
  return out
}

export interface PictureQuestion { word: Word; options: Word[] }

/** One question: the word plus distractors, shuffled. */
export function buildQuestion(word: Word, theme: Theme, course: Course, allThemes: readonly Theme[], mastery: number, rng: Rng): PictureQuestion {
  return { word, options: shuffle([word, ...pickDistractors(word, theme, course, allThemes, mastery, rng)], rng) }
}

/**
 * A round: `size` distinct theme words (with emoji) drawn by weight (weak/unseen first;
 * weights come from games/logic/weighting buildWeights). Draw order is the play order.
 */
export function buildRound(theme: Theme, course: Course, weights: Record<string, number>, rng: Rng, size = ROUND_SIZE): Word[] {
  const left = themeWords(theme, course).filter((w) => !!w.emoji)
  const out: Word[] = []
  while (out.length < size && left.length > 0) {
    const w = weightedPick(left, (x) => weights[x.id] ?? 1, (x) => x.id, rng, [])
    out.push(w)
    left.splice(left.findIndex((x) => x.id === w.id), 1)
  }
  return out
}

// ─── Best score ──────────────────────────────────────────────

export interface ThemeBest { best: number; plays: number }
type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void }
const store = (): Store | null => { try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null } }

export function loadThemeBests(s: Store | null = store()): Record<string, ThemeBest> {
  try {
    const raw = s?.getItem(THEMES_KEY)
    const p = raw ? (JSON.parse(raw) as Record<string, Partial<ThemeBest>>) : {}
    const out: Record<string, ThemeBest> = {}
    for (const [k, v] of Object.entries(p ?? {})) if (v && typeof v.best === 'number') out[k] = { best: v.best, plays: v.plays ?? 0 }
    return out
  } catch { return {} }
}

export function saveThemeScore(themeId: string, score: number, s: Store | null = store()): { best: number; isNewRecord: boolean } {
  const all = loadThemeBests(s)
  const prev = all[themeId]?.best ?? 0
  const isNewRecord = score > 0 && score > prev
  all[themeId] = { best: Math.max(prev, score), plays: (all[themeId]?.plays ?? 0) + 1 }
  try { s?.setItem(THEMES_KEY, JSON.stringify(all)) } catch { /* private mode / quota */ }
  return { best: all[themeId].best, isNewRecord }
}

/** 10 points per right answer + up to +5 combo bonus. */
export function pointsFor(combo: number): number { return 10 + Math.min(5, Math.max(0, combo - 1)) }
