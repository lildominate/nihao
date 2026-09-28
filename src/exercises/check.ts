// Answer checking for tile exercises (pure).
import type { Course, Sentence } from '../types'
import { norm, normSv } from './pinyinUtil'

/** Pinyin compare ignoring punctuation chunks/marks ("nǐ hǎo ," = "nǐ hǎo"). */
const bare = (p: string) => norm(p.replace(/[,.!?，。！？]/g, ' '))

const svAnswers = (s: Sentence) => new Set([s.sv, ...(s.svAlt ?? [])].map(normSv))

/**
 * With `course`, build-pinyin also accepts another course sentence that means the same thing
 * (e.g. "hej lärare" = lǎo shī hǎo AND nǐ hǎo, lǎo shī — the learner built a valid alternative).
 */
export function checkBuild(type: 'build-pinyin' | 'build-sv', s: Sentence, picked: string[], course?: Course): boolean {
  if (type === 'build-pinyin') {
    const built = bare(picked.join(' '))
    if (built === bare(s.chunks.join(' '))) return true
    if (!course) return false
    const meaning = svAnswers(s)
    return Object.values(course.sentences).some(
      (o) => bare(o.chunks.join(' ')) === built && [...svAnswers(o)].some((a) => meaning.has(a)),
    )
  }
  const answer = normSv(picked.join(' '))
  return [s.svChunks.join(' '), s.sv, ...(s.svAlt ?? [])].some((a) => normSv(a) === answer)
}
