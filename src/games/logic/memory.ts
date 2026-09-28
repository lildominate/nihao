// OWNER: Games agent. Memory (pairs) game state machine (pure).
import type { Word } from '../../types'
import { shuffle, type Rng } from './random'

export interface MemCard { uid: number; wordId: string; face: 'pinyin' | 'sv' }

export interface MemoryState {
  cards: MemCard[]
  /** indexes of face-up, unmatched cards (0–2) */
  open: number[]
  matched: string[]
  /** uids that have been seen face-up at least once */
  seen: number[]
  moves: number
}

export type FlipEvent =
  | { kind: 'ignored' }
  | { kind: 'first'; card: MemCard }
  | { kind: 'match'; wordId: string; card: MemCard }
  /** `blame` = word the player (deliberately) got wrong, if the pick wasn't a blind guess. */
  | { kind: 'mismatch'; card: MemCard; blame: string | null }

export function newMemory(words: readonly Word[], rng: Rng = Math.random): MemoryState {
  const cards: MemCard[] = []
  let uid = 0
  for (const w of words) {
    cards.push({ uid: uid++, wordId: w.id, face: 'pinyin' })
    cards.push({ uid: uid++, wordId: w.id, face: 'sv' })
  }
  return { cards: shuffle(cards, rng), open: [], matched: [], seen: [], moves: 0 }
}

export function isDone(s: MemoryState): boolean {
  return s.matched.length * 2 >= s.cards.length
}

/** Flip card `idx`. When two cards are open (mismatch), call `closeOpen` before the next flip. */
export function flip(s: MemoryState, idx: number): { state: MemoryState; event: FlipEvent } {
  const card = s.cards[idx]
  if (!card || s.open.length >= 2 || s.open.includes(idx) || s.matched.includes(card.wordId)) {
    return { state: s, event: { kind: 'ignored' } }
  }
  const wasSeen = s.seen.includes(card.uid)
  const seen = wasSeen ? s.seen : [...s.seen, card.uid]
  if (s.open.length === 0) {
    return { state: { ...s, open: [idx], seen }, event: { kind: 'first', card } }
  }
  const first = s.cards[s.open[0]]
  const moves = s.moves + 1
  if (first.wordId === card.wordId && first.face !== card.face) {
    return {
      state: { ...s, open: [], matched: [...s.matched, card.wordId], seen, moves },
      event: { kind: 'match', wordId: card.wordId, card },
    }
  }
  // A mismatch is a language mistake only if the second card was already known:
  // the player chose it on purpose, believing it belonged to the first card.
  const blame = wasSeen && first.face !== card.face ? first.wordId : null
  return { state: { ...s, open: [s.open[0], idx], seen, moves }, event: { kind: 'mismatch', card, blame } }
}

export function closeOpen(s: MemoryState): MemoryState {
  return s.open.length ? { ...s, open: [] } : s
}

/** Grid columns for n cards (fits 375px width with big targets). */
export function memoryColumns(cardCount: number): number {
  return cardCount <= 8 ? 2 : cardCount <= 12 ? 3 : 4
}
