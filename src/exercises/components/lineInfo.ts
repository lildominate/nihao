// Item lookup that also understands v2 dialogue lines (ItemRef kind 'line', id `dialogueId:lineIndex`).
// Local to the player so components don't depend on items.ts gaining 'line' support.
import type { Course, Dialogue, DialogueLine, Exercise, ItemRef, Sentence } from '../../types'
import { itemInfo, syllableHanzi, type ItemInfo } from '../items'
import { norm } from '../pinyinUtil'

export interface FullInfo extends ItemInfo {
  /** Pinyin chunks (sentences/lines), or the word's pinyin as one chunk. */
  chunks: string[]
  wordIds: string[]
}

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

/** Like items.itemInfo, plus chunks/wordIds, and handles dialogue lines. */
export function infoFor(course: Course, r: ItemRef): FullInfo {
  if (r.kind === 'line') {
    const l = getLine(course, r)
    if (!l) return { hanzi: '', pinyin: r.id, sv: r.id, svAll: [r.id], chunks: [r.id], wordIds: [] }
    const { line } = l
    return { hanzi: line.hanzi, pinyin: line.chunks.join(' '), sv: line.sv, svAll: [line.sv], chunks: line.chunks, wordIds: line.wordIds }
  }
  const base = itemInfo(course, r)
  if (r.kind === 'sentence') {
    const s: Sentence | undefined = course.sentences[r.id]
    return { ...base, chunks: s?.chunks ?? [base.pinyin], wordIds: s?.wordIds ?? [] }
  }
  return { ...base, chunks: [base.pinyin], wordIds: [r.id] }
}

/** Hanzi to play for an exercise (prompt or after answering). Empty for match-pairs. */
export function audioFor(course: Course, ex: Exercise): string {
  if (ex.type === 'match-pairs') return ''
  if (ex.type === 'tone-pick') return syllableHanzi(course, ex.item, ex.syllable)
  return infoFor(course, ex.item).hanzi
}

/** Shortest course sentence / dialogue line (2+ chunks) that uses a word — for intro cards. */
export function exampleFor(course: Course, wordId: string): { hanzi: string; pinyin: string; sv: string } | undefined {
  const cands: { hanzi: string; chunks: string[]; sv: string }[] = []
  for (const s of Object.values(course.sentences)) if (s.wordIds.includes(wordId)) cands.push(s)
  for (const d of Object.values(course.dialogues ?? {})) for (const l of d.lines) if (l.wordIds.includes(wordId)) cands.push(l)
  const self = pinyinKey(course.words[wordId]?.pinyin ?? '')
  const letters = (c: { chunks: string[] }) => c.chunks.filter((x) => /\p{L}/u.test(x))
  // Needs at least one word besides the word itself ("nǐ hǎo !" is not an example of nǐ hǎo).
  const ok = cands.filter((c) => letters(c).length >= 2 && pinyinKey(letters(c).join(' ')) !== self)
  if (!ok.length) return undefined
  ok.sort((a, b) => a.chunks.length - b.chunks.length || a.sv.length - b.sv.length)
  const c = ok[0]
  return { hanzi: c.hanzi, pinyin: c.chunks.join(' '), sv: c.sv }
}

/** Swedish meaning of a pinyin string if it is a known word, sentence or dialogue line. */
export function meaningOfPinyin(course: Course, pinyin: string): string | undefined {
  const k = pinyinKey(pinyin)
  for (const w of Object.values(course.words)) if (pinyinKey(w.pinyin) === k) return w.sv
  for (const s of Object.values(course.sentences)) if (pinyinKey(s.chunks.join(' ')) === k) return s.sv
  for (const d of Object.values(course.dialogues ?? {})) for (const l of d.lines) if (pinyinKey(l.chunks.join(' ')) === k) return l.sv
  return undefined
}

/** Display-only: glue punctuation tokens to the previous syllable ("nǐ hǎo ma ?" → "nǐ hǎo ma?"). */
export function tidyPinyin(pinyin: string): string {
  return pinyin.replace(/\s+([?!,.。，？！])/g, '$1')
}

/** Comparison key for pinyin answers: punctuation dropped, spacing/case/NFC normalised. */
export function pinyinKey(pinyin: string): string {
  return norm(pinyin.replace(/[?!,.;:。，？！；：、…"'”“]/g, ' '))
}
