// Session event bus (v2 contract, lead). Motivation/games subscribe to react to finished sessions.
import type { LessonResult } from '../types'

export interface SessionEvent { result: LessonResult; xpEarned: number; streakExtended: boolean; at: number }
type Listener = (e: SessionEvent) => void
const listeners = new Set<Listener>()

/** Subscribe to every finished session (lessons, reviews, games, lab, dialogues). Returns unsubscribe. */
export function onSessionFinished(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
export function emitSessionFinished(e: SessionEvent): void {
  for (const fn of listeners) { try { fn(e) } catch (err) { console.error(err) } }
}
