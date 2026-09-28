// OWNER: Content agent.
// Compact authoring format for the course. Units are written as UnitSpec
// objects (see units/*.ts) and turned into the shared `Course` shape here.
import type { Course, Dialogue, DialogueLine, Lesson, Sentence, Unit, Word } from '../types'

type Pos = NonNullable<Word['pos']>

/**
 * [id, hanzi, pinyin, sv, pos, note?]
 * `sv` may hold alternatives separated by "/": the first is the primary
 * answer, the rest become `svAlt`. e.g. "hej/hallå".
 */
export type WordSpec = [id: string, hanzi: string, pinyin: string, sv: string, pos: Pos, note?: string]

/**
 * [tokens, sv, svChunks?]
 * `tokens` = word ids separated by spaces, plus the punctuation tokens
 * "?" "," "!" ".". Hanzi, pinyin chunks and wordIds are derived from the
 * words, so a sentence can never drift from its vocabulary:
 *  - hanzi   = word hanzi concatenated (punctuation → ？ ， ！ 。)
 *  - chunks  = one chunk per word (its pinyin). A final "?" is its own
 *              chunk; a final "." / "!" is dropped. Punctuation INSIDE the
 *              sentence is attached to the preceding chunk ("lǎo shī ,"),
 *              so "lǎo shī , zài jiàn" (hej då, lärare) can never be read as
 *              one run-on phrase.
 * `sv` may hold alternatives separated by "/" (first = primary). Swedish
 * contains no punctuation. svChunks defaults to the primary split on spaces.
 *
 * IDS ARE POSITION-BASED (learners have SRS progress on them):
 * only APPEND sentences / dialogues / words at the end of their lists.
 */
export type SentenceSpec = [tokens: string, sv: string, svChunks?: string[]]

/**
 * [speaker, tokens, sv] — tokens as in SentenceSpec. `sv` is display text
 * and MAY contain punctuation ("Hej! Hur mår du?"). Speaker N = narrator.
 */
export type LineSpec = [speaker: DialogueLine['speaker'], tokens: string, sv: string]

export interface DialogueSpec {
  kind?: Dialogue['kind']            // default 'dialogue'
  title: string
  context: string
  /** Swedish role names. Stories may omit it (defaults to "Berättaren"). */
  speakers?: Dialogue['speakers']
  /** 1-based index of the lesson in THIS unit after which it unlocks. */
  afterLesson: number
  lines: LineSpec[]
}

export interface LessonSpec {
  title: string
  kind?: Lesson['kind']
  words?: WordSpec[]
  sentences: SentenceSpec[]
  tip?: string
}

export interface UnitSpec {
  title: string
  description: string
  emoji: string
  lessons: LessonSpec[]
  /** Append-only: ids are `${unitId}-d${index + 1}`. */
  dialogues?: DialogueSpec[]
}

const PUNCT_HANZI: Record<string, string> = { '?': '？', ',': '，', '!': '！', '.': '。' }

function splitAlt(s: string): [string, string[] | undefined] {
  const parts = s.split('/').map((p) => p.trim()).filter(Boolean)
  return [parts[0], parts.length > 1 ? parts.slice(1) : undefined]
}

/** Token string → hanzi, pinyin chunks and word ids (see SentenceSpec). */
export function compileTokens(
  tokensRaw: string,
  words: Record<string, Word>,
): { hanzi: string; chunks: string[]; wordIds: string[] } {
  const tokens = tokensRaw.trim().split(/\s+/)
  let hanzi = ''
  const chunks: string[] = []
  const wordIds: string[] = []
  tokens.forEach((t, i) => {
    if (t in PUNCT_HANZI) {
      hanzi += PUNCT_HANZI[t]
      const last = i === tokens.length - 1
      if (last) {
        if (t === '?') chunks.push('?')
      } else if (chunks.length) {
        chunks[chunks.length - 1] += ` ${t}`
      }
      return
    }
    const w = words[t]
    // Unknown ids are kept in wordIds so the tests flag them.
    hanzi += w ? w.hanzi : ''
    chunks.push(w ? w.pinyin : `<${t}>`)
    if (!wordIds.includes(t)) wordIds.push(t)
  })
  return { hanzi, chunks, wordIds }
}

export function buildCourse(specs: UnitSpec[]): Course {
  const words: Record<string, Word> = {}
  const sentences: Record<string, Sentence> = {}
  const dialogues: Record<string, Dialogue> = {}
  const units: Unit[] = []

  // First pass: collect all words (so sentence building can look them up).
  for (const u of specs) {
    for (const l of u.lessons) {
      for (const [id, hanzi, pinyin, svRaw, pos, note] of l.words ?? []) {
        const [sv, svAlt] = splitAlt(svRaw)
        const w: Word = { id, hanzi, pinyin, sv, pos }
        if (svAlt) w.svAlt = svAlt
        if (note) w.note = note
        // Duplicates are reported by the tests; keep the first definition.
        if (!words[id]) words[id] = w
      }
    }
  }

  specs.forEach((u, ui) => {
    const unitId = `u${ui + 1}`
    const lessons: Lesson[] = u.lessons.map((l, li) => {
      const lessonId = `${unitId}-l${li + 1}`
      const sentenceIds = l.sentences.map(([tokensRaw, svRaw, svChunksOverride], si) => {
        const id = `${lessonId}-s${si + 1}`
        const { hanzi, chunks, wordIds } = compileTokens(tokensRaw, words)
        const [sv, svAlt] = splitAlt(svRaw)
        const s: Sentence = { id, hanzi, chunks, sv, svChunks: svChunksOverride ?? sv.split(' '), wordIds }
        if (svAlt) s.svAlt = svAlt
        sentences[id] = s
        return id
      })
      const lesson: Lesson = {
        id: lessonId,
        title: l.title,
        kind: l.kind ?? 'standard',
        newWords: (l.words ?? []).map((w) => w[0]),
        sentences: sentenceIds,
      }
      if (l.tip) lesson.tip = l.tip
      return lesson
    })

    const dialogueIds = (u.dialogues ?? []).map((d, di) => {
      const id = `${unitId}-d${di + 1}`
      const kind = d.kind ?? 'dialogue'
      dialogues[id] = {
        id,
        unitId,
        kind,
        title: d.title,
        context: d.context,
        speakers: d.speakers ?? { A: 'Berättaren', B: 'Berättaren' },
        afterLessonId: `${unitId}-l${d.afterLesson}`,
        lines: d.lines.map(([speaker, tokens, sv]) => ({ speaker, ...compileTokens(tokens, words), sv })),
      }
      return id
    })

    const unit: Unit = { id: unitId, title: u.title, description: u.description, emoji: u.emoji, lessons }
    if (dialogueIds.length) unit.dialogueIds = dialogueIds
    units.push(unit)
  })

  return { units, words, sentences, dialogues }
}
