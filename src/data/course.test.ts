// Validation of the course content. Run: npx vitest run src/data
import { pinyin as pinyinPro } from 'pinyin-pro'
import { describe, expect, it } from 'vitest'
import { course } from './course'

const PUNCT = new Set(['?', ',', '!', '.'])
const HAN = /\p{Script=Han}/gu
const TONE_MARKS: Record<string, [string, number]> = {}
for (const [base, marks] of Object.entries({ a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' })) {
  ;[...marks].forEach((m, i) => (TONE_MARKS[m] = [base, i + 1]))
}

/** "Zhōng" → { base: "zhong", tone: 1 }; tone 5 = neutral (no mark). */
function parseSyllable(s: string): { base: string; tone: number; marks: number } {
  let base = ''
  let tone = 5
  let marks = 0
  for (const ch of s.toLowerCase()) {
    const m = TONE_MARKS[ch]
    if (m) {
      base += m[0]
      tone = m[1]
      marks++
    } else base += ch
  }
  return { base, tone, marks }
}

// Structural pinyin syllable: optional initial + a valid final (no erhua used in this course).
const SYLLABLE =
  /^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(iang|iong|uang|ueng|iao|ian|uai|uan|üan|ang|eng|ing|ong|ai|ei|ao|ou|an|en|in|un|ün|ia|ie|iu|ua|uo|ui|üe|ue|er|a|o|e|i|u|ü)$/

const syllablesOf = (p: string) => p.split(' ').filter((t) => !PUNCT.has(t))
const hanCount = (h: string) => (h.match(HAN) ?? []).length

/**
 * Swedish answer rule: svChunks joined with single spaces must equal `sv` or one
 * of `svAlt`, compared case-insensitively after trimming and dropping trailing
 * punctuation. (Course content itself uses no punctuation in Swedish.)
 */
const normSv = (s: string) => s.trim().replace(/[.!?,]+$/, '').toLowerCase()

const lessons = course.units.flatMap((u) => u.lessons)
const words = Object.values(course.words)
const sentences = Object.values(course.sentences)

describe('course structure', () => {
  it('has content', () => {
    expect(course.units.length).toBeGreaterThanOrEqual(8)
    expect(words.length).toBeGreaterThanOrEqual(300)
    expect(sentences.length).toBeGreaterThanOrEqual(250)
  })

  it('has unique unit and lesson ids', () => {
    const ids = [...course.units.map((u) => u.id), ...lessons.map((l) => l.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('uses kebab-case ids matching record keys', () => {
    for (const [k, w] of Object.entries(course.words)) {
      expect(w.id, k).toBe(k)
      expect(w.id, k).toMatch(/^[a-zü0-9]+(-[a-zü0-9]+)*$/)
    }
    for (const [k, s] of Object.entries(course.sentences)) expect(s.id, k).toBe(k)
  })

  it('introduces every word in exactly one lesson', () => {
    const seen = new Map<string, string>()
    for (const l of lessons) {
      for (const id of l.newWords) {
        expect(seen.has(id), `${id} introduced in ${seen.get(id)} and ${l.id}`).toBe(false)
        seen.set(id, l.id)
        expect(course.words[id], `${l.id}: unknown word ${id}`).toBeDefined()
      }
    }
    for (const id of Object.keys(course.words)) expect(seen.has(id), `${id} never introduced`).toBe(true)
  })

  it('references only existing sentences, each exactly once', () => {
    const seen = new Set<string>()
    for (const l of lessons) {
      for (const id of l.sentences) {
        expect(course.sentences[id], `${l.id}: unknown sentence ${id}`).toBeDefined()
        expect(seen.has(id), `${id} used twice`).toBe(false)
        seen.add(id)
      }
    }
    expect(seen.size).toBe(sentences.length)
  })

  it('has 3–8 new words per non-checkpoint lesson, none in checkpoints', () => {
    for (const l of lessons) {
      if (l.kind === 'checkpoint') expect(l.newWords, l.id).toHaveLength(0)
      else {
        expect(l.newWords.length, l.id).toBeGreaterThanOrEqual(3)
        expect(l.newWords.length, l.id).toBeLessThanOrEqual(8)
      }
      expect(l.sentences.length, `${l.id} has no sentences`).toBeGreaterThan(0)
    }
  })

  it('ends every unit with a checkpoint and has a tones lesson in unit 1', () => {
    for (const u of course.units) expect(u.lessons.at(-1)?.kind, u.id).toBe('checkpoint')
    expect(course.units[0].lessons.some((l) => l.kind === 'tones' && l.tip)).toBe(true)
  })

  it('only uses words introduced at or before the lesson', () => {
    const known = new Set<string>()
    for (const l of lessons) {
      l.newWords.forEach((id) => known.add(id))
      for (const sid of l.sentences) {
        const s = course.sentences[sid]
        for (const wid of s.wordIds) {
          expect(course.words[wid], `${sid}: unknown word ${wid}`).toBeDefined()
          expect(known.has(wid), `${sid} (${l.id}) uses ${wid} before it is introduced`).toBe(true)
        }
      }
    }
  })
})

describe('pinyin & hanzi', () => {
  const items = [
    ...words.map((w) => ({ id: w.id, hanzi: w.hanzi, pinyin: w.pinyin })),
    ...sentences.map((s) => ({ id: s.id, hanzi: s.hanzi, pinyin: s.chunks.join(' ') })),
  ]

  it('has valid pinyin syllables (tone marks, lowercase except capitalised proper nouns)', () => {
    for (const it of items) {
      expect(it.pinyin, it.id).not.toMatch(/\d|  |^ | $/)
      for (const syl of syllablesOf(it.pinyin)) {
        expect(syl, `${it.id}: "${syl}"`).toMatch(/^[A-ZÀ-ǜ]?[a-zà-ǜü]*$/u)
        const { base, marks } = parseSyllable(syl)
        expect(marks, `${it.id}: "${syl}" has ${marks} tone marks`).toBeLessThanOrEqual(1)
        expect(base, `${it.id}: "${syl}" is not a pinyin syllable`).toMatch(SYLLABLE)
      }
    }
  })

  it('has as many Han characters as pinyin syllables', () => {
    for (const it of items) {
      expect(hanCount(it.hanzi), `${it.id}: ${it.hanzi} / ${it.pinyin}`).toBe(syllablesOf(it.pinyin).length)
      expect(it.hanzi, it.id).toMatch(/^[\p{Script=Han}？，！。]+$/u)
    }
  })

  it('puts "?" only as the final chunk of sentences', () => {
    for (const s of sentences) {
      s.chunks.forEach((c, i) => {
        if (PUNCT.has(c)) expect(i, `${s.id}: punctuation "${c}" not last`).toBe(s.chunks.length - 1)
      })
      expect(s.chunks.every((c) => c.length > 0 && c === c.trim()), s.id).toBe(true)
      const n = s.chunks.filter((c) => !PUNCT.has(c)).length
      expect(n, `${s.id} has ${n} chunks`).toBeGreaterThanOrEqual(2)
      expect(n, `${s.id} has ${n} chunks`).toBeLessThanOrEqual(8)
    }
  })

  /**
   * Cross-check against pinyin-pro. A neutral tone on either side matches any tone
   * (pinyin-pro rarely outputs neutral tones, and when it does – e.g. 这个 zhè ge – our
   * dictionary tone "gè" is also fine); otherwise syllable and tone must match exactly.
   * Genuine exceptions are allowlisted as "hanzi:our pinyin" or by item id.
   */
  const ALLOW = new Set<string>([
    '了:le', // standalone 了 is read liǎo by pinyin-pro; our word is the particle le
    'u2-l4-s2', // 一点中文: pinyin-pro reads 点中 as "diǎn zhòng" (hit); correct is Zhōng wén
  ])

  it('agrees with pinyin-pro (tones included)', () => {
    const mismatches: string[] = []
    for (const it of items) {
      const ours = syllablesOf(it.pinyin).map(parseSyllable)
      const hanOnly = (it.hanzi.match(HAN) ?? []).join('')
      const ref = (pinyinPro(hanOnly, { type: 'array', toneSandhi: false }) as string[]).map(parseSyllable)
      const bad = ours.some((o, i) => {
        const r = ref[i]
        if (!r) return true
        if (o.base.replace(/ü/g, 'v') !== r.base.replace(/ü/g, 'v')) return true
        return o.tone !== 5 && r.tone !== 5 && o.tone !== r.tone
      })
      if (bad) {
        const key = `${hanOnly}:${it.pinyin.toLowerCase()}`
        if (!ALLOW.has(key) && !ALLOW.has(`${it.id}`))
          mismatches.push(`${it.id}  ${hanOnly}  ours="${it.pinyin}"  pinyin-pro="${ref.map((r) => r.base + r.tone).join(' ')}"`)
      }
    }
    expect(mismatches, mismatches.join('\n')).toEqual([])
  })
})

describe('swedish', () => {
  it('svChunks join to sv or an svAlt', () => {
    for (const s of sentences) {
      const joined = normSv(s.svChunks.join(' '))
      const accepted = [s.sv, ...(s.svAlt ?? [])].map(normSv)
      expect(accepted, `${s.id}: "${joined}"`).toContain(joined)
    }
  })

  it('uses no punctuation in sentence Swedish', () => {
    for (const s of sentences) {
      for (const t of [s.sv, ...(s.svAlt ?? []), ...s.svChunks])
        expect(t, s.id).toMatch(/^[\p{L}\p{N} -]+$/u)
      expect(s.svChunks.every((c) => c.length > 0 && !c.includes(' ')), s.id).toBe(true)
    }
  })

  it('has non-empty Swedish for every word', () => {
    for (const w of words) {
      expect(w.sv.trim().length, w.id).toBeGreaterThan(0)
      for (const a of w.svAlt ?? []) expect(a.trim().length, w.id).toBeGreaterThan(0)
    }
  })

  it('has a tip in roughly every other lesson', () => {
    const standard = lessons.filter((l) => l.kind !== 'checkpoint')
    expect(standard.filter((l) => l.tip).length / standard.length).toBeGreaterThanOrEqual(0.5)
  })
})
