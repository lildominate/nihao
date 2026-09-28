// Exercise generators — pure functions, deterministic when given a seed/rng.
// Pedagogy rules (see PEDAGOGY.md): exercise choice follows each item's
// mastery (0–5), review items are interleaved into lessons (~25 %),
// confusable options are kept apart, tone-picks can rotate voices (HVPT).
import type { Course, Dialogue, Exercise, ItemRef, Lesson, Sentence, Tone, Word } from '../types'
import { exerciseItems, getLine, itemChunks, itemExists, itemKey, lineRef, sentenceRef, wordByPinyin, wordRef } from './items'
import type { HintedExercise } from './items'
import { norm, normSv, syllableBase, syllableTone, syllables } from './pinyinUtil'

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

/** Item mastery 0 (unseen) … 5 (mastered) — pass `useProgress().mastery`. */
export type MasteryFn = (item: ItemRef) => number

export interface GenOpts {
  knownWordIds?: string[]
  /** Cap on scored exercises (short lesson parts use ~10; default 18). */
  maxScored?: number
  speaking?: boolean
  /** Inject an RNG (tests) … */
  rng?: Rng
  /** … or a seed. Defaults to Math.random. */
  seed?: number
  // ── v2 pedagogy (all optional; omitted → v1-like behaviour) ──
  /** Per-item mastery. Default: lesson items 0, review items 2. */
  mastery?: MasteryFn
  /** Due + weak items to interleave into the lesson (~20–30 % of scored exercises). */
  reviewItems?: ItemRef[]
  /** Completed lesson ids — unlocks the unit's dialogues (Dialogue.afterLessonId) for dialogue-reply. */
  completedLessonIds?: string[]
  /** Settings.multiVoice (default true in the app): tone-picks get `voice: 'rotate'`. */
  multiVoice?: boolean
}

export interface ReviewOpts {
  speaking?: boolean
  rng?: Rng
  seed?: number
  mastery?: MasteryFn
  multiVoice?: boolean
}

export function makeRng(o?: { rng?: Rng; seed?: number }): Rng {
  if (o?.rng) return o.rng
  if (o?.seed != null) return mulberry32(o.seed)
  return Math.random
}

const uniq = <T,>(a: T[]) => [...new Set(a)]
const clampM = (m: number) => (Number.isFinite(m) ? Math.max(0, Math.min(5, Math.round(m))) : 0)
const isLetters = (chunk: string) => /\p{L}/u.test(chunk)
/** Chunks may carry punctuation ("lǎo shī ,", "nǐ hǎo !"): compare on the bare pinyin. */
const stripPunct = (s: string) => norm(s.replace(/[?!,.;:…。，！？、]/g, ' '))

// ─── Confusability ───────────────────────────────────────────
// Options that look/sound nearly alike ("lǎo shī hǎo" vs "lǎo shī , zài jiàn",
// "mā" vs "mǎ", "hej" vs "hej då") are kept out of the same question unless the
// question is intentionally contrastive (item mastery ≥ 4).

const sylCache = new Map<string, string[]>()
function baseSyls(pinyin: string): string[] {
  let v = sylCache.get(pinyin)
  if (!v) {
    v = syllables(pinyin).map((s) => syllableBase(s).toLowerCase())
    if (sylCache.size > 5000) sylCache.clear()
    sylCache.set(pinyin, v)
  }
  return v
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a), B = new Set(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / (A.size + B.size - inter)
}

/** Pinyin texts that a learner is likely to confuse. */
export function confusablePinyin(a: string, b: string): boolean {
  if (stripPunct(a) === stripPunct(b)) return true
  const sa = baseSyls(a), sb = baseSyls(b)
  if (!sa.length || !sb.length) return false
  if (sa.length === 1 && sb.length === 1) return sa[0] === sb[0] // tonal minimal pair
  if (sa.length >= 2 && sb.length >= 2 && sa[0] === sb[0] && sa[1] === sb[1]) return true // same opening
  return jaccard(sa, sb) >= 0.5
}

/** Swedish texts that share most words ("hej" / "hej då"). */
export function confusableSv(a: string, b: string): boolean {
  const ta = normSv(a).split(' ').filter(Boolean), tb = normSv(b).split(' ').filter(Boolean)
  if (ta.length < 2 && tb.length < 2) return false
  return jaccard(ta, tb) >= 0.5
}

/** Stable partition: non-confusable first; `contrastive` pulls one confusable to the front. */
function arrangeByConfusion<T>(cands: T[], isConf: (c: T) => boolean, contrastive: boolean): T[] {
  // Candidates are already ranked by plausibility; only the head matters (keeps this cheap).
  const head = cands.slice(0, 40), tail = cands.slice(40)
  const ok: T[] = [], conf: T[] = []
  for (const c of head) (isConf(c) ? conf : ok).push(c)
  if (contrastive && conf.length) return [conf[0], ...ok, ...conf.slice(1), ...tail]
  return [...ok, ...conf, ...tail]
}

// ─── Context & distractors ───────────────────────────────────

interface Ctx {
  course: Course
  rng: Rng
  /** Preferred distractor source (lesson + known words). */
  pool: Set<string>
  /** Preferred sentence distractor source. */
  sentencePool: Set<string>
  mastery: (r: ItemRef, dflt: number) => number
}

function makeCtx(course: Course, rng: Rng, pool: string[], sentencePool: string[] = [], mastery?: MasteryFn): Ctx {
  return {
    course,
    rng,
    pool: new Set(pool.filter((id) => course.words[id])),
    sentencePool: new Set(sentencePool),
    mastery: (r, dflt) => (mastery ? clampM(mastery(r)) : dflt),
  }
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

interface ChoiceCand { text: string; svs: Set<string>; pinyin: string; rawPinyin: string; sv: string }

/**
 * Multiple-choice exercise with `distractors` wrong options (min 2), or null if impossible.
 * Confusable options are avoided unless `contrastive`.
 */
function choice(ctx: Ctx, type: ChoiceType, ref: ItemRef, distractors = 3, contrastive = false): Exercise | null {
  const field = type === 'sv-to-pinyin' ? 'pinyin' : 'sv'
  const key = (t: string) => (field === 'sv' ? normSv(t) : stripPunct(t))
  let answer: string
  let candidates: ChoiceCand[]
  let targetSv: Set<string>
  let rawTargetPinyin: string
  let rawTargetSv: string
  if (ref.kind === 'word') {
    const w = ctx.course.words[ref.id]
    if (!w) return null
    answer = field === 'sv' ? w.sv : w.pinyin
    targetSv = svSetOf(w)
    rawTargetPinyin = w.pinyin
    rawTargetSv = w.sv
    candidates = wordCandidates(ctx, new Set([w.id]), w.pos)
      .filter((c) => field !== 'sv' || !isMetaSv(c.sv))
      .map((c) => ({ text: field === 'sv' ? c.sv : c.pinyin, svs: svSetOf(c), pinyin: stripPunct(c.pinyin), rawPinyin: c.pinyin, sv: c.sv }))
  } else if (ref.kind === 'sentence') {
    const s = ctx.course.sentences[ref.id]
    if (!s) return null
    answer = field === 'sv' ? s.sv : s.chunks.join(' ')
    targetSv = svSetOf(s)
    rawTargetPinyin = s.chunks.join(' ')
    rawTargetSv = s.sv
    candidates = sentenceCandidates(ctx, s.id).map((c) => {
      const p = c.chunks.join(' ')
      return { text: field === 'sv' ? c.sv : p, svs: svSetOf(c), pinyin: stripPunct(p), rawPinyin: p, sv: c.sv }
    })
  } else {
    return null
  }
  const targetPinyin = stripPunct(rawTargetPinyin)
  const isConf = (c: ChoiceCand) =>
    confusablePinyin(c.rawPinyin, rawTargetPinyin) || (field === 'sv' && confusableSv(c.sv, rawTargetSv))
  candidates = arrangeByConfusion(candidates, isConf, contrastive)
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

/** Distractor pinyin tiles for a chunk list (2–3), never overlapping the real chunks. */
function pinyinTileDistractors(ctx: Ctx, chunks: string[], wordIds: string[]): string[] {
  const used = new Set(chunks.map(stripPunct))
  for (const c of chunks) for (const syl of syllables(c)) used.add(norm(syl))
  const want = 2 + (ctx.rng() < 0.5 ? 1 : 0)
  const extra: string[] = []
  for (const w of wordCandidates(ctx, new Set(wordIds))) {
    if (extra.length >= want) break
    const k = stripPunct(w.pinyin)
    if (!k || used.has(k)) continue
    // "nǐ hǎo" next to the chunks "nǐ" + "hǎo" would be a trap, not a distractor
    if (syllables(w.pinyin).some((syl) => used.has(norm(syl)))) continue
    used.add(k)
    extra.push(w.pinyin)
  }
  return extra
}

function build(ctx: Ctx, type: 'build-pinyin' | 'build-sv', sentenceId: string): Exercise | null {
  const s = ctx.course.sentences[sentenceId]
  if (!s) return null
  const chunks = type === 'build-pinyin' ? s.chunks : s.svChunks
  if (chunks.length < 2) return null
  if (type === 'build-pinyin') {
    return { type, item: sentenceRef(s.id), tiles: shuffle([...chunks, ...pinyinTileDistractors(ctx, chunks, s.wordIds)], ctx.rng) }
  }
  const used = new Set(chunks.map(normSv))
  const want = 2 + (ctx.rng() < 0.5 ? 1 : 0)
  let cands = wordCandidates(ctx, new Set(s.wordIds))
  // single-word Swedish tiles look more like real chunks
  cands = [...cands.filter((w) => !w.sv.includes(' ')), ...cands.filter((w) => w.sv.includes(' '))]
  const extra: string[] = []
  for (const w of cands) {
    if (extra.length >= want) break
    const k = normSv(w.sv)
    if (!k || used.has(k) || isMetaSv(w.sv)) continue
    used.add(k)
    extra.push(w.sv)
  }
  return { type, item: sentenceRef(s.id), tiles: shuffle([...chunks, ...extra], ctx.rng) }
}

function wordIdsOf(ctx: Ctx, r: ItemRef): string[] {
  if (r.kind === 'sentence') return ctx.course.sentences[r.id]?.wordIds ?? []
  if (r.kind === 'line') return getLine(ctx.course, r)?.line.wordIds ?? []
  return [r.id]
}

/** v2: audio only → order pinyin chunks (sentence or dialogue line). */
function listenBuild(ctx: Ctx, r: ItemRef): Exercise | null {
  if (r.kind === 'word') return null
  const chunks = itemChunks(ctx.course, r)
  if (chunks.filter(isLetters).length < 2) return null
  return { type: 'listen-build', item: r, tiles: shuffle([...chunks, ...pinyinTileDistractors(ctx, chunks, wordIdsOf(ctx, r))], ctx.rng) }
}

/** v2: sentence/line with one pinyin chunk blanked → pick it. Prefers blanking a lesson/known word. */
function fillBlank(ctx: Ctx, r: ItemRef, contrastive = false): Exercise | null {
  if (r.kind === 'word') return null
  const chunks = itemChunks(ctx.course, r)
  const wordIds = wordIdsOf(ctx, r)
  const idx = chunks.map((c, i) => (isLetters(c) ? i : -1)).filter((i) => i >= 0)
  if (idx.length < 2) return null
  const bare = chunks.map(stripPunct)
  // Prefer chunks without attached punctuation, then lesson/known words.
  const clean = idx.filter((i) => bare[i] === norm(chunks[i]))
  const base = clean.length >= 1 ? clean : idx
  const inPool = base.filter((i) => {
    const w = wordByPinyin(ctx.course, bare[i], wordIds)
    return !!w && ctx.pool.has(w.id)
  })
  const from = inPool.length ? inPool : base
  const blankIndex = from[Math.floor(ctx.rng() * from.length)]
  // The answer is the bare pinyin (a trailing "," or "!" of the chunk is not part of the choice).
  const answer = chunks[blankIndex].replace(/[?!,.;:…。，！？、]/g, ' ').replace(/\s+/g, ' ').trim()
  const target = wordByPinyin(ctx.course, bare[blankIndex], wordIds)
  const inChunks = new Set(bare)
  let cands = wordCandidates(ctx, new Set([...wordIds, ...(target ? [target.id] : [])]), target?.pos)
  cands = arrangeByConfusion(cands, (w) => confusablePinyin(w.pinyin, answer), contrastive)
  const used = new Set([stripPunct(answer)])
  const out: string[] = []
  for (const w of cands) {
    if (out.length >= 3) break
    const k = stripPunct(w.pinyin)
    if (used.has(k) || inChunks.has(k)) continue
    used.add(k)
    out.push(w.pinyin)
  }
  if (out.length < 2) return null
  return { type: 'fill-blank', item: r, blankIndex, options: shuffle([answer, ...out], ctx.rng), answer }
}

/** A line is a "reply" when the previous line exists and is spoken by the other person. */
function isReplyLine(d: Dialogue, i: number): boolean {
  const cur = d.lines[i], prev = d.lines[i - 1]
  return i >= 1 && !!cur && !!prev && cur.speaker !== 'N' && prev.speaker !== 'N' && cur.speaker !== prev.speaker && cur.chunks.some(isLetters)
}

/** v2: previous line shown → pick the reply (pinyin). Distractors avoid confusable lines. */
function dialogueReply(ctx: Ctx, r: ItemRef, contrastive = false): Exercise | null {
  const found = getLine(ctx.course, r)
  if (!found || !isReplyLine(found.dialogue, found.index)) return null
  const { dialogue, line, index } = found
  const answer = line.chunks.join(' ')
  const prev = stripPunct(dialogue.lines[index - 1].chunks.join(' '))
  const others: string[] = []
  for (const d of Object.values(ctx.course.dialogues ?? {})) {
    if (d.id === dialogue.id) continue
    for (const l of d.lines) if (l.speaker !== 'N') others.push(l.chunks.join(' '))
  }
  const sents = sentenceCandidates(ctx, '').map((s) => s.chunks.join(' '))
  // Same-dialogue lines far from the reply come last (they may be plausible in context).
  const same = dialogue.lines.filter((l, j) => Math.abs(j - index) >= 2 && l.speaker !== 'N').map((l) => l.chunks.join(' '))
  let cands = [...shuffle(others, ctx.rng), ...sents, ...shuffle(same, ctx.rng)]
  cands = arrangeByConfusion(cands, (c) => confusablePinyin(c, answer), contrastive)
  const used = new Set([stripPunct(answer), prev])
  const out: string[] = []
  for (const c of cands) {
    if (out.length >= 3) break
    const k = stripPunct(c)
    if (used.has(k)) continue
    used.add(k)
    out.push(c)
  }
  if (out.length < 2) return null
  return { type: 'dialogue-reply', item: r, options: shuffle([answer, ...out], ctx.rng), answer }
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
  // Pass 1 also keeps confusable pairs apart; pass 2 fills up if needed.
  for (const strict of [true, false]) {
    for (const id of ordered) {
      if (chosen.length >= size) break
      const w = ctx.course.words[id]
      if (!w || chosen.includes(w)) continue
      const clash = chosen.some((c) =>
        overlaps(svSetOf(c), svSetOf(w)) || norm(c.pinyin) === norm(w.pinyin) ||
        (strict && (confusablePinyin(c.pinyin, w.pinyin) || confusableSv(c.sv, w.sv))))
      if (!clash) chosen.push(w)
    }
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
  'fill-blank': 2,
  'sv-to-pinyin': 3,
  'dialogue-reply': 3,
  'type-pinyin': 4,
  'build-pinyin': 4,
  'listen-build': 4,
  shadow: 4,
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

/** Interleave: insert `extra` at evenly spaced positions after the first `after` exercises. */
function interleave(list: Exercise[], extra: Exercise[], after: number): Exercise[] {
  if (!extra.length) return list
  const out = [...list]
  const bodyLen = Math.max(0, out.length - after)
  // Insert from the back so earlier positions stay valid.
  for (let k = extra.length - 1; k >= 0; k--) {
    const pos = after + Math.round(((k + 1) * bodyLen) / (extra.length + 1))
    out.splice(pos, 0, extra[k])
  }
  return spreadOut(out)
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

// ─── Adaptive single-item exercise (reviews + interleaving) ───

type Weighted = [Exercise['type'], number]

function weightedTypes(options: Weighted[], rng: Rng): Exercise['type'][] {
  // Weighted shuffle (Efraimidis–Spirakis): gives a preference order with fallbacks.
  return options
    .filter(([, w]) => w > 0)
    .map(([t, w]) => ({ t, k: Math.pow(rng(), 1 / w) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.t)
}

/**
 * Exercise-type preferences by mastery stage:
 *  0–1 recognition · 2–3 mixed (fill-blank, build, choice-production) ·
 *  4–5 production (type, listen-build, speak, shadow, dialogue-reply).
 */
export function preferredTypes(kind: ItemRef['kind'], mastery: number, speaking: boolean): Weighted[] {
  const sp = speaking ? 1 : 0
  const stage = mastery <= 1 ? 0 : mastery <= 3 ? 1 : 2
  const table: Record<ItemRef['kind'], Weighted[][]> = {
    word: [
      [['listen-choose', 2], ['pinyin-to-sv', 2], ['sv-to-pinyin', 0.5]],
      [['sv-to-pinyin', 2], ['type-pinyin', 1.5], ['listen-choose', 0.7], ['speak', sp * 0.5]],
      [['type-pinyin', 2.5], ['speak', sp * 1.5], ['sv-to-pinyin', 0.3]],
    ],
    sentence: [
      [['build-sv', 2], ['listen-choose', 1], ['pinyin-to-sv', 1], ['fill-blank', 0.3]],
      [['fill-blank', 2], ['build-pinyin', 2], ['build-sv', 0.5], ['speak', sp * 0.5]],
      [['listen-build', 2], ['build-pinyin', 1], ['shadow', sp * 1.5], ['speak', sp]],
    ],
    line: [
      [['dialogue-reply', 2], ['fill-blank', 1]],
      [['dialogue-reply', 2], ['fill-blank', 1.5], ['listen-build', 1]],
      [['listen-build', 2], ['shadow', sp * 1.5], ['dialogue-reply', 1]],
    ],
  }
  return table[kind][stage]
}

function makeExercise(ctx: Ctx, type: Exercise['type'], r: ItemRef, contrastive = false): Exercise | null {
  switch (type) {
    case 'listen-choose':
    case 'pinyin-to-sv':
    case 'sv-to-pinyin':
      return choice(ctx, type, r, 3, contrastive)
    case 'tone-pick':
      return tonePick(ctx, r)
    case 'build-pinyin':
    case 'build-sv':
      return r.kind === 'sentence' ? build(ctx, type, r.id) : null
    case 'type-pinyin':
      return r.kind === 'word' ? { type, item: r } : null
    case 'speak':
      return r.kind === 'line' ? null : { type, item: r }
    case 'shadow':
      return r.kind === 'word' ? null : { type, item: r }
    case 'fill-blank':
      return fillBlank(ctx, r, contrastive)
    case 'listen-build':
      return listenBuild(ctx, r)
    case 'dialogue-reply':
      return dialogueReply(ctx, r, contrastive)
    default:
      return null
  }
}

function adaptiveExercise(ctx: Ctx, r: ItemRef, mastery: number, speaking: boolean): Exercise | null {
  const contrastive = mastery >= 4
  for (const t of weightedTypes(preferredTypes(r.kind, mastery, speaking), ctx.rng)) {
    const ex = makeExercise(ctx, t, r, contrastive)
    if (ex) return ex
  }
  // Last resort: anything that works for this item.
  for (const t of ['listen-choose', 'pinyin-to-sv', 'build-sv', 'dialogue-reply', 'fill-blank', 'listen-build'] as const) {
    const ex = makeExercise(ctx, t, r)
    if (ex) return ex
  }
  return null
}

// ─── Lesson kinds ────────────────────────────────────────────

const MAX_SCORED = 18
/** Share of scored exercises reserved for interleaved review (20–30 %). */
export const REVIEW_SHARE = 0.25

function unitOf(course: Course, lessonId: string) {
  return course.units.find((u) => u.lessons.some((l) => l.id === lessonId))
}

/** Reply lines of the lesson's unit dialogues that are unlocked (afterLessonId completed). */
export function unlockedReplyLines(course: Course, lessonId: string, completed?: string[]): ItemRef[] {
  if (!completed?.length || !course.dialogues) return []
  const unit = unitOf(course, lessonId)
  if (!unit) return []
  const done = new Set(completed)
  const ids = new Set([...(unit.dialogueIds ?? []), ...Object.values(course.dialogues).filter((d) => d.unitId === unit.id).map((d) => d.id)])
  const out: ItemRef[] = []
  for (const id of ids) {
    const d = course.dialogues[id]
    if (!d || !done.has(d.afterLessonId)) continue
    d.lines.forEach((_, i) => { if (isReplyLine(d, i)) out.push(lineRef(d.id, i)) })
  }
  return out
}

/** Up to `n` dialogue exercises, weakest lines first (strong lines → listen-build). */
function dialogueExercises(ctx: Ctx, lines: ItemRef[], n: number): Exercise[] {
  const ranked = shuffle(lines, ctx.rng).sort((a, b) => ctx.mastery(a, 0) - ctx.mastery(b, 0))
  const out: Exercise[] = []
  for (const r of ranked) {
    if (out.length >= n) break
    const m = ctx.mastery(r, 0)
    const ex = m >= 4 ? listenBuild(ctx, r) ?? dialogueReply(ctx, r, true) : dialogueReply(ctx, r)
    if (ex) out.push(ex)
  }
  return out
}

/** Review exercises for interleaving (items not part of the lesson itself). */
function reviewSlotExercises(ctx: Ctx, items: ItemRef[] | undefined, exclude: Set<string>, n: number, speaking: boolean): Exercise[] {
  if (!items?.length || n <= 0) return []
  const seen = new Set<string>()
  const out: Exercise[] = []
  for (const r of items) {
    if (out.length >= n) break
    const k = itemKey(r)
    if (seen.has(k) || exclude.has(k) || !itemExists(ctx.course, r)) continue
    seen.add(k)
    const ex = adaptiveExercise(ctx, r, ctx.mastery(r, 2), speaking)
    if (ex) out.push(ex)
  }
  return out
}

function standardLesson(lesson: Lesson, course: Course, opts: GenOpts, rng: Rng): Exercise[] {
  const words = uniq(lesson.newWords).filter((id) => course.words[id])
  const sents = uniq(lesson.sentences).filter((id) => course.sentences[id])
  const ctx = makeCtx(course, rng, [...words, ...(opts.knownWordIds ?? [])], sents, opts.mastery)
  const speaking = !!opts.speaking
  const mW = (id: string) => ctx.mastery(wordRef(id), 0)
  const fresh = words.filter((id) => mW(id) <= 1)
  const mid = words.filter((id) => mW(id) >= 2 && mW(id) <= 3)
  const strong = words.filter((id) => mW(id) >= 4)

  const head = introPhase(ctx, fresh)
  const firstType = new Map<string, Exercise['type']>()
  for (const e of head) if (e.type !== 'intro' && e.type !== 'match-pairs') firstType.set(e.item.id, e.type)

  const tagged: Tagged[] = []
  // Fresh words (0–1): second recognition + tone picks, then one production each (in-lesson ramp).
  for (const id of fresh) {
    const other: ChoiceType = firstType.get(id) === 'listen-choose' ? 'pinyin-to-sv' : 'listen-choose'
    push(tagged, choice(ctx, other, wordRef(id)), 3)
  }
  shuffle(fresh, rng).forEach((id, i) => push(tagged, tonePick(ctx, wordRef(id)), i < Math.ceil(fresh.length / 2) ? 2 : 4))
  shuffle(fresh, rng).forEach((id, i) => {
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
  // Mid words (2–3, e.g. lesson replay): no intro; choice-production + typing.
  for (const id of mid) {
    push(tagged, choice(ctx, 'sv-to-pinyin', wordRef(id)), 1)
    push(tagged, { type: 'type-pinyin', item: wordRef(id) }, 2)
    push(tagged, choice(ctx, 'listen-choose', wordRef(id)), 4)
    push(tagged, tonePick(ctx, wordRef(id)), 4)
  }
  // Strong words (4–5): production only.
  for (const id of strong) {
    push(tagged, { type: 'type-pinyin', item: wordRef(id) }, 1)
    if (speaking) push(tagged, { type: 'speak', item: wordRef(id) }, 3)
    push(tagged, tonePick(ctx, wordRef(id)), 4)
  }
  if (fresh.length + mid.length >= 2) push(tagged, matchPairs(ctx, [...fresh, ...mid]), 0)
  else if (words.length >= 2) push(tagged, matchPairs(ctx, words), 4)

  // Sentences by mastery.
  sents.forEach((sid, i) => {
    const ref = sentenceRef(sid)
    const m = ctx.mastery(ref, 0)
    if (m <= 1) {
      const [a, b]: ('build-sv' | 'build-pinyin')[] = i % 2 === 0 ? ['build-sv', 'build-pinyin'] : ['build-pinyin', 'build-sv']
      const core = build(ctx, a, sid) ?? build(ctx, b, sid)
      push(tagged, core, i < 3 ? 0 : 2)
      if (core) push(tagged, build(ctx, core.type === 'build-sv' ? 'build-pinyin' : 'build-sv', sid), i < 2 ? 2 : 3)
      push(tagged, fillBlank(ctx, ref), 4)
    } else if (m <= 3) {
      push(tagged, fillBlank(ctx, ref) ?? build(ctx, 'build-pinyin', sid), i < 3 ? 0 : 2)
      push(tagged, build(ctx, 'build-pinyin', sid), 3)
    } else {
      push(tagged, listenBuild(ctx, ref) ?? build(ctx, 'build-pinyin', sid), i < 3 ? 0 : 2)
      if (speaking) push(tagged, { type: 'shadow', item: ref }, 2)
    }
  })
  if (speaking) {
    const speakables: ItemRef[] = shuffle([...[...fresh, ...mid].map(wordRef), ...sents.map(sentenceRef).filter((r) => ctx.mastery(r, 0) <= 3)], rng)
    speakables.slice(0, 2).forEach((r, i) => push(tagged, { type: 'speak', item: r }, i === 0 ? 1 : 3))
  }
  // Dialogue replies once the unit's dialogue is unlocked.
  dialogueExercises(ctx, unlockedReplyLines(course, lesson.id, opts.completedLessonIds), 2).forEach((ex, i) => push(tagged, ex, i === 0 ? 0 : 3))

  // Interleaved review (~25 % of the scored total).
  const exclude = new Set([...words.map((id) => itemKey(wordRef(id))), ...sents.map((id) => itemKey(sentenceRef(id)))])
  const max = opts.maxScored ?? MAX_SCORED
  const slots = Math.round(max * REVIEW_SHARE) // 5 of 18
  const reviews = reviewSlotExercises(ctx, opts.reviewItems, exclude, slots, speaking)

  const fixed = head.filter(isScored).length
  const ordered = order(head, trim(tagged, max - reviews.length, fixed, rng), rng)
  return interleave(ordered, reviews, Math.min(head.length, ordered.length))
}

/** Tone-focused lesson (currently unused in the path; kept for an optional tone course). */
export function toneLesson(lesson: Lesson, course: Course, opts: GenOpts, rng: Rng): Exercise[] {
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
  const ctx = makeCtx(course, rng, [...words, ...(opts.knownWordIds ?? [])], lesson.sentences, opts.mastery)

  const head: Exercise[] = []
  if (introduce) {
    for (let i = 0; i < words.length; i += 2) {
      const group = words.slice(i, i + 2)
      for (const id of group) if (ctx.mastery(wordRef(id), 0) <= 1) head.push({ type: 'intro', item: wordRef(id) })
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
  const ctx = makeCtx(course, rng, [...allWords, ...(opts.knownWordIds ?? [])], allSents, opts.mastery)
  // Weakest first when mastery is known (the checkpoint targets what's shaky).
  const byWeakness = <T,>(ids: T[], ref: (x: T) => ItemRef) =>
    opts.mastery ? [...ids].sort((a, b) => ctx.mastery(ref(a), 2) - ctx.mastery(ref(b), 2)) : ids
  const words = byWeakness(shuffle(allWords, rng), wordRef).slice(0, 8)
  const sents = byWeakness(shuffle(allSents, rng), sentenceRef).slice(0, 4)
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
    const strong = ctx.mastery(sentenceRef(sid), 2) >= 4
    const core = strong ? listenBuild(ctx, sentenceRef(sid)) : null
    push(tagged, core ?? build(ctx, 'build-pinyin', sid) ?? build(ctx, 'build-sv', sid), 0)
    if (i < 2) push(tagged, build(ctx, 'build-sv', sid), 2)
  })
  if (opts.speaking) {
    const sp: ItemRef[] = shuffle([...sents.map(sentenceRef), ...words.map(wordRef)], rng).slice(0, 2)
    sp.forEach((r) => push(tagged, { type: 'speak', item: r }, 2))
  }
  dialogueExercises(ctx, unlockedReplyLines(course, lesson.id, opts.completedLessonIds), 2).forEach((ex) => push(tagged, ex, 1))
  return order([], trim(tagged, opts.maxScored ?? MAX_SCORED, 0, rng), rng)
}

/** HVPT: mark tone-picks for voice rotation when multiVoice is on. */
/** The learner chose not to type pinyin: free-text answers become "pick the right pinyin". */
// Also: iOS speech recognition hung the lesson on 'speak', so mic exercises stay in Tallabbet only.
function noTyping(list: Exercise[], course: Course, rng: Rng): Exercise[] {
  // Tone identification felt like guessing too: in lessons/reviews it becomes "listen → pick the meaning".
  // Tone training stays opt-in (generateToneDrill, Tonjakt, Tallabbet).
  return list.map((e) =>
    e.type === 'type-pinyin' ? choiceExercise(course, 'sv-to-pinyin', e.item, { rng }) ?? e
    : e.type === 'tone-pick' ? choiceExercise(course, 'listen-choose', e.item, { rng }) ?? e
    : e)
}

function withVoice(list: Exercise[], multiVoice?: boolean): Exercise[] {
  if (!multiVoice) return list
  return list.map((e) => (e.type === 'tone-pick' ? ({ ...e, voice: 'rotate' } satisfies HintedExercise) : e))
}

// ─── Public generators ───────────────────────────────────────

/** One multiple-choice exercise (3 distractors, confusables avoided) — used by the placement test. */
export function choiceExercise(
  course: Course,
  type: ChoiceType,
  item: ItemRef,
  opts: { seed?: number; rng?: Rng; pool?: string[] } = {},
): Exercise | null {
  const ctx = makeCtx(course, makeRng(opts), opts.pool ?? [], [])
  return choice(ctx, type, item, 3)
}

export function generateLessonExercises(lesson: Lesson, course: Course, opts: GenOpts = {}): Exercise[] {
  opts = { ...opts, speaking: false }
  const rng = makeRng(opts)
  // 'tones' lessons are taught like normal vocabulary: learners found early tone-picking to be pure guessing.
  // Tone training lives in the tone drill, Tonjakt and Tallabbet instead.
  const list =
    lesson.kind === 'checkpoint' ? checkpointLesson(lesson, course, opts, rng)
    : standardLesson(lesson, course, opts, rng)
  return withVoice(noTyping(list, course, rng), opts.multiVoice)
}

export function generateReviewExercises(items: ItemRef[], course: Course, opts: ReviewOpts = {}): Exercise[] {
  opts = { ...opts, speaking: false }
  const rng = makeRng(opts)
  const seen = new Set<string>()
  const valid = items.filter((r) => {
    const k = itemKey(r)
    if (seen.has(k)) return false
    seen.add(k)
    return itemExists(course, r)
  })
  const wordIds = valid.filter((r) => r.kind === 'word').map((r) => r.id)
  const sentIds = valid.filter((r) => r.kind === 'sentence').map((r) => r.id)
  const ctx = makeCtx(course, rng, wordIds, sentIds, opts.mastery)
  const out: Exercise[] = []
  for (const r of valid) {
    const ex = adaptiveExercise(ctx, r, ctx.mastery(r, 2), !!opts.speaking)
    if (ex) out.push(ex)
  }
  if (wordIds.length >= 4) {
    const mp = matchPairs(ctx, shuffle(wordIds, rng).slice(0, 5))
    if (mp) out.push(mp)
  }
  return withVoice(noTyping(order([], out.map((ex) => ({ ex, prio: 0 })), rng), course, rng), opts.multiVoice)
}

export function generateToneDrill(wordIds: string[], course: Course, count = 12, opts: { rng?: Rng; seed?: number; multiVoice?: boolean } = {}): Exercise[] {
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
  return withVoice(picked.map((t): Exercise => ({ type: 'tone-pick', item: wordRef(t.id), syllable: t.syl, answer: t.tone })), opts.multiVoice)
}
