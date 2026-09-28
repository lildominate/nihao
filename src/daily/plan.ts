// "Dagens pass": one tap plans a sensible day from the learner's energy + what they crave.
// Pedagogy: review what is due first (don't forget), then something new, then something fun
// with the words just learned. Pure logic — the App runs the steps.

export type Energy = 'low' | 'normal' | 'high'
export type Craving = 'surprise' | 'lesson' | 'game' | 'listen' | 'song'
export type StepKind = 'review' | 'lesson' | 'game' | 'video' | 'dialogue' | 'song'

export interface DayContext {
  dueCount: number          // SRS items due today
  hasNextLesson: boolean    // an available (not yet completed) lesson exists
  knownWords: number        // words with an SRS card
  hasDialogue: boolean      // an unlocked dialogue exists
  hasVideo: boolean         // an unwatched Videokurs video exists
  hasSong: boolean          // a song with pasted lyrics exists
}

export const ENERGY: Record<Energy, { label: string; emoji: string; minutes: number }> = {
  low: { label: 'Lite', emoji: '😴', minutes: 5 },
  normal: { label: 'Normal', emoji: '🙂', minutes: 10 },
  high: { label: 'Taggad', emoji: '🔥', minutes: 20 },
}

export const CRAVINGS: Record<Craving, { label: string; emoji: string }> = {
  surprise: { label: 'Överraska mig', emoji: '🎲' },
  lesson: { label: 'Lära mig nytt', emoji: '📘' },
  game: { label: 'Spel', emoji: '🎮' },
  listen: { label: 'Lyssna & titta', emoji: '🎧' },
  song: { label: 'Låt', emoji: '🎵' },
}

/** Rough minutes per step, used to fill the time budget. */
export const STEP_MINUTES: Record<StepKind, number> = { review: 3, lesson: 4, game: 3, video: 5, dialogue: 2, song: 4 }

export const STEP_INFO: Record<StepKind, { label: string; emoji: string }> = {
  review: { label: 'Repetera', emoji: '🔁' },
  lesson: { label: 'Ny lektion', emoji: '📘' },
  game: { label: 'Spel', emoji: '🎮' },
  video: { label: 'Video', emoji: '📺' },
  dialogue: { label: 'Dialog', emoji: '💬' },
  song: { label: 'Låt', emoji: '🎵' },
}

export function planDay(energy: Energy, craving: Craving, ctx: DayContext): StepKind[] {
  const budget = ENERGY[energy].minutes
  const can: Record<StepKind, boolean> = {
    review: ctx.dueCount > 0,
    lesson: ctx.hasNextLesson,
    game: ctx.knownWords >= 4,
    video: ctx.hasVideo,
    dialogue: ctx.hasDialogue,
    song: ctx.hasSong,
  }
  const wanted: Partial<Record<Craving, StepKind>> = { lesson: 'lesson', game: 'game', listen: ctx.hasDialogue ? 'dialogue' : 'video', song: 'song' }

  // Candidate order: review first, the craving next, then new material, fun, listening.
  const order: StepKind[] = ['review']
  const crave = wanted[craving]
  if (crave) order.push(crave)
  order.push('lesson', 'game', craving === 'listen' ? 'video' : 'dialogue', 'lesson', 'video', 'game', 'review')

  const plan: StepKind[] = []
  let used = 0
  for (const s of order) {
    if (!can[s]) continue
    // Only a second lesson/game/review when the day is long; never the same kind twice in a row.
    if (plan.includes(s) && energy !== 'high') continue
    if (plan.at(-1) === s) continue
    if (plan.length && used + STEP_MINUTES[s] > budget + 1) continue
    plan.push(s)
    used += STEP_MINUTES[s]
    if (used >= budget) break
  }
  // Brand-new learner with nothing else: always at least the first lesson.
  if (!plan.length) plan.push(can.lesson ? 'lesson' : 'video')
  return plan
}

// ─── Remember today's plan so a finished day shows as done ───
const KEY = 'nihao/daily/v1'
export interface DayRecord { day: string; steps: StepKind[]; done: number }

export function loadDay(today: string): DayRecord | null {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as DayRecord | null
    return d && d.day === today ? d : null
  } catch { return null }
}
export function saveDay(d: DayRecord): void {
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* storage unavailable */ }
}
