// OWNER: Games agent. Meningsbyggaren: sentence selection + tiles (pure).
import type { Course, Sentence } from '../../types'
import { optionKey } from './pool'
import { shuffle, type Rng } from './random'

const isPunct = (c: string) => /^[?!.,，。？！]+$/.test(c.trim())

/** Pinyin chunks without punctuation tokens ("duì bu qǐ ," → "duì bu qǐ"). */
export function sentenceChunks(s: Sentence): string[] {
  return s.chunks
    .map((c) => c.split(/\s+/).filter((t) => t && !isPunct(t)).join(' '))
    .filter(Boolean)
}

/** Sentences built only from words in `wordIds` (≥2 chunks). */
export function playableSentences(course: Course, wordIds: readonly string[]): Sentence[] {
  const set = new Set(wordIds)
  return Object.values(course.sentences).filter((s) => sentenceChunks(s).length >= 2 && s.wordIds.every((id) => set.has(id)))
}

export interface Tile { id: number; text: string }

/** Correct chunks + up to `distractors` extra chunks from `others` that don't appear in the sentence. */
export function builderTiles(s: Sentence, others: readonly string[], rng: Rng = Math.random, distractors = 2): Tile[] {
  const chunks = sentenceChunks(s)
  const used = new Set(chunks.map(optionKey))
  const extra: string[] = []
  for (const o of shuffle(others, rng)) {
    if (extra.length >= distractors) break
    const k = optionKey(o)
    if (!k || isPunct(o) || used.has(k)) continue
    used.add(k)
    extra.push(o)
  }
  return shuffle([...chunks, ...extra], rng).map((text, id) => ({ id, text }))
}

/** Is `text` the next expected chunk after `placed` correct chunks? (Duplicates match by text.) */
export function isNextChunk(s: Sentence, placed: number, text: string): boolean {
  const chunks = sentenceChunks(s)
  return placed < chunks.length && optionKey(chunks[placed]) === optionKey(text)
}
