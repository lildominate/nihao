// Exercise generators — pure functions, deterministic when given a seed/rng.
import type { Course, Exercise, ItemRef, Lesson, Sentence, Tone, Word } from '../types'
import { exerciseItems, itemKey, sentenceRef, wordRef } from './items'
import { norm, normSv, syllableTone, syllables } from './pinyinUtil'

// ─── RNG ─────────────────────────────────────────────────────

export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface GenOpts {
  knownWordIds?: string[]
  speaking?: boolean
  /** Inject an RNG (tests) … */
  rng?: Rng
  /** … or a seed. Defaults to Math.random. */
  seed?: number
}

function makeRng(o?: { rng?: Rng; seed?: number }): Rng {
  if (o?.rng) return o.rng
  if (o?.seed != null) return mulberry32(o.seed)
  return Math.random
}

const uniq = <T,>(a: T[]) => [...new Set(a)]

// ─── Context & distractors ───────────────────────────────────

interface Ctx {
  course: Course
  rng: Rng
  /** Preferred distractor source (lesson + known words). */
  pool: Set<string>
  /** Preferred sentence distractor source. */
  sentencePool: Set<string>
}

function makeCtx(course: Course, rng: Rng, pool: string[], sentencePool: string[] = []): Ctx {
  return { course, rng, pool: new Set(pool.filter((id) => course.words[id])), sentencePool: new Set(sentencePool) }
}

/** Descriptions like "(frågepartikel)" are not real Swedish words — never use them as distractors. */
const isMetaSv = (sv: string) => /^[([]/.test(sv.trim())

const svSetOf = (x: { sv: string; svAlt?: string[] }) => new Set([x.sv, ...(x.svAlt ?? [])].map(normSv))
const overlaps = (a: Set<string>, b: Set<string>) => [...a].some((x) => b.has(x))

/** Distractor candidates in order of plausibility: pool+same pos, pool, course+same pos, course. */
function wordCandidates(ctx: Ctx, exclude: Set<string>, pos?: Word['pos']): Word[] {
  const all = Object.values(ctx.course.words).filter((w) => !exclude.has(w.id))
  const same = (w: Word) => !!pos && w.pos === pos
  const tiers: Word[][] = [[], [], [], []]
  for (const w of all) tiers[(ctx.pool.has(w.id) ? 0 : 2) + (same(w) ? 0 : 1)].push(w)
  return tiers.flatMap((t) => shuffle(t, ctx.rng))
}

function sentenceCandidates(ctx: Ctx, exclude: string): Sentence[] {
  const all = Object.values(ctx.course.sentences).filter((s) => s.id !== exclude)
  const a = all.filter((s) => ctx.sentencePool.has(s.id))
  const b = all.filter((s) => !ctx.sentencePool.has(s.id))
  return [...shuffle(a, ctx.rng), ...shuffle(b, ctx.rng)]
}

type ChoiceType = 'listen-choose' | 'pinyin-to-sv' | 'sv-to-pinyin'

/** Multiple-choice exercise with `distractors` wrong options (min 2), or null if impossible. */
function choice(ctx: Ctx, type: ChoiceType, ref: ItemRef, distractors = 3): Exercise | null {
  const field = type === 'sv-to-pinyin' ? 'pinyin' : 'sv'
  const key = (t: string) => (field === 'sv' ? normSv(t) : norm(t))
  let answer: string
  let candidates: { text: string; svs: Set<string>; pinyin: string }[]
  let targetSv: Set<string>
  let targetPinyin: string
  if (ref.kind === 'word') {
    const w = ctx.course.words[ref.id]
    if (!w) return null
    answer = field === 'sv' ? w.sv : w.pinyin
    targetSv = svSetOf(w)
    targetPinyin = norm(w.pinyin)
    candidates = wordCandidates(ctx, new Set([w.id]), w.pos)
      .filter((c) => field !== 'sv' || !isMetaSv(c.sv))
      .map((c) => ({ text: field === 'sv' ? c.sv : c.pinyin, svs: svSetOf(c), pinyin: norm(c.pinyin) }))
  } else {
    const s = ctx.course.sentences[ref.id]
    if (!s) return null
    answer = field === 'sv' ? s.sv : s.chunks.join(' ')
    targetSv = svSetOf(s)
    targetPinyin = norm(s.chunks.join(' '))
    candidates = sentenceCandidates(ctx, s.id).map((c) => ({ text: field === 'sv' ? c.sv : c.chunks.join(' '), svs: svSetOf(c), pinyin: norm(c.chunks.join(' ')) }))
  }
  const used = new Set([key(answer)])
  const out: string[] = []
  for (const c of candidates) {
    if (out.length >= distractors) break
    // Never offer something that would also be a correct answer.
    if (overlaps(c.svs, targetSv) || c.pinyin === targetPinyin) continue
    const k = key(c.text)
    if (used.has(k)) continue
    used.add(k)
    out.push(c.text)
  }
  if (out.length < 2) return null
  return { type, item: ref, options: shuffle([answer, ...out], ctx.rng), answer }
}

/** Tonal (1–4) syllables of a word. */
function tonalSyllables(w: Word): string[] {
  return syllables(w.pinyin).filter((s) => syllableTone(s) !== 5)
}

function tonePick(ctx: Ctx, ref: ItemRef, syllable?: string): Exercise | null {
  const w = ctx.course.words[ref.id]
  if (!w || ref.kind !== 'word') return null
  const syls = tonalSyllables(w)
  if (!syls.length) return null
  const s = syllable ?? syls[Math.floor(ctx.rng() * syls.length)]
  return { type: 'tone-pick', item: ref, syllable: s, answer: syllableTone(s) }
}

function build(ctx: Ctx, type: 'build-pinyin' | 'build-sv', sentenceId: string): Exercise | null {
  const s = ctx.course.sentences[sentenceId]
  if (!s) return null
  const chunks = type === 'build-pinyin' ? s.chunks : s.svChunks
  if (chunks.length < 2) return null
  const key = type === 'build-pinyin' ? norm : normSv
  const used = new Set(chunks.map(key))
  const want = 2 + (ctx.rng() < 0.5 ? 1 : 0)
  let cands = wordCandidates(ctx, new Set(s.wordIds))
  if (type === 'build-sv') {
    // single-word Swedish tiles look more like real chunks
    cands = [...cands.filter((w) => !w.sv.includes(' ')), ...cands.filter((w) => w.sv.includes(' '))]
  }
  const extra: string[] = []
  for (const w of cands) {
    if (extra.length >= want) break
    const text = type === 'build-pinyin' ? w.pinyin : w.sv
    const k = key(text)
    if (!k || used.has(k)) continue
    if (type === 'build-sv' && isMetaSv(text)) continue
    // "nǐ hǎo" next to the chunks "nǐ" + "hǎo" would be a trap, not a distractor
    if (type === 'build-pinyin' && syllables(text).some((syl) => used.has(norm(syl)))) continue
    used.add(k)
    extra.push(text)
  }
  return { type, item: sentenceRef(s.id), tiles: shuffle([...chunks, ...extra], ctx.rng) }
}

function matchPairs(ctx: Ctx, primary: string[]): Exercise | null {
  const size = primary.length >= 5 ? 5 : 4
  const rest = Object.keys(ctx.course.words).filter((id) => !primary.includes(id))
  const ordered = [
    ...shuffle(primary, ctx.rng),
    ...shuffle(rest.filter((id) => ctx.pool.has(id)), ctx.rng),
    ...shuffle(rest.filter((id) => !ctx.pool.has(id)), ctx.rng),
  ]
  const chosen: Word[] = []
  for (const id of ordered) {
    if (chosen.length >= size) break
    const w = ctx.course.words[id]
    if (!w) continue
    const clash = chosen.some((c) => overlaps(svSetOf(c), svSetOf(w)) || norm(c.pinyin) === norm(w.pinyin))
    if (!clash) chosen.push(w)
  }
  if (chosen.length < 4) return null
  return { type: 'match-pairs', items: chosen.map((w) => wordRef(w.id)) }
}

// ─── Ordering ────────────────────────────────────────────────

/** Difficulty tier: recognition first, production last. */
const TIER: Record<Exercise['type'], number> = {
  intro: 0,
  'pinyin-to-sv': 1,
  'listen-choose': 1,
  'tone-pick': 1,
  'match-pairs': 2,
  'build-sv': 2,
  'sv-to-pinyin': 3,
  'type-pinyin': 4,
  'build-pinyin': 4,
  speak: 4,
}

interface Tagged { ex: Exercise; prio: number } // prio 0 = never trimmed; higher = trimmed first

function collide(a: Exercise, b: Exercise): boolean {
  if (a.type === 'match-pairs' || b.type === 'match-pairs') return false
  return itemKey(a.item) === itemKey(b.item)
}

/** Swap exercises so the same item is never tested twice in a row (intros stay put). */
export function spreadOut(list: Exercise[]): Exercise[] {
  const out = [...list]
  const introAt = new Map<string, number>()
  out.forEach((e, i) => { if (e.type === 'intro') introAt.set(itemKey(e.item), i) })
  const introOk = (e: Exercise, pos: number) => exerciseItems(e).every((r) => (introAt.get(itemKey(r)) ?? -1) < pos)
  const bad = (i: number) =>
    i > 0 && i < out.length && out[i].type !== 'intro' && out[i - 1].type !== 'intro' && collide(out[i - 1], out[i])
  for (let pass = 0; pass < 4; pass++) {
    let changed = false
    for (let i = 1; i < out.length; i++) {
      if (!bad(i)) continue
      // Prefer swapping with a later exercise (keeps the ramp), else an earlier one.
      const later = Array.from({ length: out.length - i - 1 }, (_, k) => i + 1 + k)
      const earlier = Array.from({ length: i - 1 }, (_, k) => i - 2 - k)
      for (const j of [...later, ...earlier]) {
        if (out[j].type === 'intro' || !introOk(out[j], i) || !introOk(out[i], j)) continue
        ;[out[i], out[j]] = [out[j], out[i]]
        if (!bad(i) && !bad(i + 1) && !bad(j) && !bad(j + 1)) { changed = true; break }
        ;[out[i], out[j]] = [out[j], out[i]]
      }
    }
    if (!changed) break
  }
  return out
}

const isScored = (e: Exercise) => e.type !== 'intro'

function trim(tagged: Tagged[], max: number, fixedScored: number, rng: Rng): Tagged[] {
  let t = [...tagged]
  while (fixedScored + t.filter((x) => isScored(x.ex)).length > max) {
    const top = Math.max(...t.map((x) => x.prio))
    if (top <= 0) break
    const cands = t.filter((x) => x.prio === top)
    const victim = cands[Math.floor(rng() * cands.length)]
    t = t.filter((x) => x !== victim)
  }
  return t
}

/** Sort by tier (shuffled within tier), then fix back-to-back repeats. */
function order(head: Exercise[], tagged: Tagged[], rng: Rng): Exercise[] {
  const byTier = new Map<number, Exercise[]>()
  for (const { ex } of tagged) {
    const t = TIER[ex.type]
    byTier.set(t, [...(byTier.get(t) ?? []), ex])
  }
  const body = [...byTier.keys()].sort((a, b) => a - b).flatMap((t) => shuffle(byTier.get(t)!, rng))
  return spreadOut([...head, ...body])
}

function push(tagged: Tagged[], ex: Exercise | null, prio: number) {
  if (ex) tagged.push({ ex, prio })
}

/** Intro cards in pairs, each pair followed by an easy recognition check. */
function introPhase(ctx: Ctx, words: string[]): Exercise[] {
  const head: Exercise[] = []
  for (let i = 0; i < words.length; i += 2) {
    const group = words.slice(i, i + 2)
    for (const id of group) head.push({ type: 'intro', item: wordRef(id) })
    for (const id of group) {
      const first: ChoiceType = ctx.rng() < 0.6 ? 'pinyin-to-sv' : 'listen-choose'
      const second: ChoiceType = first === 'pinyin-to-sv' ? 'listen-choose' : 'pinyin-to-sv'
      const ex = choice(ctx, first, wordRef(id), 2) ?? choice(ctx, second, wordRef(id), 2)
      if (ex) head.push(ex)
    }
  }
  return head
}

// ─── Lesson kinds ────────────────────────────────────────────

const MAX_SCORED = 18

function standardLesson(lesson: Lesson, course: Course, opts: GenOpts, rng: Rng): Exercise[] {
  const words = uniq(lesson.newWords).filter((id) => course.words[id])
  const sents = uniq(lesson.sentences).filter((id) => course.sentences[id])
  const ctx = makeCtx(course, rng, [...words, ...(opts.knownWordIds ?? [])], sents)
  const head = introPhase(ctx, words)
  const firstType = new Map<string, Exercise['type']>()
  for (const e of head) if (e.type !== 'intro' && e.type !== 'match-pairs') firstType.set(e.item.id, e.type)

  const tagged: Tagged[] = []
  // Tier 1: second recognition + tone picks
  for (const id of words) {
    const other: ChoiceType = firstType.get(id) === 'listen-choose' ? 'pinyin-to-sv' : 'listen-choose'
    push(tagged, choice(ctx, other, wordRef(id)), 3)
  }
  shuffle(words, rng).forEach((id, i) => push(tagged, tonePick(ctx, wordRef(id)), i < Math.ceil(words.length / 2) ? 2 : 4))
  // Tier 2: match pairs
  if (words.length >= 2) push(tagged, matchPairs(ctx, words), 0)
  // Sentences: one core build per sentence (alternating kinds), the other one optional
  sents.forEach((sid, i) => {
    const [a, b]: ('build-sv' | 'build-pinyin')[] = i % 2 === 0 ? ['build-sv', 'build-pinyin'] : ['build-pinyin', 'build-sv']
    const core = build(ctx, a, sid) ?? build(ctx, b, sid)
    push(tagged, core, i < 3 ? 0 : 2)
    if (core) push(tagged, build(ctx, core.type === 'build-sv' ? 'build-pinyin' : 'build-sv', sid), i < 2 ? 2 : 3)
  })
  // Production: each word gets one (choice or typed), the other optional
  shuffle(words, rng).forEach((id, i) => {
    const typed: Exercise = { type: 'type-pinyin', item: wordRef(id) }
    const picked = choice(ctx, 'sv-to-pinyin', wordRef(id))
    if (i % 2 === 0 && picked) {
      push(tagged, picked, 1)
      push(tagged, typed, 3)
    } else {
      push(tagged, typed, 1)
      push(tagged, picked, 3)
    }
  })
  if (opts.speaking) {
    const speakables: ItemRef[] = shuffle([...words.map(wordRef), ...sents.map(sentenceRef)], rng)
    speakables.slice(0, 2).forEach((r, i) => push(tagged, { type: 'speak', item: r }, i === 0 ? 1 : 3))
  }
  const fixed = head.filter(isScored).length
  return order(head, trim(tagged, MAX_SCORED, fixed, rng), rng)
}

function unitOf(course: Course, lessonId: string) {
  return course.units.find((u) => u.lessons.some((l) => l.id === lessonId))
}

function toneLesson(lesson: Lesson, course: Course, opts: GenOpts, rng: Rng): Exercise[] {
  let words = uniq(lesson.newWords).filter((id) => course.words[id])
  const introduce = words.length > 0
  if (!words.length) {
    const unit = unitOf(course, lesson.id)
    const unitWords = unit ? unit.lessons.flatMap((l) => l.newWords) : []
    words = uniq([...unitWords, ...(opts.knownWordIds ?? [])]).filter((id) => course.words[id])
    words = shuffle(words, rng).slice(0, 6)
  }
  words = words.filter((id) => tonalSyllables(course.words[id]).length)
  if (!words.length) return standardLesson(lesson, course, opts, rng)
  const ctx = makeCtx(course, rng, [...words, ...(opts.knownWordIds ?? [])], lesson.sentences)

  const head: Exercise[] = []
  if (introduce) {
    for (let i = 0; i < words.length; i += 2) {
      const group = words.slice(i, i + 2)
      for (const id of group) head.push({ type: 'intro', item: wordRef(id) })
      for (const id of group) {
        const tp = tonePick(ctx, wordRef(id))
        if (tp) head.push(tp)
      }
    }
  }
  const tagged: Tagged[] = []
  for (const id of words) {
    push(tagged, choice(ctx, 'listen-choose', wordRef(id)), 1)
    for (const s of tonalSyllables(course.words[id])) push(tagged, tonePick(ctx, wordRef(id), s), introduce ? 2 : 0)
    push(tagged, choice(ctx, 'pinyin-to-sv', wordRef(id)), 4)
  }
  push(tagged, matchPairs(ctx, words), 3)
  for (const sid of lesson.sentences) push(tagged, build(ctx, 'build-sv', sid), 3)
  if (opts.speaking) push(tagged, { type: 'speak', item: wordRef(words[Math.floor(rng() * words.length)]) }, 3)
  // Top up with extra tone drills to reach a proper workout.
  const fixed = head.filter(isScored).length
  let guard = 0
  while (fixed + tagged.length < 14 && guard++ < 40) {
    push(tagged, tonePick(ctx, wordRef(words[Math.floor(rng() * words.length)])), 3)
  }
  return order(head, trim(tagged, 16, fixed, rng), rng)
}

function checkpointLesson(lesson: Lesson, course: Course, opts: GenOpts, rng: Rng): Exercise[] {
  const unit = unitOf(course, lesson.id)
  const lessons = unit?.lessons ?? [lesson]
  const allWords = uniq([...lessons.flatMap((l) => l.newWords), ...lesson.newWords]).filter((id) => course.words[id])
  const allSents = uniq([...lessons.flatMap((l) => l.sentences), ...lesson.sentences]).filter((id) => course.sentences[id])
  if (!allWords.length && !allSents.length) return []
  const ctx = makeCtx(course, rng, [...allWords, ...(opts.knownWordIds ?? [])], allSents)
  const words = shuffle(allWords, rng).slice(0, 8)
  const sents = shuffle(allSents, rng).slice(0, 4)
  const tagged: Tagged[] = []

  words.forEach((id, i) => {
    const r = wordRef(id)
    const typed: Exercise = { type: 'type-pinyin', item: r }
    let ex: Exercise | null = typed
    if (i % 4 === 1) ex = choice(ctx, 'sv-to-pinyin', r) ?? typed
    if (i % 4 === 3) ex = choice(ctx, 'listen-choose', r) ?? typed
    push(tagged, ex, 0)
  })
  shuffle(words, rng).slice(0, 2).forEach((id) => push(tagged, tonePick(ctx, wordRef(id)), 3))
  if (words.length >= 4) push(tagged, matchPairs(ctx, words), 1)
  sents.forEach((sid, i) => {
    push(tagged, build(ctx, 'build-pinyin', sid) ?? build(ctx, 'build-sv', sid), 0)
    if (i < 2) push(tagged, build(ctx, 'build-sv', sid), 2)
  })
  if (opts.speaking) {
    const sp: ItemRef[] = shuffle([...sents.map(sentenceRef), ...words.map(wordRef)], rng).slice(0, 2)
    sp.forEach((r) => push(tagged, { type: 'speak', item: r }, 2))
  }
  return order([], trim(tagged, MAX_SCORED, 0, rng), rng)
}

// ─── Public generators ───────────────────────────────────────

export function generateLessonExercises(lesson: Lesson, course: Course, opts: GenOpts = {}): Exercise[] {
  const rng = makeRng(opts)
  if (lesson.kind === 'tones') return toneLesson(lesson, course, opts, rng)
  if (lesson.kind === 'checkpoint') return checkpointLesson(lesson, course, opts, rng)
  return standardLesson(lesson, course, opts, rng)
}

type Weighted = [Exercise['type'], number]

function weightedTypes(options: Weighted[], rng: Rng): Exercise['type'][] {
  // Weighted shuffle (Efraimidis–Spirakis): gives a preference order with fallbacks.
  return options
    .filter(([, w]) => w > 0)
    .map(([t, w]) => ({ t, k: Math.pow(rng(), 1 / w) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.t)
}

function makeExercise(ctx: Ctx, type: Exercise['type'], r: ItemRef): Exercise | null {
  switch (type) {
    case 'listen-choose':
    case 'pinyin-to-sv':
    case 'sv-to-pinyin':
      return choice(ctx, type, r)
    case 'tone-pick':
      return tonePick(ctx, r)
    case 'build-pinyin':
    case 'build-sv':
      return r.kind === 'sentence' ? build(ctx, type, r.id) : null
    case 'type-pinyin':
      return r.kind === 'word' ? { type, item: r } : null
    case 'speak':
      return { type, item: r }
    default:
      return null
  }
}

export function generateReviewExercises(items: ItemRef[], course: Course, opts: { speaking?: boolean; rng?: Rng; seed?: number } = {}): Exercise[] {
  const rng = makeRng(opts)
  const seen = new Set<string>()
  const valid = items.filter((r) => {
    const k = itemKey(r)
    if (seen.has(k)) return false
    seen.add(k)
    return r.kind === 'word' ? !!course.words[r.id] : !!course.sentences[r.id]
  })
  const wordIds = valid.filter((r) => r.kind === 'word').map((r) => r.id)
  const sentIds = valid.filter((r) => r.kind === 'sentence').map((r) => r.id)
  const ctx = makeCtx(course, rng, wordIds, sentIds)
  const sp = opts.speaking ? 1 : 0
  const out: Exercise[] = []
  for (const r of valid) {
    const prefs: Weighted[] =
      r.kind === 'word'
        ? [['listen-choose', 1], ['pinyin-to-sv', 1], ['sv-to-pinyin', 1.5], ['type-pinyin', 2], ['tone-pick', 0.5], ['speak', sp]]
        : [['build-pinyin', 2], ['build-sv', 1.5], ['listen-choose', 0.5], ['speak', sp]]
    for (const t of weightedTypes(prefs, rng)) {
      const ex = makeExercise(ctx, t, r)
      if (ex) { out.push(ex); break }
    }
  }
  if (wordIds.length >= 4) {
    const mp = matchPairs(ctx, shuffle(wordIds, rng).slice(0, 5))
    if (mp) out.push(mp)
  }
  return order([], out.map((ex) => ({ ex, prio: 0 })), rng)
}

export function generateToneDrill(wordIds: string[], course: Course, count = 12, opts: { rng?: Rng; seed?: number } = {}): Exercise[] {
  const rng = makeRng(opts)
  const seen = new Set<string>()
  const targets: { id: string; syl: string; tone: Tone }[] = []
  for (const id of uniq(wordIds)) {
    const w = course.words[id]
    if (!w) continue
    for (const s of tonalSyllables(w)) {
      const k = norm(s)
      if (seen.has(k)) continue
      seen.add(k)
      targets.push({ id, syl: s, tone: syllableTone(s) })
    }
  }
  if (!targets.length || count <= 0) return []
  // Balanced rounds: round-robin over tones so each tone appears about equally often.
  const list: typeof targets = []
  while (list.length < count) {
    const groups = new Map<Tone, typeof targets>()
    for (const t of shuffle(targets, rng)) groups.set(t.tone, [...(groups.get(t.tone) ?? []), t])
    const tones = shuffle([...groups.keys()], rng)
    let added = true
    while (added) {
      added = false
      for (const tone of tones) {
        const g = groups.get(tone)!
        const next = g.shift()
        if (next) { list.push(next); added = true }
      }
    }
  }
  const picked = list.slice(0, count)
  // Avoid the same syllable twice in a row.
  for (let i = 1; i < picked.length; i++) {
    if (norm(picked[i].syl) !== norm(picked[i - 1].syl)) continue
    const j = picked.findIndex((p, k) => k > i && norm(p.syl) !== norm(picked[i - 1].syl) && (k + 1 >= picked.length || norm(picked[k + 1].syl) !== norm(picked[i].syl)))
    if (j > 0) [picked[i], picked[j]] = [picked[j], picked[i]]
  }
  return picked.map((t) => ({ type: 'tone-pick', item: wordRef(t.id), syllable: t.syl, answer: t.tone }))
}
