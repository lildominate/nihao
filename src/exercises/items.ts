// Item lookup helpers shared by the generator and UI (pure).
import type { Course, Dialogue, DialogueLine, Exercise, ItemRef, Sentence, Word } from '../types'
import { norm, normSv, syllables } from './pinyinUtil'

export const wordRef = (id: string): ItemRef => ({ kind: 'word', id })
export const sentenceRef = (id: string): ItemRef => ({ kind: 'sentence', id })
export const itemKey = (r: ItemRef) => `${r.kind}:${r.id}`
/** v2: dialogue line ref, id = `${dialogueId}:${lineIndex}`. */
export const lineRef = (dialogueId: string, index: number): ItemRef => ({ kind: 'line', id: `${dialogueId}:${index}` })

export function parseLineId(id: string): { dialogueId: string; index: number } | null {
  const at = id.lastIndexOf(':')
  if (at <= 0) return null
  const index = Number(id.slice(at + 1))
  if (!Number.isInteger(index) || index < 0) return null
  return { dialogueId: id.slice(0, at), index }
}

export function getLine(course: Course, r: ItemRef): { dialogue: Dialogue; line: DialogueLine; index: number } | undefined {
  if (r.kind !== 'line') return undefined
  const p = parseLineId(r.id)
  if (!p) return undefined
  const dialogue = course.dialogues?.[p.dialogueId]
  const line = dialogue?.lines[p.index]
  return dialogue && line ? { dialogue, line, index: p.index } : undefined
}

/** Does the item exist in the course? */
export function itemExists(course: Course, r: ItemRef): boolean {
  if (r.kind === 'word') return !!course.words[r.id]
  if (r.kind === 'sentence') return !!course.sentences[r.id]
  return !!getLine(course, r)
}

/** Pinyin chunks of a sentence or dialogue line (a word → its pinyin as one chunk). */
export function itemChunks(course: Course, r: ItemRef): string[] {
  if (r.kind === 'sentence') return course.sentences[r.id]?.chunks ?? []
  if (r.kind === 'line') return getLine(course, r)?.line.chunks ?? []
  const w = course.words[r.id]
  return w ? [w.pinyin] : []
}

/**
 * v2 audio hint on an exercise (progress-local extension of the shared Exercise
 * union, which is lead-owned). 'rotate' = play this prompt with a different
 * available zh voice each time (high-variability phonetic training). The
 * generator sets it on tone-pick when `multiVoice` is on; players may ignore it.
 */
export type VoiceHint = { voice?: 'rotate' }
export type HintedExercise = Exercise & VoiceHint
export const voiceHint = (ex: Exercise): 'rotate' | undefined => (ex as HintedExercise).voice

export function getWord(course: Course, r: ItemRef): Word | undefined {
  return r.kind === 'word' ? course.words[r.id] : undefined
}
export function getSentence(course: Course, r: ItemRef): Sentence | undefined {
  return r.kind === 'sentence' ? course.sentences[r.id] : undefined
}

export interface ItemInfo { hanzi: string; pinyin: string; sv: string; svAll: string[] }

export function itemInfo(course: Course, r: ItemRef): ItemInfo {
  if (r.kind === 'word') {
    const w = course.words[r.id]
    if (!w) return { hanzi: '', pinyin: r.id, sv: r.id, svAll: [r.id] }
    return { hanzi: w.hanzi, pinyin: w.pinyin, sv: w.sv, svAll: [w.sv, ...(w.svAlt ?? [])] }
  }
  if (r.kind === 'line') {
    const l = getLine(course, r)?.line
    if (!l) return { hanzi: '', pinyin: r.id, sv: r.id, svAll: [r.id] }
    return { hanzi: l.hanzi, pinyin: l.chunks.join(' '), sv: l.sv, svAll: [l.sv] }
  }
  const s = course.sentences[r.id]
  if (!s) return { hanzi: '', pinyin: r.id, sv: r.id, svAll: [r.id] }
  return { hanzi: s.hanzi, pinyin: s.chunks.join(' '), sv: s.sv, svAll: [s.sv, ...(s.svAlt ?? [])] }
}

/** All items an exercise touches (match-pairs → several). */
export function exerciseItems(ex: Exercise): ItemRef[] {
  return ex.type === 'match-pairs' ? ex.items : [ex.item]
}

/** Hanzi to speak for a single syllable of a word (falls back to the whole word). */
export function syllableHanzi(course: Course, r: ItemRef, syllable: string): string {
  const info = itemInfo(course, r)
  const syls = syllables(info.pinyin)
  const chars = [...info.hanzi.replace(/[\s\p{P}]/gu, '')]
  const idx = syls.findIndex((s) => norm(s) === norm(syllable))
  if (idx >= 0 && chars.length === syls.length) return chars[idx]
  return info.hanzi
}

/** Is `answer` one of the accepted Swedish answers? */
export function svMatches(accepted: string[], answer: string): boolean {
  const a = normSv(answer)
  return accepted.some((x) => normSv(x) === a)
}

/** Hanzi to play for an exercise (after a correct answer, or as its prompt). Empty for match-pairs. */
export function exerciseAudio(course: Course, ex: Exercise): string {
  if (ex.type === 'match-pairs') return ''
  if (ex.type === 'tone-pick') return syllableHanzi(course, ex.item, ex.syllable)
  return itemInfo(course, ex.item).hanzi
}

/** Find a course word by its pinyin (used to voice build tiles). */
export function wordByPinyin(course: Course, pinyin: string, prefer: string[] = []): Word | undefined {
  const k = norm(pinyin)
  for (const id of prefer) if (course.words[id] && norm(course.words[id].pinyin) === k) return course.words[id]
  return Object.values(course.words).find((w) => norm(w.pinyin) === k)
}
