import { describe, expect, it } from 'vitest'
import type { Course, Exercise, ItemRef } from '../types'
import { fixtureCourse as course } from './fixture.test-data'
import { confusablePinyin, confusableSv, generateLessonExercises, generateReviewExercises, generateToneDrill, makeRng, preferredTypes, toneLesson, spreadOut, unlockedReplyLines } from './generate'
import { itemInfo, itemKey, syllableHanzi, voiceHint } from './items'
import { checkBuild } from './check'
import { syllableBase, syllableTone, withTone } from './pinyinUtil'

const lesson = (id: string) => course.units[0].lessons.find((l) => l.id === id)!
const scored = (ex: Exercise[]) => ex.filter((e) => e.type !== 'intro')
const key = (e: Exercise) => (e.type === 'match-pairs' ? null : itemKey(e.item))

function assertNoBackToBack(ex: Exercise[]) {
  for (let i = 1; i < ex.length; i++) {
    if (ex[i].type === 'intro' || ex[i - 1].type === 'intro') continue
    const a = key(ex[i - 1]), b = key(ex[i])
    if (a && b) expect(a, `back-to-back at ${i}`).not.toBe(b)
  }
}

function assertValidOptions(ex: Exercise[]) {
  for (const e of ex) {
    if (e.type === 'listen-choose' || e.type === 'pinyin-to-sv' || e.type === 'sv-to-pinyin') {
      expect(e.options).toContain(e.answer)
      expect(new Set(e.options).size).toBe(e.options.length)
      expect(e.options.length).toBeGreaterThanOrEqual(3)
      // no distractor may also be a correct meaning
      const info = itemInfo(course, e.item)
      if (e.type !== 'sv-to-pinyin') {
        const accepted = info.svAll.map((s) => s.toLowerCase())
        expect(e.options.filter((o) => accepted.includes(o.toLowerCase()))).toHaveLength(1)
      }
    }
    if (e.type === 'build-pinyin' || e.type === 'build-sv') {
      const s = course.sentences[e.item.id]
      const chunks = e.type === 'build-pinyin' ? s.chunks : s.svChunks
      for (const c of chunks) expect(e.tiles).toContain(c)
      const extra = e.tiles.length - chunks.length
      expect(extra).toBeGreaterThanOrEqual(2)
      expect(extra).toBeLessThanOrEqual(3)
      expect(new Set(e.tiles.map((t) => t.toLowerCase())).size).toBe(e.tiles.length)
    }
    if (e.type === 'match-pairs') {
      expect(e.items.length).toBeGreaterThanOrEqual(4)
      expect(e.items.length).toBeLessThanOrEqual(5)
    }
    if (e.type === 'tone-pick') {
      expect(syllableTone(e.syllable)).toBe(e.answer)
      expect(e.answer).not.toBe(5)
    }
  }
}

describe('pinyin utils', () => {
  it('reads and writes tones', () => {
    expect(syllableTone('shuǐ')).toBe(3)
    expect(syllableTone('ma')).toBe(5)
    expect(syllableBase('lǜ')).toBe('lü')
    expect(withTone('shui', 3)).toBe('shuǐ')
    expect(withTone('hao', 3)).toBe('hǎo')
    expect(withTone('dou', 1)).toBe('dōu')
    expect(withTone('lü', 4)).toBe('lǜ')
    expect(withTone('xie', 4)).toBe('xiè')
  })
  it('maps a syllable to its hanzi', () => {
    expect(syllableHanzi(course, { kind: 'word', id: 'ni-hao' }, 'hǎo')).toBe('好')
  })
})

describe('generateLessonExercises (standard)', () => {
  const l = lesson('u1-l1')
  const ex = generateLessonExercises(l, course, { seed: 1, speaking: true, knownWordIds: ['shui', 'cha'] })

  it('is deterministic for a seed', () => {
    expect(generateLessonExercises(l, course, { seed: 1, speaking: true, knownWordIds: ['shui', 'cha'] })).toEqual(ex)
    expect(generateLessonExercises(l, course, { seed: 2, speaking: true })).not.toEqual(ex)
  })

  it('introduces every new word before testing it', () => {
    for (const id of l.newWords) {
      const introAt = ex.findIndex((e) => e.type === 'intro' && e.item.id === id)
      expect(introAt).toBeGreaterThanOrEqual(0)
      const firstTest = ex.findIndex((e) => e.type !== 'intro' && (e.type === 'match-pairs' ? e.items.some((r) => r.id === id) : e.item.id === id && e.item.kind === 'word'))
      expect(firstTest).toBeGreaterThan(introAt)
    }
  })

  it('has a sensible length and mix', () => {
    const s = scored(ex)
    expect(s.length).toBeGreaterThanOrEqual(12)
    expect(s.length).toBeLessThanOrEqual(18)
    const types = new Set(s.map((e) => e.type))
    for (const t of ['match-pairs', 'sv-to-pinyin'] as const) expect(types).toContain(t)
    expect(types).not.toContain('type-pinyin') // learner opted out of free-text typing
    expect(types.has('build-pinyin') || types.has('build-sv')).toBe(true)
    expect(types.has('speak')).toBe(false) // mic exercises live in Tallabbet only (iOS recognition hung lessons)
  })

  it('ramps: recognition before production', () => {
    const firstProd = ex.findIndex((e) => e.type === 'type-pinyin' || e.type === 'build-pinyin')
    const lastRecog = ex.map((e) => e.type).lastIndexOf('pinyin-to-sv')
    expect(firstProd).toBeGreaterThan(lastRecog)
  })

  it('never tests the same item back-to-back and has valid options', () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const id of ['u1-l1', 'u1-l2', 'u1-t', 'u1-cp']) {
        const e = generateLessonExercises(lesson(id), course, { seed, speaking: seed % 2 === 0 })
        assertNoBackToBack(e)
        assertValidOptions(e)
      }
    }
  })

  it('omits speak exercises when speaking is off', () => {
    const e = generateLessonExercises(l, course, { seed: 3, speaking: false })
    expect(e.some((x) => x.type === 'speak')).toBe(false)
  })

  it('draws build distractors from known words and never duplicates chunks', () => {
    const e = generateLessonExercises(lesson('u1-l2'), course, { seed: 5, knownWordIds: ['wo', 'ni', 'ta'] })
    const builds = e.filter((x) => x.type === 'build-pinyin' || x.type === 'build-sv')
    expect(builds.length).toBeGreaterThanOrEqual(2)
  })
})

describe('tones and checkpoint lessons', () => {
  it('tones lesson is mostly tone-pick + listening', () => {
    const e = scored(toneLesson(lesson('u1-t'), course, {}, makeRng({ seed: 4 })))
    const toneish = e.filter((x) => x.type === 'tone-pick' || x.type === 'listen-choose').length
    expect(toneish / e.length).toBeGreaterThan(0.6)
    expect(e.length).toBeGreaterThanOrEqual(12)
    expect(e.length).toBeLessThanOrEqual(16)
  })

  it('checkpoint reviews the unit with more production and no intros', () => {
    const e = generateLessonExercises(lesson('u1-cp'), course, { seed: 9, speaking: true })
    expect(e.some((x) => x.type === 'intro')).toBe(false)
    expect(e.length).toBeGreaterThanOrEqual(12)
    expect(e.length).toBeLessThanOrEqual(18)
    const prod = e.filter((x) => ['type-pinyin', 'sv-to-pinyin', 'build-pinyin', 'speak'].includes(x.type)).length
    expect(prod / e.length).toBeGreaterThan(0.5)
  })

  it('handles an empty course gracefully', () => {
    const empty = { units: [], words: {}, sentences: {} }
    expect(generateLessonExercises(lesson('u1-l1'), empty)).toEqual([])
    expect(generateLessonExercises(lesson('u1-cp'), empty)).toEqual([])
  })
})

describe('generateReviewExercises', () => {
  const items = [
    { kind: 'word' as const, id: 'shui' },
    { kind: 'word' as const, id: 'cha' },
    { kind: 'word' as const, id: 'wo' },
    { kind: 'word' as const, id: 'he' },
    { kind: 'sentence' as const, id: 's-wo-he-shui' },
    { kind: 'word' as const, id: 'missing' },
  ]
  it('covers every valid item once (+ match-pairs) and is valid', () => {
    const e = generateReviewExercises(items, course, { seed: 1 })
    const covered = new Set(e.filter((x) => x.type !== 'match-pairs').map((x) => key(x)))
    expect(covered.size).toBe(5)
    expect(e.some((x) => x.type === 'match-pairs')).toBe(true)
    assertValidOptions(e)
    assertNoBackToBack(e)
    expect(e.some((x) => x.type === 'speak')).toBe(false)
  })
})

describe('generateToneDrill', () => {
  it('produces the requested count with balanced tones', () => {
    const e = generateToneDrill(['ni-hao', 'xie-xie', 'shui', 'cha', 'ta', 'shi', 'fan'], course, 12, { seed: 1 })
    expect(e).toHaveLength(12)
    const counts = [1, 2, 3, 4].map((t) => e.filter((x) => x.type === 'tone-pick' && x.answer === t).length)
    for (const c of counts) expect(c).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < e.length; i++) {
      const a = e[i - 1], b = e[i]
      if (a.type === 'tone-pick' && b.type === 'tone-pick') expect(a.syllable).not.toBe(b.syllable)
    }
  })
  it('returns [] without tonal words', () => {
    expect(generateToneDrill(['ma'], course)).toEqual([])
  })
})

describe('spreadOut', () => {
  it('separates repeated items', () => {
    const w = (id: string): Exercise => ({ type: 'type-pinyin', item: { kind: 'word', id } })
    const out = spreadOut([w('a'), w('a'), w('b'), w('c')])
    assertNoBackToBack(out)
  })
})

// ─── v2 pedagogy ─────────────────────────────────────────────

const v2course: Course = {
  ...course,
  words: {
    ...course.words,
    'lao-shi': { id: 'lao-shi', hanzi: '老师', pinyin: 'lǎo shī', sv: 'lärare', pos: 'noun' },
  },
  sentences: {
    ...course.sentences,
    's-ls-hao': { id: 's-ls-hao', hanzi: '老师好', chunks: ['lǎo shī', 'hǎo'], sv: 'Hej lärare', svChunks: ['Hej', 'lärare'], wordIds: ['lao-shi', 'hao'] },
    's-ls-zj': { id: 's-ls-zj', hanzi: '老师，再见', chunks: ['lǎo shī', 'zài jiàn'], sv: 'Hej då lärare', svChunks: ['Hej', 'då', 'lärare'], wordIds: ['lao-shi', 'zai-jian'] },
  },
  dialogues: {
    'u1-d1': {
      id: 'u1-d1', unitId: 'u1', kind: 'dialogue', title: 'Hej', context: 'Du möter en vän.', speakers: { A: 'Du', B: 'Vännen' }, afterLessonId: 'u1-l1',
      lines: [
        { speaker: 'A', hanzi: '你好', chunks: ['nǐ hǎo'], sv: 'Hej', wordIds: ['ni-hao'] },
        { speaker: 'B', hanzi: '你好吗？', chunks: ['nǐ', 'hǎo', 'ma', '?'], sv: 'Hur mår du?', wordIds: ['ni', 'hao', 'ma'] },
        { speaker: 'A', hanzi: '我喝茶', chunks: ['wǒ', 'hē', 'chá'], sv: 'Jag dricker te', wordIds: ['wo', 'he', 'cha'] },
        { speaker: 'B', hanzi: '他吃饭', chunks: ['tā', 'chī', 'fàn'], sv: 'Han äter', wordIds: ['ta', 'chi', 'fan'] },
      ],
    },
    'u1-d2': {
      id: 'u1-d2', unitId: 'u1', kind: 'dialogue', title: 'Hej då', context: 'Lektionen slutar.', speakers: { A: 'Du', B: 'Läraren' }, afterLessonId: 'u1-l2',
      lines: [
        { speaker: 'B', hanzi: '谢谢', chunks: ['xiè xie'], sv: 'Tack', wordIds: ['xie-xie'] },
        { speaker: 'A', hanzi: '再见', chunks: ['zài jiàn'], sv: 'Hej då', wordIds: ['zai-jian'] },
      ],
    },
  },
}

function assertV2Valid(c: Course, ex: Exercise[]) {
  for (const e of ex) {
    if (e.type === 'fill-blank' || e.type === 'dialogue-reply') {
      expect(e.options).toContain(e.answer)
      expect(new Set(e.options.map((o) => o.toLowerCase())).size).toBe(e.options.length)
      expect(e.options.length).toBeGreaterThanOrEqual(3)
    }
    if (e.type === 'fill-blank' && e.item.kind === 'sentence') expect(c.sentences[e.item.id].chunks[e.blankIndex]).toBe(e.answer)
    if (e.type === 'dialogue-reply') {
      expect(e.item.kind).toBe('line')
      expect(itemInfo(c, e.item).pinyin).toBe(e.answer)
    }
    if (e.type === 'listen-build') {
      const chunks = e.item.kind === 'sentence' ? c.sentences[e.item.id].chunks : c.dialogues![e.item.id.split(':')[0]].lines[Number(e.item.id.split(':')[1])].chunks
      const rest = [...e.tiles]
      for (const ch of chunks) {
        const at = rest.indexOf(ch)
        expect(at, `chunk ${ch}`).toBeGreaterThanOrEqual(0)
        rest.splice(at, 1)
      }
      // distractors: 2–3, never equal to a real chunk (content may legitimately repeat a chunk)
      expect(rest.length).toBeGreaterThanOrEqual(2)
      const bare = (t: string) => t.toLowerCase().replace(/[?!,.]/g, '').trim()
      for (const x of rest) expect(chunks.map(bare)).not.toContain(bare(x))
    }
  }
}

describe('confusability', () => {
  it('flags look-alike pinyin and Swedish', () => {
    expect(confusablePinyin('lǎo shī hǎo', 'lǎo shī , zài jiàn')).toBe(true)
    expect(confusablePinyin('mā', 'mǎ')).toBe(true)
    expect(confusablePinyin('wǒ hē shuǐ', 'tā chī fàn')).toBe(false)
    expect(confusableSv('Hej lärare', 'Hej då lärare')).toBe(true)
    expect(confusableSv('te', 'mat')).toBe(false)
  })
  it('keeps confusable sentences out of the same question', () => {
    for (let seed = 0; seed < 30; seed++) {
      const ex = generateReviewExercises([{ kind: 'sentence', id: 's-ls-hao' }], v2course, { seed, mastery: () => 0 })
      for (const e of ex) {
        if ('options' in e) {
          expect(e.options).not.toContain('lǎo shī zài jiàn')
          expect(e.options).not.toContain('Hej då lärare')
        }
      }
    }
  })
})

describe('adaptive by mastery', () => {
  const l = lesson('u1-l1')
  const types = (ex: Exercise[]) => new Set(ex.map((e) => e.type))

  it('mastery 0 → intros + recognition first; 4–5 → production, no intros', () => {
    const low = generateLessonExercises(l, v2course, { seed: 3, mastery: () => 0 })
    expect(low.filter((e) => e.type === 'intro')).toHaveLength(l.newWords.length)
    const high = generateLessonExercises(l, v2course, { seed: 3, speaking: true, mastery: () => 5 })
    expect(high.some((e) => e.type === 'intro')).toBe(false)
    const prod = high.filter((e) => ['type-pinyin', 'speak', 'shadow', 'listen-build', 'build-pinyin', 'sv-to-pinyin'].includes(e.type)).length
    expect(prod / scored(high).length).toBeGreaterThanOrEqual(0.5)
    expect(types(high)).toContain('listen-build')
    expect(types(high)).not.toContain('shadow')
  })

  it('mastery 2–3 → no intros, fill-blank appears', () => {
    const mid = generateLessonExercises(lesson('u1-l2'), v2course, { seed: 4, mastery: () => 2 })
    expect(mid.some((e) => e.type === 'intro')).toBe(false)
    expect(types(mid)).toContain('fill-blank')
    assertV2Valid(v2course, mid)
  })

  it('preferredTypes follows the stage table', () => {
    const top = (k: ItemRef['kind'], m: number) => [...preferredTypes(k, m, true)].sort((a, b) => b[1] - a[1])[0][0]
    expect(top('word', 0)).toMatch(/listen-choose|pinyin-to-sv/)
    expect(top('word', 5)).toBe('type-pinyin')
    expect(top('sentence', 2)).toMatch(/fill-blank|build-pinyin/)
    expect(top('sentence', 4)).toBe('listen-build')
    expect(top('line', 1)).toBe('dialogue-reply')
    expect(preferredTypes('sentence', 5, false).find(([t]) => t === 'shadow')![1]).toBe(0)
  })

  it('review exercises adapt to mastery', () => {
    const items: ItemRef[] = ['shui', 'cha', 'wo', 'he', 'fan', 'chi'].map((id) => ({ kind: 'word', id }))
    const low = generateReviewExercises(items, v2course, { seed: 1, mastery: () => 0 })
    const high = generateReviewExercises(items, v2course, { seed: 1, mastery: () => 5 })
    const recog = (ex: Exercise[]) => ex.filter((e) => e.type === 'listen-choose' || e.type === 'pinyin-to-sv').length
    expect(recog(low)).toBeGreaterThan(recog(high))
    expect(high.filter((e) => e.type === 'type-pinyin').length).toBe(0) // typing is converted to pinyin choices
  })
})

describe('interleaved review', () => {
  const review: ItemRef[] = [
    { kind: 'word', id: 'shui' }, { kind: 'word', id: 'cha' }, { kind: 'word', id: 'fan' },
    { kind: 'sentence', id: 's-wo-he-shui' }, { kind: 'word', id: 'chi' }, { kind: 'word', id: 'he' }, { kind: 'word', id: 'ta' },
  ]
  it('~20–30 % of scored exercises are review items, spread out, lesson stays valid', () => {
    const reviewKeys = new Set(review.map(itemKey))
    for (let seed = 0; seed < 20; seed++) {
      const ex = generateLessonExercises(lesson('u1-l1'), v2course, { seed, reviewItems: review, mastery: (r) => (r.id === 'shui' ? 3 : 0) })
      const s = scored(ex)
      const nRev = s.filter((e) => e.type !== 'match-pairs' && reviewKeys.has(itemKey(e.item))).length
      expect(nRev / s.length).toBeGreaterThanOrEqual(0.2)
      expect(nRev / s.length).toBeLessThanOrEqual(0.3)
      expect(s.length).toBeLessThanOrEqual(18)
      assertNoBackToBack(ex)
      assertValidOptions(ex)
      const positions = ex.map((e, i) => (e.type !== 'match-pairs' && reviewKeys.has(itemKey(e.item)) ? i : -1)).filter((i) => i >= 0)
      expect(positions[0]).toBeLessThan(ex.length - positions.length) // not bunched at the end
    }
  })
  it('skips review items that are part of the lesson and unknown items', () => {
    const ex = generateLessonExercises(lesson('u1-l1'), v2course, { seed: 1, reviewItems: [{ kind: 'word', id: 'wo' }, { kind: 'word', id: 'nope' }, { kind: 'line', id: 'zz:1' }] })
    const plain = generateLessonExercises(lesson('u1-l1'), v2course, { seed: 1 })
    expect(scored(ex).length).toBe(scored(plain).length)
  })
})

describe('dialogues', () => {
  it('unlocks reply lines only after afterLessonId', () => {
    expect(unlockedReplyLines(v2course, 'u1-l2', [])).toEqual([])
    const lines = unlockedReplyLines(v2course, 'u1-l2', ['u1-l1'])
    expect(lines.map((r) => r.id)).toEqual(['u1-d1:1', 'u1-d1:2', 'u1-d1:3'])
    expect(unlockedReplyLines({ ...v2course, dialogues: undefined }, 'u1-l2', ['u1-l1'])).toEqual([])
  })
  it('adds dialogue-reply to lessons once unlocked; valid options', () => {
    for (let seed = 0; seed < 15; seed++) {
      const ex = generateLessonExercises(lesson('u1-l2'), v2course, { seed, completedLessonIds: ['u1-l1'] })
      expect(ex.some((e) => e.type === 'dialogue-reply')).toBe(true)
      assertV2Valid(v2course, ex)
      assertNoBackToBack(ex)
      expect(scored(ex).length).toBeLessThanOrEqual(18)
    }
    const locked = generateLessonExercises(lesson('u1-l2'), v2course, { seed: 1 })
    expect(locked.some((e) => e.type === 'dialogue-reply')).toBe(false)
  })
  it('reviews line items (dialogue-reply / listen-build / fill-blank / shadow)', () => {
    const items: ItemRef[] = [{ kind: 'line', id: 'u1-d1:1' }, { kind: 'line', id: 'u1-d1:2' }, { kind: 'line', id: 'u1-d1:3' }]
    for (const m of [0, 2, 5]) {
      const ex = generateReviewExercises(items, v2course, { seed: 2, speaking: true, mastery: () => m })
      expect(ex).toHaveLength(3)
      for (const e of ex) expect(['dialogue-reply', 'listen-build', 'fill-blank', 'shadow']).toContain(e.type)
      assertV2Valid(v2course, ex)
    }
  })
})

describe('real course (v2 content) × adaptive generator', () => {
  it('every lesson stays valid with dialogues unlocked, review interleaving and mixed mastery', async () => {
    const { course: real } = await import('../data/course')
    const lessons = real.units.flatMap((u) => u.lessons)
    const done: string[] = []
    const allLines: ItemRef[] = Object.values(real.dialogues ?? {}).flatMap((d) => d.lines.map((_, i) => ({ kind: 'line' as const, id: `${d.id}:${i}` })))
    let dialogueReplies = 0
    lessons.forEach((l, li) => {
      const known = lessons.slice(0, li).flatMap((x) => x.newWords)
      const reviewItems: ItemRef[] = [...known.slice(-6).map((id) => ({ kind: 'word' as const, id })), ...allLines.slice(li % 7, li % 7 + 2)]
      const mastery = (r: ItemRef) => (r.id.length + li) % 6
      const ex = generateLessonExercises(l, real, { seed: li, speaking: li % 2 === 0, knownWordIds: known, completedLessonIds: done, reviewItems, mastery, multiVoice: true })
      const s = scored(ex)
      expect(s.length, l.id).toBeGreaterThanOrEqual(6)
      expect(s.length, l.id).toBeLessThanOrEqual(20)
      assertNoBackToBack(ex)
      assertV2Valid(real, ex)
      for (const e of ex) {
        for (const it of e.type === 'match-pairs' ? e.items : [e.item]) {
          const ok = it.kind === 'word' ? real.words[it.id] : it.kind === 'sentence' ? real.sentences[it.id] : itemInfo(real, it).hanzi
          expect(ok, `${l.id} ${e.type} → ${it.kind}:${it.id}`).toBeTruthy()
        }
        if ('options' in e) expect(e.options).toContain(e.answer)
        if (e.type === 'fill-blank') expect(e.answer).not.toMatch(/[,!?.]/)
      }
      dialogueReplies += ex.filter((e) => e.type === 'dialogue-reply').length
      done.push(l.id)
    })
    if (Object.keys(real.dialogues ?? {}).length) expect(dialogueReplies).toBeGreaterThan(0)
  })
})

describe('multi-voice hints', () => {
  it('tone-picks get voice: rotate only when multiVoice is on', () => {
    const on = generateToneDrill(['ni-hao', 'shui', 'cha'], course, 6, { seed: 1, multiVoice: true })
    expect(on.every((e) => voiceHint(e) === 'rotate')).toBe(true)
    const off = generateToneDrill(['ni-hao', 'shui', 'cha'], course, 6, { seed: 1 })
    expect(off.some((e) => voiceHint(e))).toBe(false)
    const lessonEx = generateLessonExercises(lesson('u1-t'), course, { seed: 1, multiVoice: true })
    for (const e of lessonEx) expect(voiceHint(e) === 'rotate').toBe(e.type === 'tone-pick')
  })
})

describe('checkBuild', () => {
  it('accepts correct orders and alternatives', () => {
    const s = course.sentences['s-ni-hao-ma']
    expect(checkBuild('build-pinyin', s, ['nǐ', 'hǎo', 'ma', '?'])).toBe(true)
    expect(checkBuild('build-pinyin', s, ['hǎo', 'nǐ', 'ma', '?'])).toBe(false)
    expect(checkBuild('build-sv', s, ['Hur', 'mår', 'du?'])).toBe(true)
    expect(checkBuild('build-sv', s, ['Mår', 'du', 'bra?'])).toBe(true)
    expect(checkBuild('build-sv', s, ['Hur', 'du', 'mår'])).toBe(false)
  })
})
