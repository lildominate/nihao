// OWNER: Speech/Lab agent. Picks practice material for the lab modes (pure, unit tested).
import type { Course, ItemRef, Sentence, Word } from '../types'
import { syllablesOf } from '../speech/pinyin'

export interface LabItem {
  key: string
  /** For SRS/XP; absent for ad-hoc drill items (e.g. single "mā"). */
  ref?: ItemRef
  hanzi: string
  pinyin: string
  sv: string
}

export function shuffle<T>(arr: readonly T[], rnd: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function sentencePinyin(s: Sentence): string {
  return s.chunks.join(' ')
}

const wordItem = (w: Word): LabItem => ({ key: `w:${w.id}`, ref: { kind: 'word', id: w.id }, hanzi: w.hanzi, pinyin: w.pinyin, sv: w.sv })
const sentenceItem = (s: Sentence): LabItem => ({ key: `s:${s.id}`, ref: { kind: 'sentence', id: s.id }, hanzi: s.hanzi, pinyin: sentencePinyin(s), sv: s.sv })

/** The four tones on "ma" — always available, even before the first lesson. */
export const TONE_BASICS: LabItem[] = [
  { key: 'basic:ma1', hanzi: '妈', pinyin: 'mā', sv: 'mamma (1:a tonen – hög och rak)' },
  { key: 'basic:ma2', hanzi: '麻', pinyin: 'má', sv: 'hampa (2:a tonen – stigande)' },
  { key: 'basic:ma3', hanzi: '马', pinyin: 'mǎ', sv: 'häst (3:e tonen – ner och upp)' },
  { key: 'basic:ma4', hanzi: '骂', pinyin: 'mà', sv: 'skälla (4:e tonen – fallande)' },
]

/** Words with 1–3 syllables and at least one non-neutral tone. */
function toneFriendly(w: Word): boolean {
  const syl = syllablesOf(w.pinyin)
  return syl.length >= 1 && syl.length <= 3 && syl.some((s) => s.tone !== 5)
}

/**
 * Tone-meter items: known words (weakest-first ordering is up to the caller via `prefer`),
 * else the tone basics + words of the first unit.
 */
export function toneItems(course: Course, knownIds: string[], n = 8, rnd: () => number = Math.random): LabItem[] {
  const known = knownIds.map((id) => course.words[id]).filter((w): w is Word => !!w && toneFriendly(w))
  if (known.length >= 4) {
    // mix mono- and disyllables; single syllables first make a gentler start
    const picked = shuffle(known, rnd).slice(0, n)
    return picked.sort((a, b) => syllablesOf(a.pinyin).length - syllablesOf(b.pinyin).length).map(wordItem)
  }
  const first = course.units[0]
  const unitWords = (first?.lessons ?? []).flatMap((l) => l.newWords).map((id) => course.words[id])
    .filter((w): w is Word => !!w && toneFriendly(w) && !/^ma-(hemp|horse|scold)$/.test(w.id))
  const extra = [...known.map(wordItem), ...unitWords.map(wordItem)]
  const seen = new Set<string>()
  const rest = extra.filter((it) => (seen.has(it.key) ? false : (seen.add(it.key), true)))
  return [...TONE_BASICS, ...rest.slice(0, Math.max(0, n - TONE_BASICS.length))]
}

/** Sentences whose words are all known (or the first unit's sentences as a fallback). */
export function shadowItems(course: Course, knownIds: string[], n = 6, rnd: () => number = Math.random): LabItem[] {
  const known = new Set(knownIds)
  const all = Object.values(course.sentences)
  let pool = all.filter((s) => s.wordIds.length > 0 && s.wordIds.every((id) => known.has(id)))
  if (pool.length < 3) {
    const firstUnit = course.units[0]
    const ids = new Set((firstUnit?.lessons ?? []).flatMap((l) => l.sentences))
    const fallback = all.filter((s) => ids.has(s.id))
    pool = [...pool, ...fallback.filter((s) => !pool.includes(s))]
  }
  // not too long for shadowing: ≤ 9 syllables
  const short = pool.filter((s) => syllablesOf(sentencePinyin(s)).length <= 9)
  return shuffle(short.length >= 3 ? short : pool, rnd).slice(0, n).map(sentenceItem)
}

export type HandsfreeSource = { kind: 'known-words' } | { kind: 'known-sentences' } | { kind: 'unit'; unitId: string }

/** Material for the hands-free loop. */
export function handsfreeItems(course: Course, knownIds: string[], source: HandsfreeSource, rnd: () => number = Math.random): LabItem[] {
  if (source.kind === 'unit') {
    const unit = course.units.find((u) => u.id === source.unitId)
    if (!unit) return []
    const words = unit.lessons.flatMap((l) => l.newWords).map((id) => course.words[id]).filter((w): w is Word => !!w).map(wordItem)
    const sentences = unit.lessons.flatMap((l) => l.sentences).map((id) => course.sentences[id]).filter((s): s is Sentence => !!s).map(sentenceItem)
    // interleave: a few words, then a sentence using them
    const out: LabItem[] = []
    let si = 0
    words.forEach((w, i) => { out.push(w); if (i % 3 === 2 && si < sentences.length) out.push(sentences[si++]) })
    return [...out, ...sentences.slice(si)]
  }
  if (source.kind === 'known-sentences') {
    return shadowItems(course, knownIds, 40, rnd)
  }
  const words = knownIds.map((id) => course.words[id]).filter((w): w is Word => !!w).map(wordItem)
  return shuffle(words, rnd)
}
