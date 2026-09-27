// ─────────────────────────────────────────────────────────────
// SHARED CONTRACT — owned by the project lead. Do not change
// without the lead's approval; every module builds against this.
// ─────────────────────────────────────────────────────────────

/** 1–4 = the four tones, 5 = neutral tone. */
export type Tone = 1 | 2 | 3 | 4 | 5

/**
 * PINYIN CONVENTION (all data):
 * - Always tone marks, never numbers: "shuǐ", "nǐ hǎo".
 * - Syllables separated by single spaces, lowercase, even inside one word
 *   ("xiè xie", "zhōng guó"). Proper nouns may be capitalised ("Ruì diǎn").
 * - Punctuation is its own space-separated token: "nǐ hǎo ！" is NOT used;
 *   use ASCII "?" "!" "," "." attached as separate tokens: "nǐ hǎo ma ?"
 * - Neutral tone = no mark ("ma", "de", "xie").
 * - Tone sandhi is NOT written (write "nǐ hǎo", not "ní hǎo"); lesson tips explain it.
 */

export interface Word {
  id: string            // stable, kebab-case, e.g. "shui-water"
  hanzi: string         // required — used for text-to-speech, never required from learner
  pinyin: string        // see convention above
  sv: string            // Swedish meaning, primary answer, e.g. "vatten"
  svAlt?: string[]      // other accepted Swedish answers
  en?: string
  pos?: 'noun' | 'verb' | 'adj' | 'adv' | 'pron' | 'num' | 'measure' | 'particle' | 'phrase' | 'other'
  note?: string         // short Swedish note shown on intro card
}

export interface Sentence {
  id: string
  hanzi: string                 // for TTS
  /** Word-level chunks in order, each chunk follows pinyin convention.
   *  Used as tiles in "build the sentence". e.g. ["wǒ", "shì", "Ruì diǎn rén"] */
  chunks: string[]
  sv: string                    // natural Swedish translation
  /** Swedish tiles for "translate to Swedish" exercise; joined with spaces must equal an accepted answer. */
  svChunks: string[]
  svAlt?: string[]              // other accepted full Swedish translations
  wordIds: string[]             // words this sentence uses (must exist in course.words)
}

export interface Lesson {
  id: string                    // e.g. "u1-l1"
  title: string                 // Swedish
  kind: 'standard' | 'tones' | 'checkpoint'
  newWords: string[]            // word ids introduced here (≈4–7)
  sentences: string[]           // sentence ids practised here
  tip?: string                  // short Swedish grammar/culture/pronunciation tip (markdown-lite, plain text ok)
}

export interface Unit {
  id: string                    // e.g. "u1"
  title: string                 // Swedish, e.g. "Hälsningar"
  description: string
  emoji: string
  lessons: Lesson[]
}

export interface Course {
  units: Unit[]
  words: Record<string, Word>
  sentences: Record<string, Sentence>
}

// ─── Exercises ───────────────────────────────────────────────

/** What the learner is being tested on — key for spaced repetition. */
export type ItemRef = { kind: 'word' | 'sentence'; id: string }

export type Exercise =
  | { type: 'intro'; item: ItemRef }                                   // new-word card, listen, no scoring
  | { type: 'listen-choose'; item: ItemRef; options: string[]; answer: string }   // hear audio → pick Swedish
  | { type: 'sv-to-pinyin'; item: ItemRef; options: string[]; answer: string }    // see Swedish → pick pinyin
  | { type: 'pinyin-to-sv'; item: ItemRef; options: string[]; answer: string }    // see pinyin → pick Swedish
  | { type: 'tone-pick'; item: ItemRef; syllable: string; answer: Tone }          // hear syllable → pick tone
  | { type: 'match-pairs'; items: ItemRef[] }                                     // pair pinyin ↔ Swedish
  | { type: 'build-pinyin'; item: ItemRef; tiles: string[] }                      // Swedish shown → order pinyin chunks (+ distractors)
  | { type: 'build-sv'; item: ItemRef; tiles: string[] }                          // audio+pinyin shown → order Swedish chunks
  | { type: 'type-pinyin'; item: ItemRef }                                        // hear/see Swedish → type pinyin (tone numbers ok)
  | { type: 'speak'; item: ItemRef }                                              // say it → speech recognition

export interface ItemResult { item: ItemRef; correct: boolean }

export interface LessonResult {
  lessonId: string | null       // null for review/practice sessions
  total: number                 // scored exercises
  correct: number
  mistakes: number
  durationMs: number
  items: ItemResult[]
}

// ─── Progress ────────────────────────────────────────────────

export interface Settings {
  speechRate: number            // 0.5–1.2, default 0.85
  showHanzi: boolean            // default false (learner doesn't study characters)
  toneColors: boolean           // default true
  soundEffects: boolean         // default true
  speakingExercises: boolean    // default true (disable if no mic)
  dailyGoalXp: number           // default 30
}

export interface SrsCard {
  item: ItemRef
  ease: number                  // SM-2 style ease factor
  intervalDays: number
  due: string                   // ISO date "YYYY-MM-DD"
  reps: number
  lapses: number
}
