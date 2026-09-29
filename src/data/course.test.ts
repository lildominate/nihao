// Validation of the course content. Run: npx vitest run src/data
import { pinyin as pinyinPro } from 'pinyin-pro'
import { describe, expect, it } from 'vitest'
import { course } from './course'
import { WELCOME_STEPS } from '../app/welcomeSteps'

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
const dialogues = Object.values(course.dialogues ?? {})
const lines = dialogues.flatMap((d) => d.lines.map((l, i) => ({ ...l, id: `${d.id}:${i}` })))

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

  it('introduces every word in exactly one lesson (theme words may be theme-only)', () => {
    const seen = new Map<string, string>()
    for (const l of lessons) {
      for (const id of l.newWords) {
        expect(seen.has(id), `${id} introduced in ${seen.get(id)} and ${l.id}`).toBe(false)
        seen.set(id, l.id)
        expect(course.words[id], `${l.id}: unknown word ${id}`).toBeDefined()
      }
    }
    const themeWordIds = new Set((course.themes ?? []).flatMap((t) => t.words))
    for (const id of Object.keys(course.words))
      expect(seen.has(id) || themeWordIds.has(id), `${id} neither introduced in a lesson nor a theme word`).toBe(true)
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

  it('ends every unit with a checkpoint and has no tone-drill lesson early (paused on learner request)', () => {
    for (const u of course.units) expect(u.lessons.at(-1)?.kind, u.id).toBe('checkpoint')
    expect(course.units[0].lessons.some((l) => l.kind === 'tones')).toBe(false)
  })

  it('unit 1 and onboarding do not push the four tones on the beginner', () => {
    const u1 = course.units[0]
    const texts = [u1.title, u1.description, ...u1.lessons.flatMap((l) => [l.title, l.tip ?? ''])]
    for (const t of [u1.title, u1.description, ...u1.lessons.map((l) => l.title)]) expect(t, t).not.toMatch(/toner(na)?|tonträning/i)
    expect(texts.join(' ')).not.toMatch(/fyra toner/i)
    expect(WELCOME_STEPS as readonly string[]).not.toContain('tones')
    expect(WELCOME_STEPS).toHaveLength(4)
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
    ...lines.map((l) => ({ id: l.id, hanzi: l.hanzi, pinyin: l.chunks.join(' ') })),
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
    '喂:wéi', // phone "hallå" is said wéi (rising); pinyin-pro gives the dictionary reading wèi
    '教:jiāo', // standalone 教 is read jiào (education) by pinyin-pro; our word is the verb "teach", jiāo
    '假:jià', // 请假 (ask for leave): pinyin-pro reads standalone/in-context 假 as jiǎ (fake); here it is jià (leave)
    'u13-l5-s6', // 导游说英文: pinyin-pro segments 游说 as yóu shuì (lobby); here 说 is shuō (导游 + 说 + 英文)
    '空:kòng', // 有空 (have free time): pinyin-pro reads 空 as kōng (empty); here it is kòng (free time)
    'u2-l4-s2', // 一点中文: pinyin-pro reads 点中 as "diǎn zhòng" (hit); correct is Zhōng wén
    '得:děi', // 我得走了 (I have to go): pinyin-pro reads standalone 得 as dé/de; here it is děi (must)
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
        // per-character exceptions ("喂:wéi") apply wherever the character occurs
        if (ALLOW.has(`${[...hanOnly][i]}:${syllablesOf(it.pinyin)[i].toLowerCase()}`)) return false
        if (o.base.replace(/ü/g, 'v') !== r.base.replace(/ü/g, 'v')) return true
        return o.tone !== 5 && r.tone !== 5 && o.tone !== r.tone
      })
      if (bad) {
        const key = `${hanOnly}:${it.pinyin.toLowerCase()}`
        // 一点中文 anywhere: pinyin-pro segments 点中 as "diǎn zhòng" (hit); correct is Zhōng wén
        const dianZhongwen = hanOnly.includes('点中文') && it.pinyin.includes('diǎn Zhōng wén')
        if (!dianZhongwen && !ALLOW.has(key) && !ALLOW.has(`${it.id}`))
          mismatches.push(`${it.id}  ${hanOnly}  ours="${it.pinyin}"  pinyin-pro="${ref.map((r) => r.base + r.tone).join(' ')}"`)
      }
    }
    expect(mismatches, mismatches.join('\n')).toEqual([])
  })
})

describe('themes', () => {
  const themes = course.themes ?? []

  it('has the four picture themes', () => {
    expect(themes.map((t) => t.id)).toEqual(['t-food', 't-vehicles', 't-animals', 't-home'])
    for (const t of themes) expect(t.title.trim() && t.emoji, t.id).toBeTruthy()
  })

  it('has 16–28 words per theme, no duplicates, all existing with an emoji', () => {
    for (const t of themes) {
      expect(t.words.length, t.id).toBeGreaterThanOrEqual(16)
      expect(t.words.length, t.id).toBeLessThanOrEqual(28)
      expect(new Set(t.words).size, `${t.id} has duplicate words`).toBe(t.words.length)
      for (const id of t.words) {
        const w = course.words[id]
        expect(w, `${t.id}: unknown word ${id}`).toBeDefined()
        expect(w.emoji?.trim(), `${id} has no emoji`).toBeTruthy()
        expect([...new Intl.Segmenter().segment(w.emoji!)].length, `${id} emoji must be a single emoji`).toBe(1)
      }
    }
  })

  it('has no two words with the same hanzi inside a theme', () => {
    for (const t of themes) {
      const hanzi = t.words.map((id) => course.words[id].hanzi)
      expect(new Set(hanzi).size, t.id).toBe(hanzi.length)
    }
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

describe('dialogues & stories', () => {
  const lessonIndex = new Map(lessons.map((l, i) => [l.id, i]))
  /** word id → global index of the lesson that introduces it */
  const introducedAt = new Map<string, number>()
  lessons.forEach((l, i) => l.newWords.forEach((w) => introducedAt.set(w, i)))

  it('has 2–3+ dialogues per unit and some stories', () => {
    expect(dialogues.length).toBeGreaterThanOrEqual(20)
    expect(dialogues.filter((d) => d.kind === 'story').length).toBeGreaterThanOrEqual(3)
    for (const u of course.units) expect(u.dialogueIds?.length ?? 0, u.id).toBeGreaterThanOrEqual(2)
  })

  it('has ids matching record keys, each linked from exactly its own unit', () => {
    const linked = new Map<string, string>()
    for (const u of course.units) {
      for (const id of u.dialogueIds ?? []) {
        expect(linked.has(id), `${id} linked twice`).toBe(false)
        linked.set(id, u.id)
        expect(course.dialogues?.[id], `${u.id}: unknown dialogue ${id}`).toBeDefined()
      }
    }
    for (const [k, d] of Object.entries(course.dialogues ?? {})) {
      expect(d.id, k).toBe(k)
      expect(d.id, k).toMatch(/^u\d+-d\d+$/)
      expect(linked.get(k), `${k} not linked from its unit`).toBe(d.unitId)
    }
  })

  it('unlocks after an existing lesson of its own unit', () => {
    for (const d of dialogues) {
      expect(lessonIndex.has(d.afterLessonId), `${d.id}: unknown lesson ${d.afterLessonId}`).toBe(true)
      expect(d.afterLessonId.startsWith(`${d.unitId}-`), `${d.id}: ${d.afterLessonId} not in ${d.unitId}`).toBe(true)
    }
  })

  it('has 4–10 lines, valid speakers and Swedish metadata', () => {
    for (const d of dialogues) {
      expect(d.lines.length, d.id).toBeGreaterThanOrEqual(4)
      expect(d.lines.length, d.id).toBeLessThanOrEqual(10)
      expect(d.title.trim() && d.context.trim(), d.id).toBeTruthy()
      expect(d.speakers.A.trim() && d.speakers.B.trim(), d.id).toBeTruthy()
      for (const l of d.lines) {
        if (d.kind === 'story') expect(l.speaker, d.id).toBe('N')
        else expect(['A', 'B'], d.id).toContain(l.speaker)
        expect(l.sv.trim().length, d.id).toBeGreaterThan(0)
      }
      if (d.kind === 'dialogue') expect(new Set(d.lines.map((l) => l.speaker)).size, `${d.id} needs two speakers`).toBe(2)
    }
  })

  it('only uses words introduced at or before afterLessonId', () => {
    for (const d of dialogues) {
      const at = lessonIndex.get(d.afterLessonId) ?? -1
      d.lines.forEach((l, i) => {
        expect(l.wordIds.length, `${d.id}:${i} has no words`).toBeGreaterThan(0)
        for (const w of l.wordIds) {
          expect(course.words[w], `${d.id}:${i}: unknown word ${w}`).toBeDefined()
          const intro = introducedAt.get(w) ?? Infinity
          expect(intro <= at, `${d.id}:${i} uses ${w} (introduced in ${lessons[intro]?.id}) before ${d.afterLessonId}`).toBe(true)
        }
      })
    }
  })

  it('has well-formed chunks ("?" only as a final chunk, 1–12 tiles)', () => {
    for (const l of lines) {
      l.chunks.forEach((c, i) => {
        expect(c.length > 0 && c === c.trim(), l.id).toBe(true)
        if (PUNCT.has(c)) expect(i, `${l.id}: punctuation "${c}" not last`).toBe(l.chunks.length - 1)
      })
      const n = l.chunks.filter((c) => !PUNCT.has(c)).length
      expect(n, l.id).toBeGreaterThanOrEqual(1)
      expect(n, l.id).toBeLessThanOrEqual(12)
    }
  })
})

describe('chunk punctuation', () => {
  it('keeps a mid-sentence comma visible on the preceding chunk (vocatives)', () => {
    const bye = sentences.find((s) => s.hanzi === '老师，再见')
    const hi = sentences.find((s) => s.hanzi === '老师好')
    expect(bye?.chunks).toEqual(['lǎo shī ,', 'zài jiàn'])
    expect(hi?.chunks).toEqual(['lǎo shī', 'hǎo'])
    // the two must never be offered as each other's answers
    const acc = (s: typeof hi) => new Set([s!.sv, ...(s!.svAlt ?? [])].map(normSv))
    expect([...acc(bye)].some((x) => acc(hi).has(x))).toBe(false)
  })
})

describe('fact-check regressions', () => {
  it('has no "än du" answers and no dj/tj comparisons for zh/ch', () => {
    for (const x of [...words, ...sentences]) {
      for (const a of [x.sv, ...(x.svAlt ?? [])]) expect(a).not.toContain(' än du')
    }
    const notes = JSON.stringify(course.words)
    expect(notes).not.toMatch(/(zh|ch)[^"]{0,40}"(dj|tj)"/)
    expect(notes).not.toMatch(/"(dj|tj)"[^"]{0,40}(zh|ch)/)
  })
})
