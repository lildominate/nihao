// Pure daily-quest logic: deterministic selection from the date + progress from session events.
import type { LessonResult } from '../types'

export type QuestKind = 'xp' | 'lessons' | 'run' | 'game' | 'lab' | 'review' | 'dialogue' | 'perfect' | 'correct' | 'video'

export interface QuestDef {
  id: string            // stable, e.g. "xp-30"
  kind: QuestKind
  target: number
  title: string         // Swedish, short
  emoji: string
}

/** Pool of quests. Daily set = 1 XP quest + 2 others (distinct kinds), picked by date hash. */
export const QUEST_POOL: QuestDef[] = [
  { id: 'xp-30', kind: 'xp', target: 30, title: 'Tjäna 30 XP', emoji: '⚡' },
  { id: 'xp-50', kind: 'xp', target: 50, title: 'Tjäna 50 XP', emoji: '⚡' },
  { id: 'xp-80', kind: 'xp', target: 80, title: 'Tjäna 80 XP', emoji: '⚡' },
  { id: 'lessons-1', kind: 'lessons', target: 1, title: 'Klara en lektion', emoji: '📘' },
  { id: 'lessons-2', kind: 'lessons', target: 2, title: 'Klara 2 lektioner', emoji: '📘' },
  { id: 'run-10', kind: 'run', target: 10, title: 'Få 10 rätt i rad', emoji: '🎯' },
  { id: 'run-6', kind: 'run', target: 6, title: 'Få 6 rätt i rad', emoji: '🎯' },
  { id: 'game-1', kind: 'game', target: 1, title: 'Spela ett spel', emoji: '🎮' },
  { id: 'game-2', kind: 'game', target: 2, title: 'Spela 2 spel', emoji: '🎮' },
  { id: 'lab-1', kind: 'lab', target: 1, title: 'Öva uttal i Tallabbet', emoji: '🎙️' },
  { id: 'review-15', kind: 'review', target: 15, title: 'Repetera 15 ord', emoji: '🔁' },
  { id: 'review-10', kind: 'review', target: 10, title: 'Repetera 10 ord', emoji: '🔁' },
  { id: 'dialogue-1', kind: 'dialogue', target: 1, title: 'Lyssna på en dialog', emoji: '💬' },
  { id: 'video-1', kind: 'video', target: 1, title: 'Titta på en video i Videokursen', emoji: '📺' },
  { id: 'perfect-1', kind: 'perfect', target: 1, title: 'Klara ett pass utan fel', emoji: '💎' },
  { id: 'correct-25', kind: 'correct', target: 25, title: 'Svara rätt 25 gånger', emoji: '✅' },
]

/** Small, stable string hash (FNV-1a). */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Seeded PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The 3 quests for a calendar day ("YYYY-MM-DD"). Same day → same quests, always. */
export function questsForDay(day: string, pool: QuestDef[] = QUEST_POOL): QuestDef[] {
  const rand = rng(hashString(`nihao-quests:${day}`))
  const xpQuests = pool.filter((q) => q.kind === 'xp')
  const first = xpQuests[Math.floor(rand() * xpQuests.length)]
  const picked: QuestDef[] = first ? [first] : []
  const others = pool.filter((q) => q.kind !== 'xp')
  // Fisher–Yates with the seeded RNG, then take distinct kinds.
  const shuffled = [...others]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  for (const q of shuffled) {
    if (picked.length >= 3) break
    if (!picked.some((p) => p.kind === q.kind)) picked.push(q)
  }
  return picked
}

export interface QuestDayState {
  day: string
  /** quest id → progress value (capped at target when displayed). */
  progress: Record<string, number>
  chestClaimed: boolean
  /** Chest-ready celebration already shown. */
  chestNotified: boolean
}

export function emptyQuestDay(day: string): QuestDayState {
  return { day, progress: {}, chestClaimed: false, chestNotified: false }
}

/** Longest run of consecutive correct answers in a session. */
export function longestRun(result: LessonResult): number {
  let best = 0
  let cur = 0
  for (const r of result.items) {
    cur = r.correct ? cur + 1 : 0
    if (cur > best) best = cur
  }
  return best
}

export function sessionSource(result: LessonResult): NonNullable<LessonResult['source']> {
  return result.source ?? (result.lessonId ? 'lesson' : 'review')
}

/** How much one finished session advances a quest kind. `run` is a max, everything else adds. */
export function questDelta(kind: QuestKind, result: LessonResult, xpEarned: number): number {
  const src = sessionSource(result)
  switch (kind) {
    case 'xp': return xpEarned
    case 'lessons': return src === 'lesson' && result.lessonId ? 1 : 0
    case 'run': return longestRun(result)
    case 'game': return src === 'game' ? 1 : 0
    case 'lab': return src === 'lab' ? 1 : 0
    case 'dialogue': return src === 'dialogue' ? 1 : 0
    case 'video': return src === 'video' ? 1 : 0
    case 'review': {
      if (src !== 'review') return 0
      const seen = new Set<string>()
      for (const r of result.items) if (r.item.kind === 'word') seen.add(r.item.id)
      // Sentences also count as "words" repeated if the review has no words at all.
      return seen.size > 0 ? seen.size : new Set(result.items.map((r) => `${r.item.kind}:${r.item.id}`)).size
    }
    case 'perfect': return result.total > 0 && result.mistakes === 0 && result.items.every((r) => r.correct) ? 1 : 0
    case 'correct': return result.items.filter((r) => r.correct).length
  }
}

/** Applies a session to the quest state of `day` (resets automatically when the day changed). */
export function applySessionToQuests(
  state: QuestDayState | null,
  day: string,
  result: LessonResult,
  xpEarned: number,
): QuestDayState {
  const base = state && state.day === day ? state : emptyQuestDay(day)
  const progress = { ...base.progress }
  for (const q of questsForDay(day)) {
    const d = questDelta(q.kind, result, xpEarned)
    const prev = progress[q.id] ?? 0
    progress[q.id] = q.kind === 'run' ? Math.max(prev, d) : prev + d
  }
  return { ...base, progress }
}

export interface QuestView extends QuestDef { value: number; done: boolean; ratio: number }

export function questViews(state: QuestDayState | null, day: string): QuestView[] {
  const prog = state && state.day === day ? state.progress : {}
  return questsForDay(day).map((q) => {
    const value = Math.min(q.target, prog[q.id] ?? 0)
    return { ...q, value, done: value >= q.target, ratio: value / q.target }
  })
}

export const CHEST_XP = 25

export function allQuestsDone(state: QuestDayState | null, day: string): boolean {
  return questViews(state, day).every((q) => q.done)
}
