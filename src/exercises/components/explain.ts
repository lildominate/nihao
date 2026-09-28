// One-line "why was that wrong" explanations for the feedback panel (pure, Swedish).
import type { Course, Tone } from '../../types'
import { syllablesOf } from '../../speech/pinyin'
import { normSv, withTone } from '../pinyinUtil'
import { wordByPinyin } from '../items'
import { meaningOfPinyin, pinyinKey } from './lineInfo'

export const TONE_NAME: Record<Tone, string> = { 1: '1:a tonen', 2: '2:a tonen', 3: '3:e tonen', 4: '4:e tonen', 5: 'neutral ton' }
export const TONE_SHAPE: Record<Tone, string> = {
  1: 'hög och jämn',
  2: 'stiger, som en fråga',
  3: 'går ner och upp',
  4: 'faller kort och bestämt',
  5: 'kort och lätt',
}

/** "Tonen: 3:e tonen – går ner och upp" */
export function toneLine(t: Tone): string {
  return t === 5 ? 'Neutral ton – kort och lätt, utan betoning' : `Tonen: ${TONE_NAME[t]} – ${TONE_SHAPE[t]}`
}

/** "shuǐ" / tone 4 → "shui4" (how a learner would type it). */
function numbered(base: string, tone: Tone): string {
  return tone === 5 ? base.replace(/v/g, 'ü') : `${base.replace(/v/g, 'ü')}${tone}`
}

/**
 * Explain a pinyin miss when the syllables are right but a tone is off.
 * `typed` = the learner typed it (message uses tone numbers like "shui4").
 * Returns undefined when the syllables themselves differ.
 */
export function explainTones(given: string, expected: string, typed = false): string | undefined {
  const g = syllablesOf(given)
  const e = syllablesOf(expected)
  if (!g.length || g.length !== e.length) return undefined
  if (g.some((s, i) => s.base.toLowerCase() !== e[i].base.toLowerCase())) return undefined
  const diffs = e.map((s, i) => ({ exp: s, got: g[i] })).filter((d) => d.exp.tone !== d.got.tone)
  if (!diffs.length) return undefined
  if (diffs.length === 1) {
    const { exp, got } = diffs[0]
    const right = withTone(exp.base.replace(/v/g, 'ü'), exp.tone)
    if (typed) {
      const what = got.tone === 5 ? `${numbered(got.base, 5)} utan ton` : numbered(got.base, got.tone)
      return `Du skrev ${what}, rätt är ${right} (${TONE_NAME[exp.tone]} – ${TONE_SHAPE[exp.tone]})`
    }
    const wrong = withTone(got.base.replace(/v/g, 'ü'), got.tone)
    return `Du valde ${wrong} (${TONE_NAME[got.tone]}). ${right} har ${TONE_NAME[exp.tone]} – ${TONE_SHAPE[exp.tone]}`
  }
  const list = diffs.slice(0, 3).map((d) => `${withTone(d.exp.base.replace(/v/g, 'ü'), d.exp.tone)} (${TONE_NAME[d.exp.tone].replace(' tonen', '')})`)
  return `Rätt stavelser – kolla tonerna: ${list.join(', ')}`
}

/** Picked pinyin option ≠ answer: tone hint, or what the picked word means. */
export function explainPinyinChoice(course: Course, picked: string, answer: string, prefer: string[] = []): string | undefined {
  const t = explainTones(picked, answer)
  if (t) return t
  const w = wordByPinyin(course, picked, prefer)
  if (w) return `${w.pinyin} betyder ”${w.sv}”`
  const sv = meaningOfPinyin(course, picked)
  return sv ? `Det du valde betyder ”${sv}”` : undefined
}

/** Picked Swedish option ≠ answer: say which word the learner picked, if we know it. */
export function explainSvChoice(course: Course, picked: string): string | undefined {
  const p = normSv(picked)
  const w = Object.values(course.words).find((x) => normSv(x.sv) === p)
  return w ? `”${w.sv}” heter ${w.pinyin} på kinesiska` : undefined
}

/** Built chunk sequence ≠ answer: tones / word order / missing words. */
export function explainBuild(picked: string[], answer: string[]): string | undefined {
  const t = explainTones(picked.join(' '), answer.join(' '))
  if (t) return t
  const words = (a: string[]) => a.filter((x) => /\p{L}/u.test(x)).map(pinyinKey)
  const p = words(picked)
  const a = words(answer)
  if (p.length === a.length && [...p].sort().join('|') === [...a].sort().join('|')) return 'Rätt ord – men i fel ordning.'
  if (p.length < a.length && p.every((x) => a.includes(x))) return 'Det saknas ett ord eller två.'
  if (p.length > a.length && a.every((x) => p.includes(x))) return 'Ett ord för mycket – alla brickor ska inte användas.'
  return undefined
}
